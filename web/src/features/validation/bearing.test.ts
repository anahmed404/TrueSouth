import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Site, Validation } from "../../contracts/generated.ts";
import { ValidationView } from "./index";
import { rawBearingNote } from "./model";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readJson = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}${path}`, "utf8")) as T;
const real = readJson<Validation>("data/derived/validation.json");
const sites = readJson<Site[]>("data/derived/sites.json");
const g2Detail = real.gates.find((gate) => gate.id === "G2")!.detail!;

describe("G2's raw compass-bearing note", () => {
  it("quotes the file's own sentences about the raw bearing, word for word", () => {
    const note = rawBearingNote(g2Detail)!;
    expect(note).toBe(
      "raw: max 0.0823560453039 deg at apollo11/sun 2031-10-14T01:00:00Z. " +
        "Raw compass azimuth is diagnostic only: 28 site/body hours above 0.02 deg; daily chart uses full sky separation.",
    );
    // Every quoted sentence is in the file as written.
    for (const sentence of note.split(/(?<=\.)\s+(?=[A-Za-z])/)) expect(g2Detail).toContain(sentence);
  });

  it("gives nothing when the note does not mention it", () => {
    expect(rawBearingNote("Synthetic demonstration; not an actual validation run.")).toBeNull();
    expect(rawBearingNote(null)).toBeNull();
  });

  it("shows the note in the open, right under the G2 headline, before any disclosure", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ValidationView, { validation: { status: "ready", data: real, error: null }, sites }),
      ),
    );
    const section = markup.slice(markup.indexOf('id="sun-and-earth"'), markup.indexOf('id="terrain"'));
    const headline = section.indexOf("vl-headline-text");
    const quote = section.indexOf("raw: max 0.0823560453039 deg");
    const firstDisclosure = section.indexOf("<details");
    expect(headline).toBeGreaterThan(-1);
    expect(quote).toBeGreaterThan(headline);
    expect(quote).toBeLessThan(firstDisclosure);
    expect(section).toContain("it is not gated");
    expect(section.slice(0, quote)).toContain("<blockquote");
  });
});
