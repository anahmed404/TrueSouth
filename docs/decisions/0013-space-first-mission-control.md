# 0013. Mission Control is space-first

**Decision.** The home of Mission Control is a 3D scene of the Sun, Earth and Moon: the
System view. It fills the window, and the interface floats above it in the layout the team
lead approved earlier the same day. A floating view bar picks the view, and the camera does
the switching:

| View | What happens |
| :--- | :--- |
| System view | Home. The camera looks at the whole scene. |
| Polar map | The camera flies to the south pole, and the flat map takes over. |
| Local terrain | The camera continues down to the focused site. |
| Lander's eye | The camera drops to 2 m above the ground. |
| Slip Planner | Opens as a floating window over the scene. The camera stays put. |
| Compare | Opens as a floating window over the scene. The camera stays put. |

The team lead decided this on 2026-11-13. It replaces the docked layout approved earlier
the same day.

In the team lead's words: "I want the main view to be the system view for the mission
control which will be a 3d view of the sun moon and earth. We should probably have a
texture for the earth and a good looking sun. I want the UI elements to kind of 'float'
above the space view so basically keep the same layout but make the space view in the
background and have the UI above it. If we want to change views, we can have a top
floating bar that picks views, similar to the existing one, and it could do an animation
to zoom into the south pole of the moon and switch to the polar view mode for example, for
something like the slip planner we could open a floating modal in front of the user and so
on."

**Why.** The Moon is the subject of the whole product. A planner who starts on the System
view sees where the site is on the Moon, where the Sun is and where Earth is, before any
number. Each later view then reads as a closer look at the same place, because the camera
travels there. In the docked layout the 3D scene was one tab among six and competed with
five flat views for the same rectangle.

A working prototype exists:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md), with
screenshots in `docs/design/c2/space-*.png`. The specs below were written from it.

**What it changes.**

- **The home view.** The System view is always behind the interface, not a tab. The
  timeline's current time moves the Sun and Earth in it.
- **Navigation.** One floating view bar replaces the six tabs. Four of its entries move the
  camera; two open floating windows. Local terrain is no longer a separate screen: it is the
  scene with the camera low over the site.
- **Panels.** Each panel floats with a 16 px margin and is only as tall as its content. The
  side panels and the timeline fold away, so the scene can fill the window.
- **Panels are solid.** Not see-through. The prototype's see-through option had to turn
  almost solid over a bright Moon to keep text readable, so it showed the scene only where
  there was nothing to see.
- **The move to the pole is one continuous camera flight.** With "reduce motion" on it is a
  short cross-fade.
- **Textures.** A sharp Moon: NASA's colour map of the whole Moon (4K by default, 8K
  optional), NASA's height map for relief along the day/night line, and, over the south
  polar cap, TrueSouth's own shaded relief and slope map made from NASA's 80 m terrain map.
  Earth uses NASA's Blue Marble texture. The Sun is drawn in code. No AI-generated imagery;
  NASA images are only resized and re-encoded. This replaces "2K then 4K" in the System
  view spec.
- **Local terrain.** The 20 km patch sits inside the surrounding terrain, out to a curved
  horizon. The earlier "disc" look (a mesh with a skyline wall around it) is rejected.
- **Fallback.** When WebGL is missing or slow, a still picture replaces the scene and every
  other part of the interface still works. Rendering pauses when nothing moves and when the
  tab is hidden.
- **`DESIGN.md`.** The rule "nothing floats over the main view" is replaced. Text over the
  scene sits on a plate, and the scene's Sun is a named exception to the No Glow Rule.
- **The build plan.** The scene (T1 and T2) comes first and is the base of Mission Control.
  A shell package floats the existing panels over it. A new Science package makes the
  scene's image files. See [`../build-plan.md`](../build-plan.md).

**What it does not change.**

- **Results come from the Python-computed series, never from the 3D shadows.** "WebGL
  shadows are decoration, never a result." Sight-line colours, pin colours and every
  "lit" or "dark" label come from the evaluation hooks.
- "Distances not to scale. Every direction is true." stays on screen in the System view.
- Sourced-or-assumed tags, UTC times, degrees, and the one clock.
- The approved look: neutral dark, no purple, no glow or glass on the interface, sentence
  case, Jost, the status lamps.
- The content of the focused-site panel, the sites rail, the timeline, the countdowns, the
  profile picker, the notices and the share link.
- The Academy.

**Out of scope for the deadline.** Their specs stay; they are not built:

- custom sites and "compute for my dates" (work package T8, and the custom-site job queue in
  S10);
- the sensitivity grid (S11);
- Academy lessons 5 to 8 (A6).

**Considered.**

- *The docked layout with a centre view area and six tabs.* The team lead approved it
  earlier on 2026-11-13, and it was built (MC4a and MC4b). It is replaced, not rejected on
  merit: it kept the Moon in a box and made the System view one of six equals. The built
  panels are kept; only the shell around them changes.
- *See-through panels.* Rejected, as above. Solid panels are calmer, need no contrast
  probe, and still float because of the margins and the scene around them.
- *A cross-fade for the move to the pole.* Kept only as the reduced-motion path. The flight
  shows where the map is on the Moon.
- *8K Moon texture as the default.* Rejected. It triples the Moon's weight, and at home zoom
  it looks the same as 4K. The pole zoom is what needed the sharper data, and the polar cap
  images supply it.

**The original wording,** for the record, from `docs/features/mission-control.md`:

> - **Top bar.** Mode switch, profile picker, landing-date picker, share menu.
> - **Sites rail.** Selected sites, each with a status chip for the current landing date.
>   Click to focus. Up to 8 sites.
> - **Main view.** One view at a time. A "split" toggle shows two views side by side.
> - **Focused-site panel.** Status, vetoes, every metric, slope with its baseline, links out
>   to Quickmap and Moon Trek.
> - **Bottom strip.** Timeline and countdowns.

and from `DESIGN.md`: "Panels sit 8px apart, and nothing floats over the main view." and
"Don't float panels or cards over the main view."
