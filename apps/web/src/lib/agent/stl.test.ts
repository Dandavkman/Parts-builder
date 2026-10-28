import { describe, expect, it } from "vitest";
import { stlBounds, stlVolumeMm3 } from "./stl";

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

describe("stlVolumeMm3", () => {
  // A tetrahedron with 6 mm legs has volume 6*6*6/6 = 36 mm3.
  const o = [0, 0, 0], x = [6, 0, 0], y = [0, 6, 0], z = [0, 0, 6];
  const tetra = [[o, y, x], [o, x, z], [o, z, y], [x, y, z]];

  it("measures a closed binary STL", () => {
    expect(stlVolumeMm3(binaryStl(tetra))).toBeCloseTo(36, 6);
  });

  it("measures an ASCII STL the same way", () => {
    const text = `solid t\n${tetra.map((t) => `facet normal 0 0 0\nouter loop\n${t.map((v) => `vertex ${v.join(" ")}`).join("\n")}\nendloop\nendfacet`).join("\n")}\nendsolid t`;
    expect(stlVolumeMm3(new TextEncoder().encode(text).buffer as ArrayBuffer)).toBeCloseTo(36, 6);
  });

  it("returns null for an empty file", () => {
    expect(stlVolumeMm3(binaryStl([]))).toBeNull();
  });
});
