"""Catalog data stays in step with the two source documents."""

import re
from pathlib import Path

import pytest

from truesouth import catalog
from truesouth.contracts import PROFILE_FIELDS

ROOT = Path(__file__).resolve().parents[2]


def section(text, heading):
    return text.split(heading, 1)[1].split('\n## ', 1)[0]


def rows(text):
    return [[cell.strip() for cell in line.strip().strip('|').split('|')]
            for line in text.splitlines() if line.startswith('|')][2:]


def num(value):
    return float(value.replace('−', '-'))


def test_profiles_match_document():
    doc = (ROOT / 'docs/mission-profiles.md').read_text(encoding='utf-8')
    profiles = catalog.load_profiles()
    table = rows(section(doc, '## Presets'))
    # One '###' subsection of '## Sources' per preset, in the table's column order.
    missions = section(doc, '## Sources').split('\n### ')[1:6]
    assert len(missions) == 5
    assert len(profiles) == len(table[0]) - 1 == 5
    assert len({p.id for p in profiles}) == len(profiles)
    for row in table:
        field = re.search(r'`([^`]+)`', row[0]).group(1)
        for i, profile in enumerate(profiles):
            cell = row[i + 1]
            val = cell.strip('*`')
            if field == 'id':
                assert profile.id == val
                continue
            if val == 'same':
                val = row[1]
            expected = (dict(zip(('slope', 'power', 'comms'), map(float, val.split(', '))))
                        if field == 'weights' else None if val == 'none'
                        else False if val == 'false' else num(val))
            actual = getattr(profile, field)
            if field == 'weights':
                actual = actual.model_dump()
            assert actual == expected, (profile.id, field)
            provenance = getattr(profile.provenance, field)
            assert provenance.kind == ('sourced' if cell.startswith('**') else 'assumed')
            if provenance.kind == 'sourced':
                # The link and the quotation must both sit in this mission's own notes.
                assert provenance.source_url in missions[i], (profile.id, field)
                assert provenance.quote in ' '.join(missions[i].split()), (profile.id, field)
            else:
                assert provenance.reason
    assert len(PROFILE_FIELDS) == len(table) - 1


def test_sites_match_document():
    doc = (ROOT / 'docs/site-catalog.md').read_text(encoding='utf-8')
    sites = catalog.load_sites()
    expected = []
    for heading, group in [('## Group A:', 'artemis'), ('## Group B:', 'sunlit_peak'),
                           ('## Group C:', 'polar_lander'), ('## Group D:', 'contrast')]:
        table = rows(section(doc, heading).split('### Verified extras')[0])
        for row in table:
            expected.append((row[0].strip('`'), row[1], group, num(row[2]), num(row[3])))
            site = next(s for s in sites if s.id == row[0].strip('`'))
            if group == 'artemis':
                assert site.description == row[4] + '; representative point, not an official centre.'
                assert site.source_url == 'https://pgda.gsfc.nasa.gov/products/78'
                assert site.outcome is None
            elif group == 'sunlit_peak':
                url = re.search(r'https?://[^>]+', row[4])
                if url:
                    previous = url.group()
                if 'same preprint' in row[4]:
                    previous = re.search(r'https?://[^>]+', table[2][4]).group()
                assert site.source_url == previous
                assert site.description == row[4].split(' <')[0].rstrip('.') + '. Sunlight in the source: ' + row[5] + '.'
                assert site.outcome is None
            else:
                assert site.description == row[4]
                assert site.source_url == re.search(r'https?://[^>]+', row[5]).group()
                assert site.outcome == (row[4] if group == 'polar_lander' else None)
    assert [(s.id, s.name, s.group, s.lat_deg, s.lon_deg) for s in sites] == expected
    assert len(sites) == len({s.id for s in sites}) == 20
    assert all(0 <= s.lon_deg < 360 and s.source_url and s.description for s in sites)
    for s in sites:
        assert s.source_url in doc
        if s.outcome:
            assert s.outcome in doc


def test_features_match_document():
    doc = (ROOT / 'docs/site-catalog.md').read_text(encoding='utf-8')
    table = rows(section(doc, '## Named features'))
    features = catalog.load_features()
    assert [(f.name, f.iau_id, f.lat_deg, f.lon_deg, f.diameter_km) for f in features] == [
        (r[0], int(r[1]), num(r[2]), num(r[3]), num(r[4])) for r in table]
    assert len(features) == len({f.iau_id for f in features}) == 15
    assert all(0 <= f.lon_deg < 360 for f in features)


def test_regions_match_document():
    doc = (ROOT / 'docs/site-catalog.md').read_text(encoding='utf-8')
    regions = catalog.load_artemis_regions()
    intro = section(doc, '## Group A:')
    # The nine names and NASA's announcement link are read from the page's own sentence.
    announcement = intro.split('(<', 1)[1].split('>', 1)[0]
    listing = ' '.join(intro.split('):', 1)[1].split('. They were chosen', 1)[0].split())
    names = [name.strip() for part in listing.split(', ') for name in part.split(' and ')]
    assert len(names) == 9
    assert [r.name for r in regions] == names
    assert len(regions) == len({r.name for r in regions}) == 9
    assert all(r.lat_deg is None and r.lon_deg is None and r.size_km is None for r in regions)
    assert all(r.source_url == announcement for r in regions)


def test_invalid_entry_names_file_and_entry(tmp_path):
    (tmp_path / 'sites.json').write_text('[{"id":"broken"}]', encoding='utf-8')
    with pytest.raises(ValueError, match=r'sites.json.*broken'):
        catalog.load_sites(tmp_path)
