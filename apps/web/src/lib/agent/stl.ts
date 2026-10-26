export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Bounding box of an STL file, binary or ASCII. Returns null if it holds no triangles. */
export function stlBounds(data: ArrayBuffer): Bounds | null {
  const view = new DataView(data);
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const add = (x: number, y: number, z: number) => {
    const p = [x, y, z];
    for (let i = 0; i < 3; i++) {
      bounds.min[i] = Math.min(bounds.min[i], p[i]);
      bounds.max[i] = Math.max(bounds.max[i], p[i]);
    }
  };
  const isBinary = data.byteLength >= 84 && data.byteLength === 84 + 50 * view.getUint32(80, true);
  if (isBinary) {
    const count = view.getUint32(80, true);
    for (let t = 0; t < count; t++) {
      const base = 84 + 50 * t + 12; // skip the normal
      for (let v = 0; v < 3; v++) {
        const at = base + 12 * v;
        add(view.getFloat32(at, true), view.getFloat32(at + 4, true), view.getFloat32(at + 8, true));
      }
    }
  } else {
    const text = new TextDecoder().decode(data);
    for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) add(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return Number.isFinite(bounds.min[0]) ? bounds : null;
}
