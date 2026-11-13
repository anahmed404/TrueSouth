"""Synthetic data, not scientific predictions; every run rewrites every file.

The skyline is an analytic crater rim. Disc fraction is a linear ramp across
the disc diameter, a stand-in for the later terrain and strip integration.
Scoring cases refer to a fixture series file and a half-open hour range.
"""
import json
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from truesouth import catalog, constants as C, derived_io as io, scoring
from truesouth.contracts import Manifest, Sites, SiteMeta, SeriesLayout, MapMeta, Validation, WorkedExamples, Weights
from truesouth.paths import fixtures_dir, repo_root, catalog_dir

STAMP = '2026-01-01T00:00:00Z'
N = C.TIME_GRID_COUNT


def _json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n').encode('utf-8'))


def _utc(hour):
    return (datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(hours=int(hour))).strftime('%Y-%m-%dT%H:%M:%SZ')


def _site(id, name, lat, lon, tier, slope, closeup=False):
    return dict(id=id, name=name, group='contrast' if tier == 'sphere' else 'sunlit_peak', lat_deg=lat,
                lon_deg=lon, description='Synthetic fixture; not a real lunar site.', source_url='', outcome=None,
                terrain_tier=tier, has_closeup=closeup, elevation_m=None if tier == 'sphere' else 0.0,
                slope=None if slope is None else dict(deg=slope, baseline_m=100, source='synthetic fixture'),
                quickmap_url='https://quickmap.lroc.asu.edu/', moontrek_url='https://trek.nasa.gov/moon/')


def _mesh(size, width):
    x = np.linspace(-width/2, width/2, size)
    east, north = np.meshgrid(x, x[::-1])
    r = np.hypot(east, north)
    up = -0.08 * np.exp(-(r/2)**2) + 0.12 * np.exp(-((r-3)/0.65)**2)
    dy, dx = np.gradient(up, width/(size-1))
    return dict(east_km=east, north_km=north, up_km=up, slope_deg=np.degrees(np.arctan(np.hypot(dx, dy))))


def _skyline(site, index):
    az = np.arange(C.SKYLINE_BINS) / 4
    if site['terrain_tier'] == 'sphere':
        flat = -np.degrees(np.arccos(C.MOON_RADIUS_M / (C.MOON_RADIUS_M + C.OBSERVER_HEIGHT_M)))
        return dict(el_deg=np.full(len(az), flat), **{k: np.full(len(az), np.nan) for k in ('dist_km','lat_deg','lon_deg','height_m')})
    # Each synthetic site has its own rim height and angular shape.
    base, height, direction, power = [(0.10, .65, 70, 12), (1.0, .65, 180, 3),
                                       (.35, .8, 35, 6), (.35, .9, 110, 8)][index]
    rim = base + height * (0.5 + 0.5 * np.cos(np.radians(az - direction)))**power
    return dict(el_deg=rim, dist_km=np.full(len(az), 3.0), lat_deg=np.full(len(az), site['lat_deg']),
                lon_deg=np.full(len(az), site['lon_deg']), height_m=np.full(len(az), 100.0))


def _series(sky, index):
    t = np.arange(N, dtype=float)
    az = np.round((t * 360 / 708.7 + index*57) % 360, 2) % 360
    earth_az = np.round((45 + 7*np.sin(2*np.pi*t/655.7) + index*22) % 360, 2) % 360
    sun_centre, sun_amplitude, seasonal = [(1.15, .95, .35), (1.35, 1.5, .3),
                                           (1.5, 1.05, .25), (1.4, 1.2, .3),
                                           (1.15, 1.6, .4)][index]
    el = np.round(sun_centre + sun_amplitude*np.sin(2*np.pi*t/708.7 + index*.8) + seasonal*np.sin(2*np.pi*t/(24*365.25)), 2)
    earth_centre, earth_amplitude = [(4.0, 2.0), (3.1, 2.3), (3.2, 2.8), (3.0, 2.0), (2.5, 2.0)][index]
    earth_el = np.round(earth_centre + earth_amplitude*np.sin(2*np.pi*t/655.7 + index*1.2), 2)
    elevation = np.asarray(sky['el_deg'], dtype='<f4').astype(float)
    def clear(a, e):
        pos = a * 4
        i = np.floor(pos).astype(int) % C.SKYLINE_BINS
        f = pos - np.floor(pos)
        return np.round(e - (elevation[i]*(1-f) + elevation[(i+1)%C.SKYLINE_BINS]*f), 2)
    sc, ec = clear(az, el), clear(earth_az, earth_el)
    return dict(sun_az=az, sun_el=el, sun_frac=np.clip(.5 + sc/(2*.266),0,1), sun_clear=sc,
                earth_az=earth_az, earth_el=earth_el, earth_frac=np.clip(.5 + ec/(2*.95),0,1), earth_clear=ec)


