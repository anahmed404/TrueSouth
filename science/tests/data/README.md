# Horizons G1 and G2 samples

Real JPL Horizons API responses fetched during S4 on 2026-11-13. JSON `result`
includes the original header, column descriptions, service timestamp and source
identifiers. Requests use hourly UTC calendar dates and CSV observer tables.

- `horizons_global.json`: Moon (301), Earth centre (500@399), quantities
  14,15,19,20, 2026-01-01T00:00:00Z through 2026-01-04T00:00:00Z inclusive.
  This probe predates the explicit `EXTRA_PREC=YES` request; the sub-point and
  range values agree with the full production response after Float32 encoding.
- `horizons_connecting_ridge_{sun,earth}.json`: quantity 4 from the documented
  site, altitude 0.002 km, for those same 73 hours, `APPARENT=AIRLESS`,
  `EXTRA_PREC=YES`. These were fetched as three-day probes.
- `horizons_{apollo11,change4}_{sun,earth}.json`: first 73 data rows of each
  full-grid G2 response. Only the data block is trimmed. The original header
  (including its full-grid stop time) and footer remain unchanged; the rows
  themselves specify the retained interval. Full raw responses are cached
  outside the repository under `raw_dir() / "horizons"`.
- `horizons_global_west.json`: **deliberately hand-edited sign fixture**, not a
  second real observation. Horizons has no switch for west-positive lunar
  output. Its target header and both sub-point column definitions say west
  instead of east, while printed numeric values are unchanged. The expected
  parser result is therefore the negated longitude modulo 360. This isolates
  the conversion and tests that the sign comes from the response.

The parser also rejects unknown lunar frames, inconsistent sign declarations,
missing ranges/units, nonfinite values, API errors and non-hourly timestamps.
G2 uses Float32-quantised global values, ground height zero plus the same 2 m
observer height in both methods, and the exact 0.02° gate in science.md §3.3.
No network is accessed by the tests.
