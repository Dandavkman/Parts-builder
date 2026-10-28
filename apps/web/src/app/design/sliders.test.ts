import { describe, expect, it } from "vitest";
import { readableLabel } from "./sliders";

describe("readableLabel", () => {
  it("drops unit suffixes and underscores", () => {
    expect(readableLabel("knob thickness_mm")).toBe("knob thickness");
    expect(readableLabel("r00 end_mm x")).toBe("r00 end x");
    expect(readableLabel("s angle_deg")).toBe("s angle");
    expect(readableLabel("thread_hole diameter_mm")).toBe("thread hole diameter");
  });
});
