import { describe, expect, it } from "vitest";
import { GL_DEFAULTS, readGlSwitches } from "./gl-switches";

describe("the scene's GL switches, read from the address", () => {
  it("are the scene as it always was when the address asks for nothing", () => {
    expect(readGlSwitches("")).toEqual(GL_DEFAULTS);
    expect(readGlSwitches("?profile=im2_athena&view=slip")).toEqual(GL_DEFAULTS);
    expect(GL_DEFAULTS).toEqual({ diag: false, preserveDrawingBuffer: false, frameloop: "demand", antialias: true, powerPreference: "high-performance" });
  });

  it("turn on one at a time", () => {
    expect(readGlSwitches("?diag=1").diag).toBe(true);
    expect(readGlSwitches("?gl-preserve=1").preserveDrawingBuffer).toBe(true);
    expect(readGlSwitches("?gl-loop=always").frameloop).toBe("always");
    expect(readGlSwitches("?gl-aa=0").antialias).toBe(false);
    expect(readGlSwitches("?gl-power=default").powerPreference).toBe("default");
  });

  it("combine, alongside a scenario link", () => {
    expect(readGlSwitches("?profile=im2_athena&view=slip&diag=1&gl-aa=0&gl-loop=always")).toEqual({
      diag: true,
      preserveDrawingBuffer: false,
      frameloop: "always",
      antialias: false,
      powerPreference: "high-performance",
    });
  });

  it("ignore values they do not know", () => {
    expect(readGlSwitches("?diag=maybe&gl-loop=sometimes&gl-aa=no&gl-power=low")).toEqual(GL_DEFAULTS);
  });
});
