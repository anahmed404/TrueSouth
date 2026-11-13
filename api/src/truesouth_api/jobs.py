"""Bounded in-process FIFO. Only completed atomic directories survive a restart."""
from collections import deque
import logging
from pathlib import Path
import re
from threading import Condition, Lock, Thread
from time import monotonic

from truesouth.contracts import CatalogSite, CustomSiteRequest, Site

ID = re.compile(r'^c_-?\d+\.\d{4}_\d+\.\d{4}$')
NEED_MAPS = 'Custom sites need the terrain maps, which are not installed on this server.'
START = 'Custom site is not ready. Start it with POST /api/sites/custom.'
MAPS = ('LDEM_80S_80MPP_ADJ.npy', 'LDEM_60S_240MPP_ADJ.npy')


def site_id(request):
    lat = round(request.lat_deg, 4) or 0.
    lon = round(request.lon_deg, 4) % 360 or 0.
    return f'c_{lat:.4f}_{lon:.4f}'


class Rejected(Exception):
    def __init__(self, status, message, retry=None):
        self.status, self.message, self.retry = status, message, retry


class Computer:
    """Lazy science imports and one read-only memory mapping per prepared array."""
    def __init__(self, derived, prepared, cache):
        self.derived, self.prepared, self.cache = derived, prepared, cache
        self.store = None
        self.global_data = None
        self.lock = Lock()

    def tier(self, request):
        from truesouth.dem import DemStore, site_tier
        with self.lock:
            if self.store is None:
                if not all((self.prepared / n).is_file() and (self.prepared / n).with_suffix('.json').is_file() for n in MAPS):
                    if site_tier(request.lat_deg).item() != 'sphere':
                        raise Rejected(503, NEED_MAPS)
                    return 'sphere'
                self.store = DemStore(*(self.prepared / n for n in MAPS))
            return self.store.tiers(request.lat_deg, request.lon_deg).item()

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
                              self.cache / identity, tier=tier, site_entry=True)


class Jobs:
    def __init__(self, cache: Path, computer, *, clock=monotonic):
        self.cache, self.computer, self.clock = cache, computer, clock
        self.condition = Condition()
        self.waiting = deque()
        self.states = {}
        self.starts = {}
        self.worker = None
        self.closed = False

    def cached(self, identity):
        if not ID.fullmatch(identity):
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

    def status(self, identity):
        with self.condition:
            site = self.cached(identity)
            if site is not None:
                return dict(site_id=identity, status='ready', site=site, error=None)
            return self.states.get(identity)

    def submit(self, request: CustomSiteRequest, address):
        identity = site_id(request)
        # Compute at the canonical rounded coordinates, independent of submission order.
        _, lat, lon = identity.split('_')
        request = request.model_copy(update=dict(lat_deg=float(lat), lon_deg=float(lon)))
        with self.condition:
            state = self.status(identity)
            if state and state['status'] != 'failed':
                position = next((i+1 for i, job in enumerate(self.waiting) if job[0] == identity), 0)
                return dict(site_id=identity, status=state['status'], position_in_queue=position)
            now = self.clock()
            history = self.starts.setdefault(address, deque())
            while history and history[0] <= now - 3600:
                history.popleft()
            if len(history) >= 6:
                raise Rejected(429, 'You may start 6 custom sites per hour. Please try again later.', max(1, int(3600 - (now-history[0]) + .999)))
            tier = self.computer.tier(request)
            if tier != 'sphere' and len(self.waiting) >= 20:
                raise Rejected(429, 'The custom-site queue is full. Please try again later.')
            history.append(now)
            self.states[identity] = dict(site_id=identity, status='queued', site=None, error=None)
            if tier == 'sphere':
                self._compute(identity, request, tier)
                return dict(site_id=identity, status=self.states[identity]['status'], position_in_queue=0)
            self.waiting.append((identity, request, tier))
            position = len(self.waiting)
            if self.worker is None:
                self.worker = Thread(target=self._run, name='custom-sites', daemon=True)
                self.worker.start()
            self.condition.notify()
            return dict(site_id=identity, status='queued', position_in_queue=position)

    def _compute(self, identity, request, tier):
        with self.condition:
            self.states[identity]['status'] = 'running'
        try:
            site = self.computer(request, tier)
            state = dict(site_id=identity, status='ready', site=site.model_dump(mode='json'), error=None)
        except Exception:
            logging.exception('Custom site %s failed', identity)
            state = dict(site_id=identity, status='failed', site=None,
                         error=dict(code='computation_failed', message='The custom site could not be computed. Please try again.'))
        with self.condition:
            self.states[identity] = state
            self.condition.notify_all()

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
            self.condition.notify_all()
        if self.worker:
            self.worker.join()
