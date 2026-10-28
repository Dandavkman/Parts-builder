import { searchVehicles } from "../../../lib/vehicles/catalog";

/** Public (the catalog is not private). `GET /api/vehicles?q=miata 1994` returns matching cars. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  return Response.json({ vehicles: searchVehicles(q) }, { headers: { "cache-control": "public, max-age=300" } });
}
