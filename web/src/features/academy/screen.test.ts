import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { LESSONS } from "./catalog";
import AcademyRoutes from "./index";
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
    expect(html).toContain("/academy/sample");
    expect(html).toContain("Skip to Mission Control");
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
    const html = render("l1_sun");
    expect(html).toContain("Where&#x27;s the Sun?");
    expect(html).toContain("This lesson is not written yet.");
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
