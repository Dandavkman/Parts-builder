import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

describe("part-spec package", () => {
  it("is wired into the workspace", () => {
    expect(PACKAGE_NAME).toBe("@parts-builder/part-spec");
  });
});
