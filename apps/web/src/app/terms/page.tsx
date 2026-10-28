import type { Metadata } from "next";
import { BRAND } from "../../lib/brand";
import { PublicShell } from "../public-shell";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PublicShell title="Terms">
      <p className="mt-4 rounded bg-warning-soft px-3 py-2 text-warning-ink">
        Draft. The final Terms text is being prepared with a lawyer and is not in force yet.
      </p>
      <p className="mt-4 text-subtle">
        Questions in the meantime: {BRAND.contactEmail}.
      </p>
    </PublicShell>
  );
}
