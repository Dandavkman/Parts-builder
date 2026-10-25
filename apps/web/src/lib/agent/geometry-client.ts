import { geometryAuthHeaders, geometryServiceUrl } from "../geometry";
import type { AgentAnchor, BuildSpec } from "./types";

/** Asks the geometry service to build the spec (as STL) to learn whether it is valid. */
export const buildWithGeometryService: BuildSpec = async (spec, anchors: AgentAnchor[]) => {
  const body = {
    spec,
    anchors: Object.fromEntries(anchors.map((a) => [a.id, { point_mm: a.point_mm, normal: a.normal }])),
  };
  const response = await fetch(`${geometryServiceUrl()}/build?format=stl`, {
    method: "POST",
    headers: { "content-type": "application/json", ...geometryAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    await response.arrayBuffer();
    return { ok: true };
  }
  if (response.status === 422) {
    const data = (await response.json()) as { errors?: unknown };
    const errors = Array.isArray(data.errors) ? data.errors.map(String) : ["The spec could not be built."];
    return { ok: false, errors };
  }
  throw new Error(`The geometry service returned ${response.status}.`);
};
