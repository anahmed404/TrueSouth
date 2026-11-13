# 0005. Skyline: rays nearby, every pixel far away

**Decision.** A skyline has 1,440 bins of 0.25°. Terrain nearer than the switch distance
(18.3 km on the 80 m map) is sampled along rays. Terrain from there to 300 km is handled
by visiting every map pixel and keeping the highest elevation angle per bin. Details are
in [`../science.md`](../science.md) §5.

**Why.** Rays alone miss narrow peaks far away: at 150 km two neighbouring rays are 650 m
apart and a pixel is 80 m. Pixels alone leave gaps nearby, where one pixel is wider than a
bin. Each method is used where it is sound, and they must agree where they meet (gate G6).

**Why 0.25°.** The Sun's disc is 0.53° wide. Two bins across it lets us compute how much
of the disc a ridge hides.

**Why 300 km.** Terrain 8 km above the observer drops below the horizon at 167 km. 300 km
leaves a wide margin.

**Considered.** A coarser, max-pooled map for far terrain. It is faster, but it raises
the skyline by up to 0.13°, which is half the Sun's radius.
