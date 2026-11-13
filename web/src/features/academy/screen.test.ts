import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { LESSONS } from "./catalog";
import AcademyRoutes from "./index";

function render(lessonId?: string): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(AcademyRoutes, { lessonId })),
  );
}

describe("academy screens", () => {
  it("lists the eight lessons, XP and mission patches", () => {
    const html = render();
    expect(html).toContain("XP: 0");
    expect(html).toContain("Mission patches: none");
    for (const lesson of LESSONS) {
      expect(html).toContain(lesson.title.replaceAll("'", "&#x27;"));
      expect(html).toContain(`/academy/${lesson.id}`);
    }
    expect(html).toContain("Sample lesson");
    expect(html).toContain("A5 replaces.");
  });

  it("renders the sample lesson with its placeholder filled", () => {
    const html = render("sample");
    expect(html).toContain("Which label is alpha?");
    expect(html).not.toContain("{{example.");
    expect(html).toContain("Step 1 of 8");
    expect(html).toContain("Check");
    expect(html).toContain("Pip power: 80%");
    expect(html).toContain("Pip: link");
  });

  it("says when a catalog lesson is not written yet", () => {
    const html = render("l1_sun");
    expect(html).toContain("Where&#x27;s the Sun?");
    expect(html).toContain("This lesson is not written yet.");
  });
});
