import { describe, expect, it } from "vitest";
import { MIDDLE_BUTTON_DRAG, PointerTracker, type Command } from "./pointers";

const kinds = (commands: Command[]) => commands.map((c) => c.type);

describe("a drag ends however it ends", () => {
  it("a left-button drag turns, and stops turning after the button comes up", () => {
    const t = new PointerTracker();
    expect(kinds(t.down(1, 100, 100, "mouse", 0, false, 0))).toEqual(["begin"]);
    expect(t.move(1, 110, 104, 1, false)).toEqual([{ type: "orbit", dx: 10, dy: 4 }]);
    t.up(1, 110, 104, 50);
    expect(t.size).toBe(0);
    expect(t.move(1, 130, 104, 0, false)).toEqual([]);
  });

  it("a mouse moving with no button held ends the drag (the button came up outside the window)", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 0, false, 0);
    t.move(1, 105, 100, 1, false);
    expect(t.move(1, 140, 100, 0, false)).toEqual([]);
    expect(t.size).toBe(0);
    // Coming back over the scene with no button: nothing turns.
    expect(t.move(1, 160, 100, 0, false)).toEqual([]);
  });

  it("the window losing focus mid-drag forgets the pointer: no turn after, and the next touch is not a pinch", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 0, false, 0);
    t.move(1, 120, 100, 1, false);
    t.clear(); // blur or hidden tab
    expect(t.size).toBe(0);
    expect(t.move(1, 140, 100, 1, false)).toEqual([]);
    expect(t.up(1, 140, 100, 100)).toEqual([]);
    expect(kinds(t.down(7, 50, 50, "touch", 0, false, 200))).toEqual(["begin"]);
    expect(kinds(t.move(7, 60, 50, 1, false))).toEqual(["orbit"]);
  });

  it("every order of down, move, clear and up leaves nothing behind", () => {
    const steps = ["down", "move", "clear", "up"] as const;
    const orders: (typeof steps)[number][][] = [];
    const permute = (rest: (typeof steps)[number][], done: (typeof steps)[number][]) => {
      if (rest.length === 0) orders.push(done);
      rest.forEach((s, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, s]));
    };
    permute([...steps], []);
    expect(orders).toHaveLength(24);
    for (const order of orders) {
      const t = new PointerTracker();
      for (const step of order) {
        if (step === "down") t.down(1, 0, 0, "mouse", 0, false, 0);
        if (step === "move") t.move(1, 10, 0, 1, false);
        if (step === "clear") t.clear();
        if (step === "up") t.up(1, 10, 0, 10);
      }
      // Whatever happened, once a clear or an up came after the down, nothing is held.
      const downAt = order.indexOf("down");
      const ended = order.slice(downAt + 1).some((s) => s === "clear" || s === "up");
      expect(t.size).toBe(ended ? 0 : 1);
      t.clear();
      expect(t.move(1, 30, 0, 1, false)).toEqual([]);
    }
  });

  it("a cancelled pointer (or a lost capture) ends with no double tap", () => {
    const t = new PointerTracker();
    t.down(1, 10, 10, "touch", 0, false, 0);
    t.up(1, 10, 10, 50);
    t.down(1, 10, 10, "touch", 0, false, 100);
    expect(t.cancel(1)).toEqual([]);
    expect(t.size).toBe(0);
    expect(t.cancel(1)).toEqual([]); // lost capture after a cancel: nothing to do
  });
});

describe("two fingers", () => {
  it("slide by their midpoint and zoom by their spread", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "touch", 0, false, 0);
    t.down(2, 140, 100, "touch", 0, false, 0);
    const out = t.move(2, 160, 100, 1, false);
    expect(out[0]).toEqual({ type: "pan", dx: 10, dy: 0, orFallback: false });
    expect(out[1]).toMatchObject({ type: "zoom", x: 130, y: 100 });
    expect((out[1] as { factor: number }).factor).toBeCloseTo(40 / 60, 9);
  });

  it("one finger cancelled mid-pinch: the other turns from a fresh start, and no pinch remains", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "touch", 0, false, 0);
    t.down(2, 140, 100, "touch", 0, false, 0);
    expect(kinds(t.cancel(2))).toEqual(["begin"]);
    expect(t.size).toBe(1);
    expect(t.move(1, 110, 100, 1, false)).toEqual([{ type: "orbit", dx: 10, dy: 0 }]);
    t.up(1, 110, 100, 500);
    expect(t.size).toBe(0);
  });
});