def _validation():
    limits = [0, .02, .01, .001, .001, .02, .005, .001, .005, 1e-9, 0]
    gates = [dict(id=f'G{i}', name=f'Synthetic example gate G{i}', passed=i != 6,
                  measured=(.03 if i == 6 else 0), limit=lim, unit='deg' if i in (2,4,5,6,8,9) else 'difference',
                  samples=100, detail='Synthetic demonstration; not an actual validation run.') for i, lim in enumerate(limits, 1)]
    marks = [.1,.1,2,2,.05,.05]
    references = ['https://pgda.gsfc.nasa.gov/products/69', 'https://pgda.gsfc.nasa.gov/products/69',
                  'https://pgda.gsfc.nasa.gov/products/90', 'https://pgda.gsfc.nasa.gov/products/78', '', '']
    comparisons = [dict(id=f'R{i}', site_id='fixture_ridge', ours=(.3 if i == 1 else 0), reference=0,
                        unit='fraction' if i in (1,2,6) else 'deg', reference_source=references[i-1],
                        investigate_above=mark, outside_mark=i == 1,
                        explanation='Synthetic values deliberately exceed the investigation mark.' if i == 1 else None)
                   for i, mark in enumerate(marks,1)]
    daily = (0.006 + 0.002*np.sin(np.arange(N//24)*.07)).tolist()
    series = [dict(site_id='fixture_ridge', body=body, start_utc=STAMP, step_h=24, max_difference_deg=daily) for body in ('sun','earth')]
    sources = [dict(name=n, url=u, used_for=use) for n,u,use in [
        ('JPL Horizons','https://ssd.jpl.nasa.gov/horizons/','Sun and Earth positions'),
        ('LOLA polar terrain and slope','https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/','terrain and slope'),
        ('LOLA close-up terrain and slope','https://pgda.gsfc.nasa.gov/products/78','close-up terrain and slope'),
        ('LOLA illumination and Earth visibility','https://pgda.gsfc.nasa.gov/data/MoonIllumination/','illumination and Earth visibility'),
        ('NASA SVS Moon texture','https://svs.gsfc.nasa.gov/4720','global Moon texture')]]
    return Validation(generated_utc=STAMP, gates=gates, comparisons=comparisons, g2_over_time=series, sources=sources).model_dump(mode='json')


def _worked():
    # Synthetic placeholders; real examples are generated by S12.
    data = {}
    for f in WorkedExamples.model_fields.values():
        key = f.alias
        typ = f.annotation
        if typ is bool: value = False
        elif typ is str: value = STAMP if key.endswith(('utc','date')) else 'fixture_ridge'
        elif typ == list[str]: value = ['fixture_ridge']
        else: value = 1.0
        data[key] = value
    data.update({
        'l1.sun_el_max_deg': 4.4, 'l1.sun_el_min_deg': -1.4, 'l1.site_lat_deg': -89.4,
        'l1.example_subsolar_lat': 0.0, 'l1.example_subsolar_lon': 0.0,
        'l1.example_sun_az': 0.0, 'l1.example_sun_el': 1.5,
        'l2.sun_el_deg': 1.5, 'l2.sun_az_deg': 0.0, 'l2.ridge_dist_km': 3.0,
        'l2.ridge_rise_m': 100.0, 'l2.ridge_el_deg': 1.0, 'l2.ridge_feature': 'Synthetic crater rim',
        'l2.sun_frac': 1.0, 'l3.drop_at_20km_m': 115.0, 'l3.drop_at_60km_m': 1036.0,
        'l3.drop_at_130km_m': 4864.0, 'l3.example_bin_az': 45.0, 'l3.example_dist_km': 3.0,
        'l3.example_height_m': 100.0, 'l3.example_el_flat_deg': 1.91, 'l3.example_el_true_deg': 1.86,
        'l4.earth_el_max_deg': 3.3, 'l4.earth_el_min_deg': -0.7, 'l4.earth_up_pct': 60.0,
        'l4.link_pct_mask0': 55.0, 'l4.link_pct_mask1': 40.0, 'l4.link_pct_mask5': 0.0,
        'l4.example_earth_az': 45.0, 'l4.example_earth_el': 1.3, 'l4.example_earth_clear': -0.5,
        'l5.slope_10m_deg': 4.0, 'l5.slope_100m_deg': 3.0, 'l5.slope_160m_deg': 2.5,
        'l5.plane_a': .04, 'l5.plane_b': .03,
        'l6.site_b': 'fixture_crater', 'l6.a_score': 80.0, 'l6.b_score': 75.0,
        'l6.example_metrics.sun_fraction_mean': .9, 'l6.example_metrics.lit_fraction': .9,
        'l6.example_metrics.longest_dark_h': 2.0, 'l6.example_metrics.link_fraction': .95,
        'l6.example_metrics.longest_blackout_h': 3.0, 'l6.example_metrics.landing_sun_el_deg': 1.5,
        'l6.example_metrics.landing_lit': True, 'l6.example_utilities.slope': 1.0,
        'l6.example_utilities.power': .6, 'l6.example_utilities.comms': .7125, 'l6.example_score': 78.8125,
        'l7.slip_vetoes': ['blackout'], 'l7.slip_blackout_h': 20.0,
        'l8.candidates': ['fixture_ridge','fixture_crater','fixture_edge','fixture_wide'],
        'l8.region_overlap.region_name': 'Synthetic region',
    })
    return WorkedExamples.model_validate(data).model_dump(by_alias=True, mode='json')


def _cases(root, sites, profiles):
    profiles = {p.id:p for p in profiles}
    series = {s['id']:io.read_series(root/'sites'/s['id']/'series.bin', N) for s in sites}
    cases = []
    def add(label, sid, profile, landing, slope, current=None):
        current = landing if current is None else current
        n = scoring.window_length(profile.duration_days)
        start = min(landing, current)
        end = min(N, max(landing+n, current+3000))
        part = {k:v[start:end] for k,v in series[sid].items()}
        local = landing-start
        result = scoring.evaluate(part, profile, local, slope)
        flags = scoring.hour_flags(part, profile)
        countdowns = asdict(scoring.countdowns(part,profile,current-start))
        expected = None if result is None else dict(window_length=n, lit=flags[0][local:local+n].tolist(),
                         link=flags[1][local:local+n].tolist(), evaluation=asdict(result), countdowns=countdowns)
        cases.append(dict(labels=label if isinstance(label,list) else [label], site_id=sid,
            series_file=f'sites/{sid}/series.bin', hour_range=[start,end], profile=profile.model_dump(mode='json'),
            landing_hour=landing, landing_utc=_utc(landing), slope_deg=slope, current_hour=current,
            countdowns=countdowns, expected=expected))
    base = profiles['im2_athena']
    for j in range(30):
        site = sites[j % len(sites)]
        add(['preset_im2_athena', 'sample'],site['id'],base, j*113, None if site['slope'] is None else site['slope']['deg'])
    for name,p in profiles.items():
        add('preset_'+name,'fixture_ridge',p,100,3)
    add('im2_go','fixture_ridge',base,0,3)
    add(['im2_caution','slope_not_assessed'],'fixture_sphere',base,2016,None)
    common = dict(duration_days=2/24, min_sun_fraction=0, max_dark_h=10000,
                  relay_available=True, max_blackout_h=10000, landing_sun_el_min_deg=None,
                  landing_sun_el_max_deg=None, ops_sun_el_min_deg=None)
    p = base.model_copy(update=common)
    add('veto_slope_alone','fixture_ridge',p,0, p.max_slope_deg+1)
    add('veto_landing_sun_low_alone','fixture_ridge',p.model_copy(update={'landing_sun_el_min_deg':50}),0,3)
    add('veto_landing_sun_high_alone','fixture_ridge',p.model_copy(update={'landing_sun_el_max_deg':-50}),0,3)
    sf=series['fixture_ridge']['sun_frac']; dark_start=int(np.flatnonzero((sf[:-1]>=.5)&(sf[1:]<.5))[0])
    add('veto_darkness_alone','fixture_ridge',p.model_copy(update={'min_sun_fraction':.5,'max_dark_h':0}),dark_start,3)
    add('veto_landing_dark_alone','fixture_ridge',p.model_copy(update={'min_sun_fraction':.5}),dark_start+1,3)
    add('veto_blackout_alone','fixture_ridge',p.model_copy(update={'relay_available':False,'antenna_mask_deg':100,'max_blackout_h':0}),0,3)
    add(['relay','max_dark_h_zero'],'fixture_ridge',p.model_copy(update={'max_dark_h':0}),0,3)
    add('slope_not_assessed','fixture_sphere',p,0,None)
    add('operations_sun_elevation','fixture_ridge',p.model_copy(update={'ops_sun_el_min_deg':2}),0,3)
    add('weights_nonunit_zero','fixture_ridge',p.model_copy(update={'weights':Weights(slope=0,power=2,comms=3)}),0,3)
    add('score_go_threshold','fixture_ridge',p.model_copy(update={'weights':Weights(slope=1,power=0,comms=0), 'max_slope_deg':10, 'slope_ideal_deg':0}),0,3)
    add('high_score_with_veto','fixture_ridge',p.model_copy(update={'weights':Weights(slope=0,power=1,comms=1)}),0,p.max_slope_deg+1)
    add('half_hour_window_tie','fixture_ridge',p.model_copy(update={'duration_days':2.5/24}),0,3)
    add('first_hour','fixture_ridge',p,0,3)
    add('last_landing_that_fits','fixture_ridge',p,N-2,3)
    add('one_hour_too_late','fixture_ridge',p,N-1,3)
    return {'format': 'series_file is relative to data/fixtures; hour_range is a half-open slice of the full time grid. landing_hour and current_hour are full-grid indices. expected is null when the window has no result.',
            'generated_by': 'uv run truesouth build-fixtures', 'cases': cases}


def build_fixtures(root=None, cases_path=None):
    root = Path(root) if root is not None else fixtures_dir()
    cases_path = Path(cases_path) if cases_path is not None else repo_root()/'web/src/lib/scoring/__fixtures__/scoring_cases.json'
    root.mkdir(parents=True, exist_ok=True)
    sites = [_site('fixture_ridge','Fixture Ridge',-89.4,222,'core80',3,True),
             _site('fixture_crater','Fixture Crater',-85,20,'core80',8),
             _site('fixture_edge','Fixture Edge',-80.01,4,'core80',12),
             _site('fixture_wide','Fixture Wide',-69,30,'wide240',9),
             _site('fixture_sphere','Fixture Sphere',0,20,'sphere',None)]
    _json(root/'manifest.json', Manifest(schema_version=1, generated_utc=STAMP, time_grid=dict(start_utc=STAMP,step_s=3600,count=N), observer_height_m=C.OBSERVER_HEIGHT_M, skyline_bins=C.SKYLINE_BINS, moon_radius_m=C.MOON_RADIUS_M).model_dump())
    _json(root/'sites.json', Sites.model_validate(sites).model_dump())
    profiles = catalog.load_profiles()
    for name, loader in [('profiles.json',catalog.load_profiles),('features.json',catalog.load_features),('artemis_regions.json',catalog.load_artemis_regions)]:
        loader()
        _json(root/name,json.loads((catalog_dir()/name).read_text(encoding='utf-8')))
    t = np.arange(N, dtype=float)
    io.write_system(root/'system.bin', dict(subsolar_lat=1.5*np.sin(2*np.pi*t/(24*365.25)), subsolar_lon=(360-t*360/708.7)%360,
        subearth_lat=6*np.sin(2*np.pi*t/655.7), subearth_lon=(3*np.sin(2*np.pi*t/655.7))%360,
        earth_dist_km=384400+21000*np.sin(2*np.pi*t/661), sun_dist_km=149600000+2500000*np.sin(2*np.pi*t/(24*365.25))), N)
    for index,site in enumerate(sites):
        folder=root/'sites'/site['id']; folder.mkdir(parents=True, exist_ok=True)
        terrain = None if site['terrain_tier']=='sphere' else dict(size=33,window_km=20.0)
        closeup = dict(size=33,window_km=2.0) if site['has_closeup'] else None
        meta=SiteMeta(site_id=site['id'],series=dict(columns=[c.model_dump() for c in SeriesLayout().arrays]),sun_radius_deg=.266,earth_radius_deg=.95,
                      skyline=dict(bins=C.SKYLINE_BINS,missing_samples=0,max_range_km=300),terrain=terrain,closeup=closeup)
        _json(folder/'meta.json',meta.model_dump())
        sky=_skyline(site,index)
        io.write_skyline(folder/'skyline.bin',sky,C.SKYLINE_BINS)
        io.write_series(folder/'series.bin',_series(sky,index))
        if terrain: io.write_terrain(folder/'terrain.bin',_mesh(33,20),33)
        if closeup: io.write_closeup(folder/'closeup.bin',_mesh(33,2),33)
    maps=root/'maps'; maps.mkdir(exist_ok=True)
    layers={'hillshade':{'files':['hillshade_4k.webp','hillshade_8k.webp']},
            'sunlight':{'files':['sunlight_4k.webp'],'lookup':'sunlight_u8.bin','lookup_size':64},
            'earthvis':{'files':['earthvis_4k.webp'],'lookup':'earthvis_u8.bin','lookup_size':64}}
    _json(maps/'meta.json',MapMeta(projection='south_polar_stereographic',half_width_m=304000,layers=layers).model_dump(exclude_none=True))
    yy,xx=np.mgrid[:64,:64]; grid=((xx+yy)*2).astype('u1')
    for layer in layers.values():
        for filename in layer['files']: Image.fromarray(grid).save(maps/filename,format='WEBP',lossless=True)
        if 'lookup' in layer: io.write_map_lookup(maps/layer['lookup'],grid,64)
    _json(root/'validation.json',_validation())
    _json(root/'academy'/'worked_examples.json',_worked())
    _json(cases_path,_cases(root,sites,profiles))
