import type { Metadata } from "next";
import { searchVehicles } from "../../lib/vehicles/catalog";
import { PublicShell } from "../public-shell";
import { CarsList } from "./cars-list";

export const metadata: Metadata = {
  title: "Cars",
  description: "Find your car to see which areas of it we have 3D scans for, so a part can be designed to fit exactly.",
};

export default async function CarsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").slice(0, 100);
  return (
    <PublicShell title="Cars">
      <p className="mt-4 text-subtle">Find your car to see which areas we have scanned. A scan lets the design fit the real shape.</p>
      <form className="mt-6 flex gap-2" action="/cars">
        <input name="q" defaultValue={query} aria-label="Search cars" placeholder="Make, model, generation or year" className="min-w-0 flex-1 rounded border border-line-strong bg-transparent px-3 py-2" />
        <button type="submit" className="rounded border border-line-strong px-4 py-2">
          Search
        </button>
      </form>
      <CarsList vehicles={searchVehicles(query)} />
    </PublicShell>
  );
}
