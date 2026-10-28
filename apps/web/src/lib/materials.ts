/**
 * Draft material table and printability advice (task B2.3a).
 *
 * The numbers are typical hobby and print-service values, good enough to tell a user which material
 * suits a part. They are NOT partner data: O1.5 replaces this table with the real one, and price and
 * lead time are deliberately absent until then (quotes are B2.5).
 */
export interface Material {
  id: string;
  name: string;
  process: "FDM" | "SLS" | "CNC";
  min_wall_mm: number;
  min_hole_mm: number;
  /** Largest part that fits the machine, as X, Y, Z in mm. Orientation is free, so sizes are compared sorted. */
  build_mm: [number, number, number];
  max_temp_c: number;
  outdoor: boolean;
  flexible: boolean;
  /** 1 (decorative) to 3 (carries load). */
  strength: 1 | 2 | 3;
  /** 1 (cheapest) to 3. A ranking only; real prices come with the rate cards. */
  cost: 1 | 2 | 3;
}

export const MATERIALS: Material[] = [
  { id: "pla", name: "PLA (FDM)", process: "FDM", min_wall_mm: 1.2, min_hole_mm: 2, build_mm: [250, 210, 210], max_temp_c: 55, outdoor: false, flexible: false, strength: 1, cost: 1 },
  { id: "petg", name: "PETG (FDM)", process: "FDM", min_wall_mm: 1.2, min_hole_mm: 2, build_mm: [250, 210, 210], max_temp_c: 75, outdoor: true, flexible: false, strength: 2, cost: 1 },
  { id: "tpu", name: "TPU flexible (FDM)", process: "FDM", min_wall_mm: 1.6, min_hole_mm: 3, build_mm: [220, 200, 200], max_temp_c: 80, outdoor: true, flexible: true, strength: 1, cost: 2 },
  { id: "nylon_sls", name: "Nylon PA12 (SLS)", process: "SLS", min_wall_mm: 0.8, min_hole_mm: 1.5, build_mm: [340, 340, 600], max_temp_c: 100, outdoor: true, flexible: false, strength: 3, cost: 3 },
  // CNC milled aluminum (B3.8). Placeholder limits: 3-axis milling from one side with a 3 mm end mill.
  { id: "al6061_cnc", name: "Aluminum 6061 (CNC)", process: "CNC", min_wall_mm: 1.5, min_hole_mm: 2, build_mm: [300, 200, 100], max_temp_c: 150, outdoor: true, flexible: false, strength: 3, cost: 3 },
];

/** Smallest inside corner a 3 mm end mill can cut: its radius. PLACEHOLDER until a CNC partner gives real tooling limits. */
export const CNC_MIN_INSIDE_RADIUS_MM = 1.5;

/** What the part itself says about its thinnest wall and smallest hole, read from the spec. */
export interface PartFacts {
  thinnest_wall_mm: number | null;
  smallest_hole_mm: number | null;
}

type Obj = Record<string, unknown>;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function partFacts(spec: Obj): PartFacts {
  const features = Array.isArray(spec.features) ? (spec.features as Obj[]) : [];
  const walls: number[] = [];
  const holes: number[] = [];
  for (const f of features) {
    const shell = f.shell as Obj | undefined;
    if (num(shell?.wall_thickness_mm)) walls.push(shell.wall_thickness_mm);
    if (f.type === "plate" && num(f.thickness_mm)) walls.push(f.thickness_mm);
    if ((f.type === "hole" || f.type === "hole_pattern") && num(f.diameter_mm)) holes.push(f.diameter_mm);
    if (f.type === "standoff" && num(f.hole_diameter_mm)) holes.push(f.hole_diameter_mm);
    if (f.type === "counterbore" && num(f.diameter_mm)) holes.push(f.diameter_mm);
  }
  return {
    thinnest_wall_mm: walls.length ? Math.min(...walls) : null,
    smallest_hole_mm: holes.length ? Math.min(...holes) : null,
  };
}

export interface Assessment {
  material: Material;
  problems: string[];
}