describe("sliding and double taps", () => {
  it("the right button and Shift slide; letting go of Shift turns again from a fresh start", () => {
    const t = new PointerTracker();
    t.down(1, 0, 0, "mouse", 2, false, 0);
    expect(t.move(1, 5, 0, 2, false)).toEqual([{ type: "pan", dx: 5, dy: 0, orFallback: true }]);
    t.up(1, 5, 0, 10);
    t.down(1, 0, 0, "mouse", 0, true, 20);
    expect(kinds(t.move(1, 5, 0, 1, true))).toEqual(["pan"]);
    expect(kinds(t.move(1, 10, 0, 1, false))).toEqual(["begin", "orbit"]);
  });

  it("two short taps close together are a double tap; a drag in between is not", () => {
    const t = new PointerTracker();
    t.down(1, 50, 50, "mouse", 0, false, 0);
    expect(t.up(1, 50, 50, 80)).toEqual([]);
    t.down(1, 52, 51, "mouse", 0, false, 200);
    expect(t.up(1, 52, 51, 260)).toEqual([{ type: "focus", x: 52, y: 51 }]);
    t.down(1, 50, 50, "mouse", 0, false, 1_000);
    t.up(1, 50, 50, 1_050);
    t.down(1, 50, 50, "mouse", 0, false, 1_100);
    t.move(1, 80, 50, 1, false);
    expect(t.up(1, 80, 50, 1_200)).toEqual([]);
  });
});

describe("the middle mouse button (the wheel pressed)", () => {
  // `buttons` bits: left 1, right 2, middle 4.
  it("turns like the left button: down, move, up", () => {
    expect(MIDDLE_BUTTON_DRAG).toBe("turn");
    const t = new PointerTracker();
    expect(kinds(t.down(1, 100, 100, "mouse", 1, false, 0))).toEqual(["begin"]);
    expect(t.move(1, 112, 95, 4, false)).toEqual([{ type: "orbit", dx: 12, dy: -5 }]);
    t.up(1, 112, 95, 80);
    expect(t.size).toBe(0);
    expect(t.move(1, 140, 95, 0, false)).toEqual([]);
  });

  it("slides with Shift, like Shift and the left button, and the right button still slides", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 1, true, 0);
    expect(t.move(1, 110, 100, 4, true)).toEqual([{ type: "pan", dx: 10, dy: 0, orFallback: true }]);
    // Shift let go mid-drag: back to turning, from a fresh turn.
    expect(kinds(t.move(1, 120, 100, 4, false))).toEqual(["begin", "orbit"]);
    t.up(1, 120, 100, 50);

    const r = new PointerTracker();
    r.down(2, 100, 100, "mouse", 2, false, 0);
    expect(r.move(2, 90, 100, 2, false)).toEqual([{ type: "pan", dx: -10, dy: 0, orFallback: true }]);
  });

  it("ends when the window loses focus mid-drag", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 1, false, 0);
    t.move(1, 120, 100, 4, false);
    t.clear();
    expect(t.size).toBe(0);
    expect(t.move(1, 140, 100, 4, false)).toEqual([]);
  });

  it("ends when its own button comes up while another is still held (the wrong button released)", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 1, false, 0);
    expect(kinds(t.move(1, 110, 100, 4 | 1, false))).toEqual(["orbit"]); // left pressed too: still the middle drag
    expect(t.move(1, 120, 100, 1, false)).toEqual([]); // the middle button let go, left still down
    expect(t.size).toBe(0);
    expect(t.move(1, 130, 100, 1, false)).toEqual([]);

    // The other way round: releasing a button that did not start the drag changes nothing.
    const u = new PointerTracker();
    u.down(1, 100, 100, "mouse", 1, false, 0);
    u.move(1, 105, 100, 4 | 2, false);
    expect(kinds(u.move(1, 110, 100, 4, false))).toEqual(["orbit"]);
  });

  it("does nothing on a middle click without a drag, even twice in a row", () => {
    const t = new PointerTracker();
    t.down(1, 100, 100, "mouse", 1, false, 0);
    expect(t.up(1, 100, 100, 60)).toEqual([]);
    t.down(1, 101, 100, "mouse", 1, false, 150);
    expect(t.up(1, 101, 100, 200)).toEqual([]);
    // A left double click still centres a spot.
    t.down(1, 100, 100, "mouse", 0, false, 300);
    t.up(1, 100, 100, 350);
    t.down(1, 100, 100, "mouse", 0, false, 450);
    expect(kinds(t.up(1, 100, 100, 500))).toEqual(["focus"]);
  });

  it("ignores the back and forward buttons", () => {
    const t = new PointerTracker();
    expect(t.down(1, 100, 100, "mouse", 3, false, 0)).toEqual([]);
    expect(t.size).toBe(0);
    expect(t.move(1, 120, 100, 8, false)).toEqual([]);
    expect(t.down(1, 100, 100, "mouse", 4, false, 0)).toEqual([]);
  });
});
