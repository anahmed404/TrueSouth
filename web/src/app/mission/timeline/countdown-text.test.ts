import { describe, expect, it } from "vitest";
import { earthCountdown, formatWait, noneBefore, sunCountdown, waitParts } from "./countdown-text";
import { stretchNow } from "./countdowns";

const END = "2031-12-31T23:00:00Z";
const none = { sunset: null, sunrise: null, earthset: null, earthrise: null };

describe("formatWait", () => {
  it("writes hours and two-digit minutes under 48 hours", () => {
    expect(formatWait(2 + 58 / 60)).toBe("2 h 58 m");
    expect(formatWait(31 + 20 / 60)).toBe("31 h 20 m");
    expect(formatWait(6 + 5 / 60)).toBe("6 h 05 m");
    expect(formatWait(47.999)).toBe("47 h 59 m");
  });

  it("writes days and hours from 48 hours", () => {
    expect(formatWait(48)).toBe("2 d 0 h");
    expect(formatWait(6 * 24 + 1.5)).toBe("6 d 1 h");
    expect(formatWait(9 * 24 + 3.99)).toBe("9 d 3 h");
  });

  it("cuts down, never up, so a wait under a limit never prints as the limit", () => {
    expect(formatWait(5.9999)).toBe("5 h 59 m");
    expect(formatWait(6)).toBe("6 h 00 m");
    expect(waitParts(1 - 1e-9)).toEqual([
      { value: "1", unit: "h" },
      { value: "00", unit: "m" },
    ]);
  });

  it("handles 0 minutes", () => {
    expect(formatWait(0)).toBe("now");
    expect(formatWait(0.5 / 60)).toBe("under a minute");
    expect(formatWait(1 / 60)).toBe("0 h 01 m");
  });

  it("says when no change falls on the grid", () => {
    expect(noneBefore(END)).toBe("None before 2032");
  });
});

describe("sunCountdown", () => {
  it("counts down to sunset while lit and to sunrise while dark", () => {
    const cd = { ...none, sunset: 20 + 13 / 60, sunrise: 2 + 58 / 60 };
    expect(sunCountdown(cd, true, END)).toMatchObject({
      state: "Lit",
      event: "sunset",
      sentence: "Sunset in 20 h 13 m",
      soon: false,
    });
    expect(sunCountdown(cd, false, END)).toMatchObject({
      state: "Dark",
      event: "sunrise",
      sentence: "Sunrise in 2 h 58 m",
      soon: true,
    });
  });

  it("turns amber under 6 hours, not at exactly 6", () => {
    expect(sunCountdown({ ...none, sunset: 6 }, true, END).soon).toBe(false);
    expect(sunCountdown({ ...none, sunset: 5.99 }, true, END).soon).toBe(true);
    expect(sunCountdown({ ...none, sunset: 0 }, true, END)).toMatchObject({ soon: true, sentence: "Sunset now" });
  });

  it("says none when no change falls before the end of the grid", () => {
    expect(sunCountdown(none, true, END)).toMatchObject({ hours: null, soon: false, sentence: "Sunset: none before 2032" });
  });
});

describe("earthCountdown", () => {
  it("counts down to Earthset with a link and to Earthrise in a blackout", () => {
    const cd = { ...none, earthset: 4 * 24 + 2.5, earthrise: 9 * 24 + 3.2 };
    expect(earthCountdown(cd, true, false, END)).toMatchObject({ state: "Link", sentence: "Earthset in 4 d 2 h" });
    expect(earthCountdown(cd, false, false, END)).toMatchObject({ state: "Blackout", sentence: "Earthrise in 9 d 3 h" });
  });

  it("has no Earth countdown with a relay (docs/science.md §9)", () => {
    const view = earthCountdown(none, true, true, END);
    expect(view.event).toBeNull();
    expect(view.hours).toBeNull();
    expect(view.soon).toBe(false);
  });
});

/** Numbers and units are joined by a narrow no-break space, as in `NumberUnit`. */
const h = (n: number) => `${n} h`;

describe("stretchNow", () => {
  //                     0  1  2  3  4  5  6  7  8  9
  const lit = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 1, 0, 0]);

  it("measures the dark stretch around the current hour inside the window", () => {
    expect(stretchNow(lit, 3, 0, 10, 6)).toMatchObject({ hours: 6, broken: false, value: h(6), limit: h(6) });
    expect(stretchNow(lit, 3, 0, 10, 5)).toMatchObject({ hours: 6, broken: true, value: h(6), limit: h(5) });
  });

  it("cuts the stretch at the window's edges, as the veto does", () => {
    expect(stretchNow(lit, 3, 2, 10, 6)).toMatchObject({ hours: 5 });
    expect(stretchNow(lit, 9, 0, 10, 6)).toMatchObject({ hours: 2 });
  });

  it("says nothing while lit or outside the window", () => {
    expect(stretchNow(lit, 0, 0, 10, 6)).toBeNull();
    expect(stretchNow(lit, 3, 4, 10, 6)).toBeNull();
    expect(stretchNow(lit, 9, 0, 9, 6)).toBeNull();
  });
});
