import type { AgentDimension } from "./types";

/** Thinnest wall the default material (FDM or nylon) prints reliably. Replaced by the material table in B2.3. */
export const MIN_WALL_MM = 1.2;

/** A built part may differ from a stated size by this much: 0.5 mm or 0.25%, whichever is more, so a part 1 mm off is flagged. */
export function toleranceMm(value_mm: number): number {
  return Math.max(0.5, value_mm * 0.0025);
}

/** Which size of the built part a dimension describes. Z is up, so height is the Z extent. */
function measured(measures: NonNullable<AgentDimension["measures"]>, size: [number, number, number]): number {
  switch (measures) {
    case "overall_width":
      return size[0];
    case "overall_length":
      return size[1];
    case "overall_height":
      return size[2];
    case "overall_diameter":
      return Math.max(size[0], size[1]);
  }
}

/** Walls and plates thinner than the minimum, found by reading the spec. */
export function thinWalls(spec: Record<string, unknown>, min_mm = MIN_WALL_MM): string[] {
  const notes: string[] = [];
  const features = Array.isArray(spec.features) ? (spec.features as Record<string, unknown>[]) : [];
  for (const f of features) {
    const shell = f.shell as { wall_thickness_mm?: unknown } | undefined;
    if (typeof shell?.wall_thickness_mm === "number" && shell.wall_thickness_mm < min_mm) {
      notes.push(`Wall check: '${String(f.id)}' has walls of ${shell.wall_thickness_mm} mm, thinner than the ${min_mm} mm printers handle reliably. Make them thicker.`);
    }
    if (f.type === "plate" && typeof f.thickness_mm === "number" && f.thickness_mm < min_mm) {
      notes.push(`Wall check: plate '${String(f.id)}' is ${f.thickness_mm} mm thick, thinner than ${min_mm} mm. Make it thicker.`);
    }
  }
  return notes;
}

/**
 * What the agent and user should know about a part that built: every stated or confirmed dimension that
 * says what it measures is compared with the built size, and thin walls are flagged. Returns plain
 * sentences; an empty list means the checks found nothing.
 */
export function checkBuild(
  spec: Record<string, unknown>,
  size_mm: [number, number, number] | undefined,
  dimensions: AgentDimension[],
): string[] {
  const notes: string[] = [];
  if (size_mm) {
    for (const d of dimensions) {
      if (!d.measures) continue;
      const built = measured(d.measures, size_mm);
      const off = built - d.value_mm;
      if (Math.abs(off) > toleranceMm(d.value_mm)) {
        notes.push(
          `Dimension check: '${d.id}' (${d.measures.replace("overall_", "overall ")}) should be ${d.value_mm} mm but the part is ${built.toFixed(1)} mm, ${Math.abs(off).toFixed(1)} mm ${off > 0 ? "too large" : "too small"}. Fix the spec.`,
        );
      }
    }
  }
  return [...notes, ...thinWalls(spec)];
}
