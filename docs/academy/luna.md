# Luna

The Academy's mascot and guide. Luna is a moon character with a face, in the friendly,
rounded spirit of a language-app mascot. She is our own original design.

Owner: Academy track. Folder: `web/src/components/luna/`.

## Status

**Luna is a placeholder until the end.** The app uses a simple round moon with two eyes, a
mouth and a few craters. Her final design is a polish task in the last milestone (work
package A10), using reference photos from the team lead. Do not spend effort on her look
before then.

Build everything against the placeholder. Swapping in final art must need no code change
outside `web/src/components/luna/art/`.

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

| Mood | Used when |
| :--- | :--- |
| `idle` | Waiting for the learner |
| `happy` | Greeting, introducing an idea |
| `thinking` | Asking a question |
| `cheering` | A correct answer; lesson complete |
| `worried` | A wrong answer; Pip in danger |
| `surprised` | A reveal that overturns a guess |
| `sleepy` | Pip is in darkness |
| `proud` | Awarding a mission patch |

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

- All eight moods exist as placeholder art and switch smoothly.
- `Luna` and `LunaSays` are used by every lesson step.
- Replacing the files in `art/` changes Luna everywhere with no other edits.
- Luna is readable at 48 px and at 160 px.
