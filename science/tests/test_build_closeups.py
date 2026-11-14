"""Atomic close-up refresh preserves fixture science bytes and numbers."""
import json
import numpy as np
import pytest

from test_build_sites_s7 import tree, build, snapshot, STAMP
from test_terrain_mesh import prepared
from truesouth.cli import main
from truesouth.commands import build_sites
from truesouth.contracts import Sites
from truesouth.derived_io import read_closeup


def test_refresh_preserves_all_existing_science_and_is_repeatable(tree):
    output, maps, _ = tree
    build('connecting_ridge')
    before = snapshot(output)
    site = next(s for s in Sites.model_validate_json(before['sites.json']).root if s.id == 'connecting_ridge')
    closeups = maps/'closeups'
    closeups.mkdir()
    prepared(closeups, site.id, np.full((801, 801), 1235), (site.lat_deg, site.lon_deg), pixel=5)
    args = ['build-sites', '--closeups-only', '--only', site.id, '--generated-utc', STAMP]
    assert main(args) == 0
    after = snapshot(output)
    assert before['manifest.json'] == after['manifest.json']
    for name, data in before.items():
        if name == 'sites.json':
            old, new = json.loads(data), json.loads(after[name])
            for record in new:
                record['has_closeup'] = False
            assert old == new
        elif name.endswith('/meta.json'):
            old, new = json.loads(data), json.loads(after[name])
            new['closeup'] = None
            assert old == new
        else:
            assert data == after[name]
    close = read_closeup(output/f'sites/{site.id}/closeup.bin', 257)
    assert close['up_km'][128, 128] == pytest.approx(0, abs=1e-8)
    assert main(args) == 0
    assert snapshot(output) == after


def test_failed_refresh_keeps_complete_previous_site(tree, monkeypatch):
    output, maps, _ = tree
    build('connecting_ridge')
    site = Sites.model_validate_json((output/'sites.json').read_bytes()).root[0]
    closeups = maps/'closeups'; closeups.mkdir()
    prepared(closeups, site.id, np.full((801,801), 1234), (site.lat_deg, site.lon_deg), pixel=5)
    before = snapshot(output)
    def failed(*args, **kwargs):
        raise OSError('synthetic close-up write failure')
    monkeypatch.setattr(build_sites, 'write_closeup', failed)
    with pytest.raises(OSError, match='synthetic close-up'):
        main(['build-sites', '--closeups-only', '--only', site.id])
    assert snapshot(output) == before
