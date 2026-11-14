"""Bounded in-process FIFO. Only completed atomic directories survive a restart."""
from collections import deque
import errno
import logging
from pathlib import Path
import re
from threading import Condition, Event, Lock, Thread
from time import monotonic

from truesouth_api.errors import Rejected
from truesouth_api.storage import CacheBudget, FULL
from truesouth_api.settings import cache_limit_bytes as configured_cache_limit

from truesouth.contracts import CatalogSite, CustomSiteRequest, Site

ID = re.compile(
    r'\Ac_(?:-?90\.0000_0\.0000|'
    r'(?:[0-9]\.[0-9]{4}|[1-8][0-9]\.[0-9]{4}|'
    r'-(?:[1-9]|[1-8][0-9])\.[0-9]{4}|-0\.(?!0000_)[0-9]{4})_'
    r'(?:0|[1-9][0-9]?|[12][0-9]{2}|3[0-5][0-9])\.[0-9]{4})\Z',
    re.ASCII,
)
NEED_MAPS = 'Custom sites need the terrain maps, which are not installed on this server.'
START = 'Custom site is not ready. Start it with POST /api/sites/custom.'
MAPS = ('LDEM_80S_80MPP_ADJ.npy', 'LDEM_60S_240MPP_ADJ.npy')


def site_id(request):
    lat = round(request.lat_deg, 4) or 0.
    lon = 0. if abs(lat) == 90 else (round(request.lon_deg, 4) % 360 or 0.)
    return f'c_{lat:.4f}_{lon:.4f}'


def canonical_id(identity):
    if not ID.fullmatch(identity):
        return False
    _, lat, lon = identity.split('_')
    lat, lon = float(lat), float(lon)
    if not (-90 <= lat <= 90 and 0 <= lon < 360):
        return False
    return identity == site_id(CustomSiteRequest.model_construct(lat_deg=lat, lon_deg=lon))


class Computer:
    """Lazy science imports and one read-only memory mapping per prepared array."""
    def __init__(self, derived, prepared, cache):
        self.derived, self.prepared, self.cache = derived, prepared, cache
        self.store = None
        self.global_data = None
        self.lock = Lock()
        self.budget = None
        self.cancelled = Event()

    def tier(self, request):
        from truesouth.dem import DemStore, site_tier
        if not (self.derived / 'system.bin').is_file():
            raise Rejected(503, 'Custom sites need the global ephemeris, which is not installed on this server.', code='ephemeris_missing')
        tier = site_tier(request.lat_deg).item()
        if tier == 'sphere':
            return tier
        if self.store is None:
            with self.lock:
                if self.store is None:
                    if not all((self.prepared / n).is_file() and (self.prepared / n).with_suffix('.json').is_file() for n in MAPS):
                        raise Rejected(503, NEED_MAPS, code='maps_missing')
                    self.store = DemStore(*(self.prepared / n for n in MAPS))
        return tier

    def cancel(self):
        with self.lock:
            self.cancelled.set()

    def publish(self, staging, target):
        from truesouth.commands.build_sites import _publish_site
        with self.lock:
            if self.cancelled.is_set():
                raise InterruptedError('custom site interrupted by shutdown')
            (self.budget.publish if self.budget else _publish_site)(staging, target)

    def __call__(self, request, tier):
        from truesouth.commands.build_sites import build_site
        from truesouth.dem import DemStore
        from truesouth.ephemeris import load_global
        with self.lock:
            if self.global_data is None:
                self.global_data = load_global(self.derived / 'system.bin')
        identity = site_id(request)
        _, lat, lon = identity.split('_')
        site = CatalogSite(id=identity, name=request.name or 'Custom site', group='contrast',
            lat_deg=float(lat), lon_deg=float(lon), description='Coordinates entered by the user.',
            source_url='', outcome=None)
        return build_site(site, self.store or DemStore(), self.global_data,
                          self.cache / identity, tier=tier, site_entry=True, publish=self.publish, cancelled=self.cancelled.is_set)



