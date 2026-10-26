/** Base URL of the Python geometry service. */
export function geometryServiceUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.GEOMETRY_SERVICE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

/** Headers for calls to the geometry service: the shared secret as a bearer token. */
export function geometryAuthHeaders(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const token = env.GEOMETRY_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
