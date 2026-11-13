# 0008. Four tiers of terrain data

**Decision.**

| Tier | Data | Covers | Used for |
| :--- | :--- | :--- | :--- |
| `core80` | LOLA 80 m map | 80°S to the pole | Skyline, slope, 3D terrain |
| `wide240` | LOLA 240 m map | 60°S to the pole | Far terrain beyond the core map; sites between 60°S and 80°S |
| close-up | LOLA 5 m maps | A few named sites | Slope at a 100 m baseline; the 2 km close-up view |
| `sphere` | none | Everywhere else | A smooth-Moon horizon, labelled "terrain not modelled" |

**Why.** These are the sizes that download in minutes (about 200 MB each) and cover the
region the challenge is about. Away from the poles the Sun rises steeply, so terrain
shifts sunrise by minutes. The only whole-Moon maps of practical size are too coarse to
give an honest skyline.

**Close-ups do not feed the skyline.** They carry different height adjustments from the
polar maps. Mixing them could create false ridges.

**Not included.** The north pole, and the 20 m and 10 m polar maps (2.7 GB and larger).
