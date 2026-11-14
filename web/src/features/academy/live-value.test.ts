import { describe, expect, it } from "vitest";
import { createLiveValue } from "./live-value";

describe("a live value (Pip's power during a drag)", () => {
  it("tells its readers when it changes, and only then", () => {
    const power = createLiveValue<number | null>(null);
    let heard = 0;
    const stop = power.subscribe(() => {
      heard += 1;
    });
    power.set(42);
    power.set(42);
    power.set(0);
    expect(power.get()).toBe(0);
    expect(heard).toBe(2);
    stop();
    power.set(100);
    expect(heard).toBe(2);
  });
});
