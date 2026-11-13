# 0006. The Sun and Earth are discs, not dots

**Decision.** For every hour we compute the share of each body's disc that is above the
skyline, from 0 to 1 ([`../science.md`](../science.md) §6). A mission profile sets how
much of the Sun counts as lit.

**Why.** At the pole the Sun can sit half-hidden behind a ridge for hours. Treating it as
a dot turns that into a hard on or off and shifts sunrise and sunset. NASA's own maps
treat both bodies as discs, so this also lets us compare like with like.

**Earth link.** A link uses the clearance of Earth's centre above the skyline, compared
with the antenna mask. That is simpler to explain than a disc share. Earth's disc share
is still stored and used for validation.