class Jobs:
    def __init__(self, cache: Path, computer, *, clock=monotonic, finished_limit=128, max_addresses=4096, cache_limit_bytes=None):
        self.cache, self.computer, self.clock = cache, computer, clock
        self.condition = Condition()
        self.waiting = deque()
        self.states = {}
        self.starts = {}
        self.worker = None
        self.closed = False
        self.inline = set()
        self.finished_limit = finished_limit
        self.finished = deque()
        self.max_addresses = max_addresses
        self.budget = CacheBudget(cache, configured_cache_limit() if cache_limit_bytes is None else cache_limit_bytes)
        if isinstance(computer, Computer):
            computer.budget = self.budget

    def cached(self, identity):
        if not canonical_id(identity):
            return None
        folder = self.cache / identity
        try:
            site = Site.model_validate_json((folder / 'site.json').read_bytes())
            required = ['meta.json', 'series.bin', 'skyline.bin']
            if site.terrain_tier != 'sphere':
                required.append('terrain.bin')
            if site.id == identity and all((folder / n).is_file() for n in required):
                return site.model_dump(mode='json')
        except (OSError, ValueError):
            pass
        return None

    def _record(self, identity, state):
        self.states[identity] = state
        if identity in self.finished:
            self.finished.remove(identity)
        self.finished.append(identity)
        while len(self.finished) > self.finished_limit:
            old = self.finished.popleft()
            if self.states.get(old, {}).get('status') in ('ready', 'failed'):
                self.states.pop(old, None)

    def _reconcile_worker(self):
        if self.worker is None or not self.worker.is_alive():
            for identity, state in list(self.states.items()):
                if state['status'] == 'running' and identity not in self.inline:
                    self.budget.release(identity)
                    self._record(identity, dict(site_id=identity, status='failed', site=None,
                        error=dict(code='computation_failed', message='The custom-site worker stopped. Please try again.')))
            if self.waiting and not self.closed:
                self.worker = Thread(target=self._run, name='custom-sites', daemon=True)
                self.worker.start()

    def status(self, identity):
        with self.condition:
            self._reconcile_worker()
            site = self.cached(identity)
            if site is not None:
                return dict(site_id=identity, status='ready', site=site, error=None, position_in_queue=None)
            state = self.states.get(identity)
            if state is None:
                return None
            position = next((i + 1 for i, job in enumerate(self.waiting) if job[0] == identity), None) if state['status'] == 'queued' else None
            return {**state, 'position_in_queue': position}

    def submit(self, request: CustomSiteRequest, address):
        identity = site_id(request)
        # Compute at the canonical rounded coordinates, independent of submission order.
        _, lat, lon = identity.split('_')
        request = request.model_copy(update=dict(lat_deg=float(lat), lon_deg=float(lon)))
        with self.condition:
            if self.closed:
                raise Rejected(503, 'This server is shutting down. Please try again later.', code='shutting_down')
            self._reconcile_worker()
            state = self.status(identity)
            if state and state['status'] != 'failed':
                position = next((i+1 for i, job in enumerate(self.waiting) if job[0] == identity), 0)
                return dict(site_id=identity, status=state['status'], position_in_queue=position)
            now = self.clock()
            for client, previous in list(self.starts.items()):
                while previous and previous[0] <= now - 3600:
                    previous.popleft()
                if not previous:
                    del self.starts[client]
            history = self.starts.get(address, deque())
            if len(history) >= 6:
                raise Rejected(429, 'You may start 6 custom sites per hour. Please try again later.', max(1, int(3600 - (now-history[0]) + .999)), code='rate_limited')
            tier = self.computer.tier(request)
            if tier != 'sphere' and len(self.waiting) >= 20:
                raise Rejected(429, 'The custom-site queue is full. Please try again later.', 1, code='queue_full')
            if address not in self.starts and len(self.starts) >= self.max_addresses:
                raise Rejected(503, 'This server is handling too many client addresses. Please try again later.', 3600, code='address_limit')
            self.budget.reserve(identity, tier)
            history.append(now)
            self.starts[address] = history
            self.states[identity] = dict(site_id=identity, status='queued', site=None, error=None)
            if tier != 'sphere':
                self.waiting.append((identity, request, tier))
                position = len(self.waiting)
                if self.worker is None or not self.worker.is_alive():
                    self.worker = Thread(target=self._run, name='custom-sites', daemon=True)
                    self.worker.start()
                self.condition.notify()
                return dict(site_id=identity, status='queued', position_in_queue=position)
            self.states[identity]['status'] = 'running'
            self.inline.add(identity)
        result = self._compute(identity, request, tier)
        with self.condition:
            self.inline.discard(identity)
        return dict(site_id=identity, status=result['status'], position_in_queue=0)

    def _compute(self, identity, request, tier):
        with self.condition:
            self.states[identity]['status'] = 'running'
        try:
            site = self.computer(request, tier)
            state = dict(site_id=identity, status='ready', site=site.model_dump(mode='json'), error=None)
        except BaseException as error:
            logging.exception('Custom site %s failed', identity)
            full = (isinstance(error, Rejected) and error.status == 507) or (isinstance(error, OSError) and error.errno == errno.ENOSPC)
            state = dict(site_id=identity, status='failed', site=None,
                         error=dict(code='storage_full' if full else 'computation_failed',
                                    message=FULL if full else ('The server stopped this job. Please submit it again.' if self.closed else 'The custom site could not be computed. Please try again.')))
        with self.condition:
            self.budget.release(identity)
            self._record(identity, state)
            self.condition.notify_all()
        return state

    def _run(self):
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.closed or self.waiting)
                if self.closed:
                    return
                identity, request, tier = self.waiting.popleft()
                self.states[identity]['status'] = 'running'
            self._compute(identity, request, tier)

    def close(self):
        with self.condition:
            self.closed = True
            if isinstance(self.computer, Computer):
                self.computer.cancel()
            while self.waiting:
                identity, _, _ = self.waiting.popleft()
                self.budget.release(identity)
                self._record(identity, dict(site_id=identity, status='failed', site=None,
                    error=dict(code='computation_failed', message='The server stopped before this job ran. Please submit it again.')))
            self.condition.notify_all()
        if self.worker:
            self.worker.join()
