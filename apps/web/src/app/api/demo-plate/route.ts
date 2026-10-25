import { auth } from "@clerk/nextjs/server";
import { getAuthMode } from "../../../lib/auth-mode";
import { geometryAuthHeaders, geometryServiceUrl } from "../../../lib/geometry";

/** Proxies the geometry service's demo plate (GLB) to signed-in users. */
export async function GET() {
  const mode = getAuthMode();
  if (mode === "unconfigured") return Response.json({ error: "Auth is not configured" }, { status: 503 });
  if (mode === "clerk") {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${geometryServiceUrl()}/build?format=glb`, {
      method: "POST",
      headers: geometryAuthHeaders(),
    });
  } catch {
    return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
  }
  if (!upstream.ok) {
    return Response.json(
      { error: `The geometry service returned ${upstream.status}.` },
      { status: 502 },
    );
  }
  return new Response(upstream.body, {
    headers: { "content-type": "model/gltf-binary", "cache-control": "private, no-store" },
  });
}
