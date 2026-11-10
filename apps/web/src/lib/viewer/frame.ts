export type Vec3 = [number, number, number];

export interface CameraFrame {
  position: Vec3;
  near: number;
  far: number;
}

/**
 * Where to put the camera so a box fits in view. Pure (no three.js), so it is unit-tested.
 * `size_mm` and `center_mm` describe the part's bounding box in viewer units (1 unit = 1 mm).
 */
export function frameCamera(size_mm: Vec3, center_mm: Vec3, fovDeg: number, aspect: number, margin = 1.35): CameraFrame {
  const radius = Math.max(Math.hypot(...size_mm) / 2, 1);
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(aspect, 0.1));
  const distance = (radius * margin) / Math.sin(Math.min(vfov, hfov) / 2);
  // Look from front-right and a little above, the angle most parts read best from.
  const dir: Vec3 = [0.62, 0.45, 0.64];
  const len = Math.hypot(...dir);
  return {
    position: [center_mm[0] + (dir[0] / len) * distance, center_mm[1] + (dir[1] / len) * distance, center_mm[2] + (dir[2] / len) * distance],
    near: Math.max(distance / 200, 0.05),
    far: (distance + radius) * 20,
  };
}

const CELLS_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Floor grid spacing that scales with the part: about 30 cells across its longest side. */
export function gridFor(maxSide_mm: number): { cell_mm: number; section_mm: number; fade_mm: number } {
  const cell_mm = CELLS_MM.find((c) => maxSide_mm / c <= 30) ?? 1000;
  return { cell_mm, section_mm: cell_mm * 5, fade_mm: Math.max(maxSide_mm, 50) * 8 };
}