/** Does the part fit the machine in some orientation? Sorting both sizes compares largest with largest. */
function fits(size: [number, number, number], build: [number, number, number]): boolean {
  const a = [...size].sort((x, y) => y - x);
  const b = [...build].sort((x, y) => y - x);
  return a.every((v, i) => v <= b[i]);
}

const typeOf = (f: Obj) => f.type;

/**
 * Why a spec cannot be milled from one side on a 3-axis machine. Two shapes fail: a closed hollow body (the cavity is an
 * undercut the cutter cannot reach; a body open at the top is a pocket and is fine) and a rectangular cutout (its inside corners are sharp, and a round cutter leaves
 * a radius of at least CNC_MIN_INSIDE_RADIUS_MM). Round holes, slots and plain outlines pass.
 */
export function cncProblems(spec: Obj): string[] {
  const features = Array.isArray(spec.features) ? (spec.features as Obj[]) : [];
  const problems: string[] = [];
  if (features.some((f) => typeOf(f) === "body" && (f.shell as Obj | undefined)?.open === "none")) {
    problems.push("a closed hollow body has an inside cavity a milling cutter cannot reach");
  }
  if (features.some((f) => typeOf(f) === "cutout" && (f.zone as Obj | undefined)?.kind === "rectangle")) {
    problems.push(`a rectangular cutout has sharp inside corners, and a milling cutter leaves a radius of at least ${CNC_MIN_INSIDE_RADIUS_MM} mm (use a round hole or a slot)`);
  }
  return problems;
}

/** Pass or fail for every material, with a plain reason for each failure. */
export function assessMaterials(spec: Obj, size_mm?: [number, number, number]): Assessment[] {
  const facts = partFacts(spec);
  return MATERIALS.map((material) => {
    const problems: string[] = [];
    if (facts.thinnest_wall_mm !== null && facts.thinnest_wall_mm < material.min_wall_mm) {
      problems.push(`walls of ${facts.thinnest_wall_mm} mm are under its ${material.min_wall_mm} mm minimum`);
    }
    if (facts.smallest_hole_mm !== null && facts.smallest_hole_mm < material.min_hole_mm) {
      problems.push(`a ${facts.smallest_hole_mm} mm hole is under its ${material.min_hole_mm} mm minimum`);
    }
    if (size_mm && !fits(size_mm, material.build_mm)) {
      problems.push(`the part is bigger than its ${material.build_mm.join(" x ")} mm build size`);
    }
    if (material.process === "CNC") problems.push(...cncProblems(spec));
    return { material, problems };
  });
}

/** What the user needs the part to survive. Unset means no requirement. */
export interface Needs {
  heat_c?: number;
  outdoor?: boolean;
  flexible?: boolean;
  load?: boolean;
}

export interface Advice {
  /** Materials that pass every check and meet the needs, best first (cheapest, then strongest). */
  recommended: Material[];
  /** Materials that fail a check, each with the reasons. */
  rejected: Assessment[];
}

export function recommend(assessments: Assessment[], needs: Needs = {}): Advice {
  const wantedStrength = needs.load ? 3 : 1;
  const ok = (m: Material) =>
    (needs.heat_c === undefined || m.max_temp_c >= needs.heat_c) &&
    (!needs.outdoor || m.outdoor) &&
    (needs.flexible === undefined || m.flexible === needs.flexible) &&
    m.strength >= wantedStrength;
  const passing = assessments.filter((a) => a.problems.length === 0).map((a) => a.material);
  return {
    recommended: passing.filter(ok).sort((a, b) => a.cost - b.cost || b.strength - a.strength),
    rejected: assessments.filter((a) => a.problems.length > 0),
  };
}

/** One short paragraph for the chat. */
export function describeAdvice(advice: Advice): string {
  const lines: string[] = [];
  if (advice.recommended.length) {
    lines.push(`Materials that suit this part: ${advice.recommended.map((m) => m.name).join(", ")} (cheapest first). Draft rules, to be replaced by print-partner data.`);
  } else {
    lines.push("No material in the draft table passes every check for this part.");
  }
  for (const r of advice.rejected) lines.push(`${r.material.name}: ${r.problems.join("; ")}.`);
  return lines.join(" ");
}
