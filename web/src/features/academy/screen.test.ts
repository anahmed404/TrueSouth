import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { LESSONS } from "./catalog";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { HookResult } from "../../data/hooks";
import AcademyRoutes, { WrittenLesson } from "./index";
import { lesson1 } from "./lessons/l1";
import { lesson4 } from "./lessons/l4";
import { missingExampleKeys } from "./validate";
import { sampleProfile } from "./lessons/sample-profile";
import type { Lesson } from "./types";

function render(lessonId?: string, playable?: Lesson): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(AcademyRoutes, { lessonId, playable })),
  );
}

describe("academy screens", () => {
  it("draws the path: eight stops, the totals, the nine patches and Reset progress", () => {
    const html = render();
    expect(html).toContain("Land Pip at the south pole");
    for (const [index, lesson] of LESSONS.entries()) {
      expect(html).toContain(`Lesson ${index + 1}, ${lesson.title.replaceAll("'", "&#x27;")}`);
    }
    expect(html).toContain("of 24 stars");
    expect(html).toContain("of 9 patches");
    expect(html).toContain("True South patch, not earned yet");
    expect(html).toContain("Reset progress");
    expect(html).toContain("Start lesson 1");
    expect(html).toContain("Skip to Mission Control");
  });

  it("opens lessons 1 to 4 from the path, keeps 5 to 8 marked not written, and no longer sends people to the sample", () => {
    const html = render();
    expect(html).not.toContain("/academy/sample");
    expect(html).not.toContain("the sample lesson");
    expect(html).toContain("Lessons 1 to 4 are ready");
    expect(html).toContain("Five short steps. Earns the Sun Chaser patch.");
    for (const [index, lesson] of LESSONS.entries()) {
      const label = `Lesson ${index + 1}, ${lesson.title.replaceAll("'", "&#x27;")}`;
      if (index < 4) expect(html).not.toContain(`${label}, not written yet`);
      else expect(html).toContain(`${label}, not written yet`);
    }
    expect(html.match(/Not written yet</g)?.length).toBe(4);
  });

  it("opens the sample lesson on its first step with placeholders filled", () => {
    const html = render("sample");
    expect(html).not.toContain("{{example.");
    expect(html).toContain("Step 1 of 8");
    expect(html).toContain("Which of these stands straight up from the ground?");
    expect(html).toContain("90.0°"); // the filled {{example.sample.right_angle_deg}}: angles keep one decimal
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Check");
    expect(html).toContain("Pip&#x27;s power: 80%");
    expect(html).toContain("Link");
    expect(html).toContain("Under the hood");
  });

  it("says plainly when a catalog lesson is not written yet", () => {
    const html = render("l5_slope");
    expect(html).toContain("Don&#x27;t tip over");
    expect(html).toContain("This lesson is not written yet.");
  });

  it("opens a written lesson once its numbers have loaded, and says so plainly while they load", () => {
    const html = render("l1_sun");
    expect(html).toContain("1 · Where&#x27;s the Sun?");
    expect(html).toContain("Getting this lesson&#x27;s numbers ready…");
    expect(html).not.toContain("This lesson is not written yet.");
  });

  it("says when there is no such lesson", () => {
    expect(render("nope")).toContain("There is no lesson with the id");
  });

  it("shows the unwritten lesson instead of crashing when a date is not UTC", () => {
    const bad: Lesson = {
      id: "bad-date",
      title: "Bad date",
      tagline: "A date that is not UTC.",
      patch: { name: "Bad", art: "bad" },
      unlocks: "SystemView",
      recap: "Bad.",
      card: "bad",
      steps: [
        {
          id: "drag",
          luna: { mood: "thinking", says: "Drag." },
          hint: "A hint.",
          explain: "Because.",
          kind: "drag-body",
          body: "sun",
          panel: "LandersEye",
          scene: {
            scenario: {
              profile: sampleProfile,
              siteIds: ["sample-site"],
              focusedSiteId: "sample-site",
              landingUtc: "2026-01-02T00:00:00",
              currentUtc: "2028-01-01T00:00:00Z",
            },
            skyline: "flat",
            timeRange: null,
          },
          goal: { metric: "sun_el_deg", op: "==", value: 1 },
        },
      ],
    };
    const html = render("bad-date", bad);
    expect(html).toContain("This lesson is not written yet.");
  });
});

describe("a written lesson and its worked examples", () => {
  const real = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../../../data/derived/academy/worked_examples.json", import.meta.url)), "utf8"),
  ) as Record<string, unknown>;

  function open(worked: HookResult<unknown>): string {
    return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WrittenLesson, { lesson: lesson1, worked })));
  }

  const clean = (html: string) => {
    expect(html).not.toContain("{{");
    expect(html).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/);
  };

  it("opens on the real numbers with every placeholder filled", () => {
    const html = open({ status: "ready", data: real, error: null });
    expect(html).toContain("Step 1 of 5");
    expect(html).toContain("How high does it get at my south pole?");
    clean(html);
  });

  it.each([
    ["missing", (values: Record<string, unknown>) => { const copy = { ...values }; delete copy["l1.sun_el_max_deg"]; return copy; }],
    ["null", (values: Record<string, unknown>) => ({ ...values, "l1.sun_el_max_deg": null })],
    ["NaN", (values: Record<string, unknown>) => ({ ...values, "l1.sun_el_min_deg": Number.NaN })],
    ["empty text", (values: Record<string, unknown>) => ({ ...values, "l1.example_utc": "" })],
  ])("says plainly that numbers are not built when a key is %s", (_, change) => {
    const html = open({ status: "ready", data: change(real), error: null });
    expect(html).toContain("Some of this lesson&#x27;s numbers are not built yet, so it cannot start.");
    clean(html);
  });

  it("says plainly when the numbers failed to load, and while they load", () => {
    const failed = open({ status: "error", data: null, error: "404" });
    expect(failed).toContain("This lesson&#x27;s numbers did not load");
    clean(failed);
    expect(open({ status: "loading", data: null, error: null })).toContain("Getting this lesson&#x27;s numbers ready…");
  });

  it("lists exactly the keys a lesson needs that have no usable value", () => {
    expect(missingExampleKeys(lesson4, real)).toEqual([]);
    expect(missingExampleKeys(lesson4, { ...real, "l4.link_pct_by_mask": [] })).toEqual(["l4.link_pct_by_mask"]);
  });
});
