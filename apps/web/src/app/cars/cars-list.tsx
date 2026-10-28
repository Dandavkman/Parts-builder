import Link from "next/link";
import type { Vehicle } from "../../lib/vehicles/catalog";
import { carTitle } from "../../lib/vehicles/library";

/** A list of cars linking to their library pages. Presentation only. */
export function CarsList({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) return <p className="mt-6 text-muted">No cars match that search.</p>;
  return (
    <ul className="mt-6 space-y-2" aria-label="Cars">
      {vehicles.map((v) => (
        <li key={v.id}>
          <Link href={`/cars/${v.id}`} className="block rounded border border-line p-3 hover:bg-raised">
            <span className="font-medium">{carTitle(v)}</span>
            <span className="mt-1 block text-xs text-muted">
              {v.scanned.length > 0 ? `${v.scanned.length} scanned area${v.scanned.length === 1 ? "" : "s"}` : "Scans coming"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
