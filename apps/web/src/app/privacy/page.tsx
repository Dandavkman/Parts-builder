import type { Metadata } from "next";
import { BRAND } from "../../lib/brand";
import { PublicShell } from "../public-shell";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy">
      <p className="mt-4 rounded bg-amber-100 px-3 py-2 text-amber-900">
        Draft. The final Privacy text is being prepared with a lawyer and is not in force yet.
      </p>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Questions in the meantime: {BRAND.contactEmail}.
      </p>
    </PublicShell>
  );
}
