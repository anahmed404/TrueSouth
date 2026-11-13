# 0003. Directions use each site's own local frame

**Decision.** Every azimuth in TrueSouth is measured clockwise from north at the site, in
a frame of east, north and up. Skylines, series, the Lander's eye view and the 3D terrain
all use it. The terrain mesh is resampled onto a site-centred grid.

**Why.** The first plan worked in the polar map's grid and converted every azimuth with
`grid azimuth = azimuth + longitude`. That formula is correct; we checked it against real
Horizons data. But it appeared in six places and was the easiest thing in the project to
get wrong. Working in the local frame removes it. Horizons already reports directions in
this frame, so its numbers can be compared with ours directly.

**Cost.** The mesh is resampled once per site, which is cheap.

**Kept.** The relation survives as a test: Earth's azimuth at Connecting Ridge should sit
near 360° minus the site's longitude.
