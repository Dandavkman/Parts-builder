import { describe, expect, it } from "vitest";
import { START_CHOICES } from "./start-choices";

describe("start choices", () => {
  it("offers photo, lookup, description and scan, with scan last and marked unavailable", () => {
    expect(START_CHOICES.map((c) => c.id)).toEqual(["photo", "lookup", "describe", "scan"]);
    expect(START_CHOICES.find((c) => c.id === "scan")?.available).toBe(false);
    expect(START_CHOICES.filter((c) => c.available)).toHaveLength(3);
  });

  it("gives the lookup and describe choices an example to put in the message box", () => {
    for (const id of ["lookup", "describe"]) {
      expect(START_CHOICES.find((c) => c.id === id)?.example).toBeTruthy();
    }
  });
});
