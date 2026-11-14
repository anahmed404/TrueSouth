# 0017. A popover's background is 99 % opaque, not 100 %

**Decision (2026-11-14, MC rail overlays).** `.popover` paints its background as
`color-mix(in srgb, var(--raised) 99%, transparent)` instead of `var(--raised)`.

**Why.** This fixes "the black box": a box of the 3D scene beside the open add-site list
showing the page colour (`--space`) instead of the Moon. It appears only when Chrome
composites in software (`chrome://gpu` says "Compositing: Software only"). That happens on a
laptop whose GPU compositing is off or blocklisted. Here it was reproduced with installed Chrome
157, `--force-device-scale-factor=1.25`, a 1522 × 731 CSS viewport and either
`--disable-gpu-compositing` or `--use-angle=d3d9`. The box was CSS x up to 326 and y 62 to 318,
and it grew when a row was hovered, as the team lead saw. Chrome's own screenshot showed it too,
so the fault is inside Chrome's compositor, not the operating system's.

The panel is a scroller with an opaque background, and its list is 1,570 px tall. Chrome treats
such a scroller as covering what is under it, and the software compositor then gets the covered
region wrong. Tested one at a time, the box went away with a 99 % background, with
`overflow: visible`, with `scrollbar-gutter: stable`, and with the scroll moved to an inner
element. It stayed with no shadow, no radius, `isolation`, `contain: paint`, `translateZ(0)`,
`preserveDrawingBuffer: true`, and fresh WebGL frames on every popover change.

**Trade-offs.** 1 % of the scene shows through the panel, which cannot be seen. A scroller that
is not opaque may lose subpixel (LCD) text antialiasing on a low-density screen; the captures
showed no visible difference. Any new opaque scrolling panel over the scene may need the same
treatment. Under software compositing, no other panel showed a box.
