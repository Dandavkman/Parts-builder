import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicle, SCAN_AREAS } from "../../../lib/vehicles/catalog";
import { carTitle, LIBRARY_PRICES_ARE_PLACEHOLDER, offersFor } from "../../../lib/vehicles/library";
import { PublicShell } from "../../public-shell";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const v = getVehicle((await params).id);
  if (!v) return { title: "Car not found" };
  return {
    title: carTitle(v),
    description: `3D scan areas available for the ${v.make} ${v.model} ${v.generation}, for designing parts that fit.`,
  };
}

export default async function CarPage({ params }: Params) {
  const v = getVehicle((await params).id);
  if (!v) notFound();
  const offers = offersFor(v, SCAN_AREAS);
  return (
    <PublicShell title={carTitle(v)}>
      <p className="mt-4 text-subtle">Scans of this car let the design match its real shape. Scans open in the design workspace; they are not downloadable.</p>
      {LIBRARY_PRICES_ARE_PLACEHOLDER && <p className="mt-4 rounded bg-warning-soft px-3 py-2 text-warning-ink">Example prices only: library pricing is not set yet.</p>}
      <ul className="mt-6 space-y-2" aria-label="Scan areas">
        {offers.map((o) => (
          <li key={o.area} className={`flex items-center justify-between rounded border border-line p-3 ${o.available ? "" : "opacity-60"}`}>
            <span>{o.label}</span>
            <span className="text-sm text-muted">{o.available ? `$${((o.priceCents ?? 0) / 100).toFixed(2)}, or included in Pro` : "Coming"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/design" className="underline">
          Start a design
        </Link>
      </p>
    </PublicShell>
  );
}
