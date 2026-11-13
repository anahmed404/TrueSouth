"""Bound custom storage without deleting completed sites.

Admission reserves the fixed binary sizes plus 32 KiB for the two JSON files.
Publication checks actual bytes under the same lock, including concurrent staging.
"""
from itertools import chain
from threading import Lock
from truesouth.constants import TIME_GRID_COUNT, SKYLINE_BINS, TERRAIN_SIZE
from truesouth_api.errors import Rejected

FULL = "This server's storage for custom sites is full."


class CacheBudget:
    def __init__(self, root, limit_bytes):
        self.root, self.limit_bytes = root, limit_bytes
        self.lock = Lock()
        self.reservations = {}

    def size(self):
        total = 0
        try:
            children = list(self.root.iterdir())
        except FileNotFoundError:
            return total
        for child in children:
            # Catalog candidates share the data root, but never the custom quota.
            # Prune before walking so API requests do not read placement entries.
            if child.name == 'placement' or child.is_symlink():
                continue
            descendants = child.rglob('*') if child.is_dir() else ()
            for path in chain((child,), descendants):
                try:
                    if not path.is_symlink() and path.is_file():
                        total += path.stat().st_size
                except FileNotFoundError:
                    # Publication renames a complete staging directory in one step.
                    continue
        return total

    def reserve(self, identity, tier):
        required = TIME_GRID_COUNT*8*2 + SKYLINE_BINS*5*4 + 32768
        if tier != 'sphere': required += TERRAIN_SIZE**2*4*4
        with self.lock:
            if self.size() + sum(self.reservations.values()) + required > self.limit_bytes:
                raise Rejected(507, FULL, code='storage_full')
            self.reservations[identity] = required

    def release(self, identity):
        with self.lock:
            self.reservations.pop(identity, None)

    def publish(self, staging, target):
        from truesouth.commands.build_sites import _publish_site
        with self.lock:
            total = self.size()
            # The pipeline stages inside the cache; callers outside it need counting too.
            if not staging.is_relative_to(self.root):
                total += sum(p.stat().st_size for p in staging.rglob('*') if p.is_file())
            if total > self.limit_bytes:
                raise Rejected(507, FULL, code='storage_full')
            _publish_site(staging, target)
