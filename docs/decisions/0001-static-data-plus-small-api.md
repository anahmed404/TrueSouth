# 0001. Static data for catalog sites, a small API for the rest

**Decision.** Catalog sites are computed ahead of time and shipped as static files. A
small Python API computes custom sites and sensitivity grids on demand. The web app works
fully for catalog sites when the API is down.

**Why.** A demo must not depend on a live service. Static files load fast and can be
hosted anywhere. Custom coordinates still need real terrain work, which a browser cannot
do with 400 MB of maps.

**Considered.** Fully static: custom sites would have no terrain. Everything through the
API: every slider change would wait on a request, and an outage would break the demo.
