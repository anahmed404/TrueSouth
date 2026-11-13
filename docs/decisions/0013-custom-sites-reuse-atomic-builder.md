# 0013. Custom sites share the catalog builder

**Decision (2026-11-13, S10b).** Extract the catalog's per-site computation and
atomic publication into build_sites.build_site, and call it from the API. Keep
one in-process FIFO worker and use completed directories as the only durable state.
A site.json beside each completed custom site's artifacts preserves its Site entry.
Coordinates are rounded before computing so cache contents do not depend on which
request arrived first. Names are display text and the first successful name wins.

**Trade-offs.** Queued work is lost on restart and an id never expires automatically.
This is intentionally a single-process service, not a multi-worker deployment.
Custom site tiers follow the catalog latitude rule, including at square raster
corners. Ray sampling still follows actual coverage. This supersedes the initial
S10b coverage-based site labels after PR review. Custom
entries use the existing contrast group, an empty source_url and a description that
identifies coordinates as entered by the user. No new group or terrain tier is added.

**Runtime.** Rasterio moves to the prepare extra and is imported only inside
prepare_map. Development still installs it for raster tests. The production runtime
can read prepared .npy maps without GDAL. Map opening and heavy science imports are
lazy; a catalog-only server starts without them. No formulas change.
