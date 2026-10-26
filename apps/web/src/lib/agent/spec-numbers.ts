/** Finds every editable number in a Part Spec, so the page can offer a slider for each. */
export type Path = (string | number)[];

export interface SpecNumber {
  path: Path;
  label: string;
  value: number;
  unit: "mm" | "deg";
  min: number;
  max: number;
  step: number;
}

const AXES = ["x", "y", "z"];

function unitOf(key: string): "mm" | "deg" | null {
  if (key.endsWith("_mm")) return "mm";
  if (key.endsWith("_deg")) return "deg";
  return null;
}

/** Every number under a key ending in `_mm` or `_deg` (including inside arrays), in spec order. */
export function collectNumbers(spec: Record<string, unknown>): SpecNumber[] {
  const found: SpecNumber[] = [];
  const features = Array.isArray(spec.features) ? (spec.features as Record<string, unknown>[]) : [];

  function walk(node: unknown, path: Path, unit: "mm" | "deg" | null, inArray: boolean) {
    if (typeof node === "number") {
      if (!unit || !Number.isFinite(node)) return;
      const span = Math.max(Math.abs(node) * 2, 10);
      const signed = inArray || node < 0 || unit === "deg";
      const feature = typeof path[1] === "number" ? features[path[1]] : undefined;
      const id = typeof feature?.id === "string" ? feature.id : "part";
      const rest = path.slice(2).map((p) => (typeof p === "number" ? (AXES[p] ?? String(p)) : p));
      found.push({
        path,
        label: `${id} ${rest.join(" ")}`.trim(),
        value: node,
        unit,
        min: unit === "deg" ? -360 : signed ? -span : 0,
        max: unit === "deg" ? 360 : span,
        step: unit === "deg" ? 1 : 0.1,
      });
    } else if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, [...path, i], unit, true));
    } else if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) walk(child, [...path, key], unitOf(key) ?? unit, inArray);
    }
  }

  walk(spec, [], null, false);
  return found;
}

/** A copy of the spec with one value replaced. */
export function setAtPath(spec: Record<string, unknown>, path: Path, value: number): Record<string, unknown> {
  const copy = structuredClone(spec);
  let node: unknown = copy;
  for (const step of path.slice(0, -1)) node = (node as Record<string | number, unknown>)[step];
  (node as Record<string | number, unknown>)[path[path.length - 1]] = value;
  return copy;
}

/** True when `next` has exactly the same shape and text as `base`, and only numbers differ. */
export function onlyNumbersChanged(base: unknown, next: unknown): boolean {
  if (typeof base === "number") return typeof next === "number" && Number.isFinite(next);
  if (Array.isArray(base)) {
    return Array.isArray(next) && next.length === base.length && base.every((b, i) => onlyNumbersChanged(b, next[i]));
  }
  if (base && typeof base === "object") {
    if (!next || typeof next !== "object" || Array.isArray(next)) return false;
    const a = Object.keys(base);
    const b = Object.keys(next);
    return (
      a.length === b.length &&
      a.every((k) => k in next && onlyNumbersChanged((base as Record<string, unknown>)[k], (next as Record<string, unknown>)[k]))
    );
  }
  return base === next;
}
