import { geometryAuthHeaders, geometryServiceUrl } from "../geometry";
import { stlBounds } from "./stl";
import type { CadStepResult } from "./tools";
import type { AgentAnchor, BuildSpec } from "./types";

export type GeometryFormat = "step" | "stl" | "glb";

export type BuiltFile =
  | { ok: true; body: ArrayBuffer; contentType: string; contentDisposition: string | null }
  | { ok: false; errors: string[] };

/** Asks the geometry service to build the spec. A spec that cannot be built comes back as plain-sentence errors. */
export async function buildFile(
  spec: Record<string, unknown>,
  anchors: AgentAnchor[],
  format: GeometryFormat,
): Promise<BuiltFile> {
  const body = {
    spec,
    anchors: Object.fromEntries(anchors.map((a) => [a.id, { point_mm: a.point_mm, normal: a.normal }])),
  };
  const response = await fetch(`${geometryServiceUrl()}/build?format=${format}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...geometryAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    return {
      ok: true,
      body: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      contentDisposition: response.headers.get("content-disposition"),
    };
  }
  if (response.status === 422) {
    const data = (await response.json()) as { errors?: unknown };
    const errors = Array.isArray(data.errors) ? data.errors.map(String) : ["The spec could not be built."];
    return { ok: false, errors };
  }
  throw new Error(`The geometry service returned ${response.status}.`);
}

/** Builds as STL just to learn whether the spec is valid. */
export const buildWithGeometryService: BuildSpec = async (spec, anchors) => {
  const built = await buildFile(spec, anchors, "stl");
  if (!built.ok) return built;
  const bounds = stlBounds(built.body);
  return bounds
    ? { ok: true, size_mm: [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]) as [number, number, number] }
    : { ok: true };
}

/** Runs one CAD tool-belt step on the geometry service. The spec travels with each call; nothing is stored there. */
export type RunCadTool = (tool: string, args: Record<string, unknown>) => Promise<CadStepResult>;

export async function callCadTool(tool: string, args: Record<string, unknown>): Promise<CadStepResult> {
  const response = await fetch(`${geometryServiceUrl()}/tools/${encodeURIComponent(tool)}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...geometryAuthHeaders() },
    body: JSON.stringify(args),
  });
  if (response.status === 404) return { ok: false, errors: [`There is no CAD tool called '${tool}'.`] };
  if (!response.ok) throw new Error(`The geometry service returned ${response.status}.`);
  return (await response.json()) as CadStepResult;
}
