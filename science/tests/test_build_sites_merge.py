"""Shared builder integration after merging catalog placement and custom sites."""
import json
from pathlib import Path
import subprocess
import sys

from test_build_sites_s7 import tree, build, snapshot
from truesouth import catalog, paths
from truesouth.commands import build_sites
from truesouth.dem import DemStore
from truesouth.ephemeris import load_global
from truesouth_api.health import health_report


def test_custom_builder_shares_derivation_without_catalog_side_effects(tree, tmp_path, monkeypatch):
    output, prepared, _ = tree
    original = next(site for site in catalog.load_sites() if site.id == 'connecting_ridge')
    custom = original.model_copy(update={'id':'c_-89.4555_222.6192'})
    before = snapshot(output)
    def forbidden():
        raise AssertionError('custom builder consulted the placement cache')
    monkeypatch.setattr(paths, 'cache_dir', forbidden)
    calls = []
    derive = build_sites._derive
    def counted(*args, **kwargs):
        calls.append(args[0])
        return derive(*args, **kwargs)
    monkeypatch.setattr(build_sites, '_derive', counted)
    published = []
    def publish(stage, target):
        assert json.loads((stage/'site.json').read_text())['nearby_sun'] is None
        published.append(target)
        build_sites._publish_site(stage, target)
    target = tmp_path/'custom'/custom.id
    result = build_sites.build_site(custom, DemStore(prepared/'LDEM_80S_80MPP_ADJ.npy'),
        load_global(output/'system.bin'), target, tier='core80', site_entry=True, publish=publish)
    assert calls == [custom.id]
    assert published == [target]
    assert result.nearby_sun is result.variant_of is result.offset_m is None
    assert snapshot(output) == before
    assert sorted(path.name for path in target.iterdir()) == ['meta.json', 'series.bin', 'site.json', 'skyline.bin', 'terrain.bin']


def test_catalog_uses_shared_builder_without_repeating_derivation(tree, monkeypatch):
    calls, derived = [], []
    builder, derive = build_sites.build_site, build_sites._derive
    def tracked(site, *args, **kwargs):
        calls.append((site.id, kwargs.get('site_entry', False), kwargs['parts'] is not None))
        return builder(site, *args, **kwargs)
    def counted(*args, **kwargs):
        derived.append(args[0])
        return derive(*args, **kwargs)
    monkeypatch.setattr(build_sites, 'build_site', tracked)
    monkeypatch.setattr(build_sites, '_derive', counted)
    build('apollo11')
    assert calls == [('apollo11', False, True)]
    assert derived == ['apollo11']


def test_api_import_keeps_science_and_placement_lazy():
    script = "import sys; import truesouth_api.main; assert not any(name in sys.modules for name in ('numpy','scipy','pyproj','rasterio','truesouth.placement_cache'))"
    subprocess.run([sys.executable, '-c', script], check=True)


def test_health_reports_all_25_sites_including_variants(tmp_path):
    ids = [site['id'] for site in json.loads((paths.derived_dir()/'sites.json').read_text())]
    assert len(ids) == 25 and sum(site.endswith('_best_lit') for site in ids) == 5
    derived = tmp_path/'derived'; derived.mkdir()
    (derived/'manifest.json').write_text('{}')
    (derived/'sites.json').write_text(json.dumps([{'id':site} for site in ids]))
    for site in ids:
        folder=derived/'sites'/site; folder.mkdir(parents=True)
        for name in ('meta.json','series.bin','skyline.bin'): (folder/name).write_bytes(b'present')
    health = health_report(derived, tmp_path/'prepared')
    assert health['status'] == 'ok'
    assert set(health['derived']['site_files']) == set(ids)


def test_custom_storage_never_traverses_placement_cache(tmp_path, monkeypatch):
    from truesouth_api.storage import CacheBudget
    root=tmp_path/'cache'; placement=root/'placement'; placement.mkdir(parents=True)
    (placement/'private-candidate.npz').write_bytes(b'candidate bytes belong to science')
    (root/'custom.bin').write_bytes(b'123')
    rglob=Path.rglob
    def guarded(self, *args, **kwargs):
        if self == root or self == placement or placement in self.parents:
            raise AssertionError('custom storage touched the placement cache')
        return rglob(self, *args, **kwargs)
    monkeypatch.setattr(Path,'rglob',guarded)
    assert CacheBudget(root,3).size() == 3
