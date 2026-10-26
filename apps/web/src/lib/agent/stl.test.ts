import { describe, expect, it } from "vitest";
import { stlBounds } from "./stl";

function binaryStl(triangles: number[][][]): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + 50 * triangles.length);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((tri, t) => {
    tri.forEach((v, i) => v.forEach((x, k) => view.setFloat32(84 + 50 * t + 12 + 12 * i + 4 * k, x, true)));
  });
  return buffer;
}

describe("stlBounds", () => {
  const tris = [
    [[0, 0, 0], [10, 0, 0], [0, 20, 5]],
    [[-3, 2, 1], [4, 4, 30], [1, 1, 1]],
  ];

  it("reads a binary STL", () => {
    expect(stlBounds(binaryStl(tris))).toEqual({ min: [-3, 0, 0], max: [10, 20, 30] });
  });

  it("reads an ASCII STL", () => {
    const text = `solid part\n${tris
      .map((t) => `facet normal 0 0 1\n outer loop\n${t.map((v) => `  vertex ${v.join(" ")}`).join("\n")}\n endloop\nendfacet`)
      .join("\n")}\nendsolid part\n`;
    expect(stlBounds(new TextEncoder().encode(text).buffer as ArrayBuffer)).toEqual({ min: [-3, 0, 0], max: [10, 20, 30] });
  });

  it("returns null when there are no triangles", () => {
    expect(stlBounds(new ArrayBuffer(10))).toBeNull();
    expect(stlBounds(binaryStl([]))).toBeNull();
  });
});
