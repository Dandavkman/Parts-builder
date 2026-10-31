import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, EB_Garamond, Hanken_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { getAuthMode } from "../lib/auth-mode";
import { BRAND } from "../lib/brand";
import "./globals.css";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-cinzel", display: "swap" });
const garamond = EB_Garamond({ subsets: ["greek", "latin"], weight: ["400"], style: ["italic"], variable: "--font-garamond", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s | ${BRAND.name}` },
  description: "Design custom parts from a photo, measurements or a scan, and have them made.",
};

// The auth mode is read from the environment on every request, not frozen at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="en" className={`${cormorant.variable} ${cinzel.variable} ${garamond.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
  return getAuthMode() === "clerk" ? <ClerkProvider>{page}</ClerkProvider> : page;
}
