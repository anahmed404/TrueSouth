"""Run from the repo root: uv run python docs/reviews/a9-scripts/boundaries.py."""
import json
import subprocess
from pathlib import Path

import numpy as np

from truesouth.contracts import MissionProfile
from truesouth.scoring import countdowns, evaluate

root = Path(__file__).resolve().parents[3]
profile = json.loads((root / 'data/fixtures/profiles.json').read_text(encoding='utf-8'))[0]
profile.update(duration_days=1 / 24, min_sun_fraction=.5,
               ops_sun_el_min_deg=None, max_dark_h=0, max_blackout_h=0,
               relay_available=False, antenna_mask_deg=1,
               max_slope_deg=10, slope_ideal_deg=2,
               landing_sun_el_min_deg=None, landing_sun_el_max_deg=None,
               weights=dict(slope=0, power=1, comms=0))
series = dict(sun_frac=[7000 * .0001] * 16, sun_el=[1.] * 16,
              earth_clear=[1.] * 16)
parsed = MissionProfile.model_validate(profile)
arrays = {k: np.array(v) for k, v in series.items()}
for i in (0, 15):
    result = evaluate(arrays, parsed, i, None)
    print(f'Python hour {i}: independent score 70; '
          f'code {result.score:.17g}, {result.status}')

# Run the actual browser implementation, with only its types stripped.
js = """
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const source=fs.readFileSync('web/src/lib/scoring/scoring.ts','utf8');
const sc=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(source)));
for(const i of [0,15]) {
 const r=sc.evaluate(input.series,input.profile,i,null);
 console.log(`TypeScript hour ${i}: independent score 70; code ${r.score}, ${r.status}`);
}
"""
subprocess.run(['node', '--input-type=module', '-e', js], cwd=root,
               input=json.dumps(dict(profile=profile, series=series)),
               text=True, check=True)

profile.update(duration_days=2 / 24, ops_sun_el_min_deg=1.25)
short = dict(sun_frac=np.array([.4, .6]), sun_el=np.array([2., 1.]),
             earth_clear=np.array([2., 2.]))
print('Independent sub-hour lit interval: 0.5 to 0.75 hours (15 minutes).')
print('Hourly countdowns:', countdowns(short, MissionProfile.model_validate(profile), 0))
profile['weights'] = dict(slope=1, power=0, comms=0)
parsed = MissionProfile.model_validate(profile)
print('Contract accepts power=comms=0; slope is not assessed:')
try:
    evaluate(short, parsed, 0, None)
except ValueError as error:
    print(type(error).__name__ + ': ' + str(error))
