/** Base URL of the Python geometry service. */
export function geometryServiceUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.GEOMETRY_SERVICE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}
