/*
  THE ART SEAM. Luna's look lives in this folder and nowhere else.

  This file exports `lunaArt`, one value of type `LunaArtSet` (see ../art-contract.ts).
  Every component in ../ draws Luna only from it. To change Luna's look everywhere,
  replace the files in this folder; keep this file exporting `lunaArt` with an entry for
  every mood in ../moods.ts. TypeScript and ../luna.test.ts fail if one is missing.

  Rules for art in this folder:
  - SVG elements only, in the `viewBox` below. One file per mood.
  - Split each mood into the shared parts (brows, eyes, mouth, extras). Parts with the
    same name cross-fade when the mood changes; the body stays still.
  - Colours from theme tokens only (Tailwind `fill-*`/`stroke-*` classes), no literals.
  - Give each mood a `label`: the text alternative a screen reader reads.
  - Keep eyes and mouth thick enough to read at 28 px. Fine surface detail goes in
    `detail` (dropped below 72 px); decoration goes in `extras` (dropped below 40 px).
    Anything the mood needs at every size (a welling tear) belongs to the eyes or mouth.

  The faces are adapted from a reference sheet the team supplied on 2026-11-14 (work
  package A10). The body and craters are still the first drawing.
*/
import type { LunaArtSet } from "../art-contract";
import { body, detail } from "./body";
import { cheering } from "./cheering";
import { happy } from "./happy";
import { idle } from "./idle";
import { proud } from "./proud";
import { sleepy } from "./sleepy";
import { surprised } from "./surprised";
import { thinking } from "./thinking";
import { worried } from "./worried";

export const lunaArt: LunaArtSet = {
  viewBox: "0 0 100 100",
  body,
  detail,
  moods: { idle, happy, thinking, cheering, worried, surprised, sleepy, proud },
};
