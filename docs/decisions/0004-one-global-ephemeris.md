# 0004. One Horizons pull serves every site

**Decision.** We pull one table from JPL Horizons for the whole time grid: the sub-solar
point, the sub-Earth point, and the distances to the Sun and Earth. Sun and Earth
directions at any site are then exact vector geometry
([`../science.md`](../science.md) §3.2).

**Why.**

- Custom sites need no network call, so the API never depends on Horizons being up.
- Sensitivity grids and the System view need directions at many points. This gives them
  at no extra cost.
- There is one code path for every site.

**How it stays correct.** For every catalog site we also pull Horizons' own site table
and require agreement within 0.02° at every hour (gate G2). That is about two million
comparisons.

**Not yet proven.** This method has not been run. Work package S4 proves it.

**Fallback.** If G2 cannot be met:

1. Check the longitude sign of the sub-points and the light-time convention.
2. If a small steady offset remains, measure it and document it as a known limit.
3. If it still fails, catalog sites take their series from Horizons' own site tables.
   Only custom sites, sensitivity grids and the System view use the vector method, with
   the measured error shown.
