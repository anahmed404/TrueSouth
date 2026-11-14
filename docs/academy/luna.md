# Luna

The Academy's mascot and guide. Luna is a moon character with a face, in the friendly,
rounded spirit of a language-app mascot. She is our own original design.

Owner: Academy track. Folder: `web/src/components/luna/`.

## Status

**Luna's facial expressions are adapted from a reference sheet the team supplied on
2026-11-14** (work package A10): a sheet of eight poses of a round moon character, made by
the team with Google Gemini, an AI image tool. The sheet is not in the repository and not
used in the app. Claude Code drew the faces by hand in SVG, adapting only the faces from
that sheet. Her body, her grey, her size, her craters and her movement are unchanged from
the first drawing; she has no arms, legs, floor shadow or glow.

Swapping her art must need no code change outside `web/src/components/luna/art/`.

## Her look

- **Body:** a flat grey moon with a darker rim and a few craters. The craters drop below
  72 px so the face stays readable.
- **Eyes:** large and glossy, a cream white with a dark outline, a dark iris and two
  catch-lights. The catch-lights belong to the eyes, so a blink squashes them too. Where
  the eyes are closed (happy) she does not blink.
- **Mouth and brows:** thick dark lines or filled shapes, readable at 28 px.
- **Extras:** cheeks, sparkles, hearts, a music note, the "z". They drop below 40 px, where
  they would only be specks; the eyes and mouth carry the mood alone. A welling tear is part
  of the eyes, so it stays at every size.
- **Colours:** only the `--luna-*` theme tokens: feature (dark lines), sparkle (eye whites,
  catch-lights, sparkles, the "z"), tear (tears, the music note) and blush (cheeks, tongue,
  hearts: a muted dusty rose, never the NO-GO red). No yellow: in this app yellow means the
  Sun.

## The component

```tsx
<Luna mood="happy" size={96} />
<LunaSays mood="thinking">The Sun is only 1.2° up. Will Pip see it?</LunaSays>
```

- `Luna` draws the character in one mood.
- `LunaSays` draws Luna with a speech bubble.
- Art is SVG, one file per mood, with shared part names so moods can blend.
- Movement uses Motion: a gentle idle bob, a blink every few seconds, and a short
  transition between moods.
- With "reduce motion" on, Luna changes mood without animating.

## Moods

| Mood | Used when | Her face (sheet pose) |
| :--- | :--- | :--- |
| `idle` | Waiting for the learner | Humming: eyes up and aside, a small "o" mouth, one music note (pose 6) |
| `happy` | Greeting, introducing an idea | Eyes closed in smiling arcs, a small smile, cheeks, two sparkles (pose 2) |
| `thinking` | Asking a question | Eyes up to one side, one brow raised, the tip of the tongue out, two thought dots (pose 4) |
| `cheering` | A correct answer; lesson complete | Wide round eyes, a big open smile, two sparkles (pose 1) |
| `worried` | A wrong answer; Pip in danger | Large wet eyes with a tear welling, worried brows, a small frown (pose 8) |
| `surprised` | A reveal that overturns a guess | Pose 1's wide eyes, raised brows, a small round mouth, no smile |
| `sleepy` | Pip is in darkness | Heavy half-closed lids, a short flat mouth, a "z" (pose 3) |
| `proud` | Awarding a mission patch | Beaming: an open smile, cheeks, two small hearts (pose 5) |

The sheet's angry pose (7) is not used: Luna never scolds a learner.

## Where Luna appears

- Every lesson step, with her line for that step.
- The path map, standing at the next unfinished lesson.
- The lesson-complete screen.
- The start screen, beside the Academy door.
- Mission Control's empty and error states, small and quiet. She does not otherwise appear
  in Mission Control.

## How Luna talks

- One idea per bubble. Two short sentences at most.
- Warm and curious. She is working it out with the learner, not testing them.
- She never mocks a wrong answer. A miss gets a hint, then an explanation.
- She explains a technical word the first time she uses it.
- She speaks as the Moon when it helps: "My south pole is a strange place."
- No exclamation marks in every line. Save them for real wins.

Examples:

> "At my equator the Sun climbs right overhead. At my south pole it barely gets above 2°, even in the best season.
> Let's see why."

> "Not quite. Think about how far away that ridge is. Want to try again?"

> "You found it. Pip lands in sunlight with Earth in view."

## Pip

Pip is the lander in the story. Pip does not talk. Pip appears as:

- A small lander icon in lesson scenes and on maps.
- Two meters in the lesson header: power and link.

Pip's art is a simple original lander drawing. It must not copy a real company's lander.

## Done when

- All eight moods exist and switch smoothly.
- `Luna` and `LunaSays` are used by every lesson step.
- Replacing the files in `art/` changes Luna everywhere with no other edits.
- Luna is readable from 28 px to 160 px.
