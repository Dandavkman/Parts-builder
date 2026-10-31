import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAuthMode } from "../lib/auth-mode";
import { BRAND } from "../lib/brand";
import "./globals.css";

/** Loaded by the browser, not at build time, so the build needs no network access to Google. */
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital@1&family=Hanken+Grotesk:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s | ${BRAND.name}` },
  description: "Design custom parts from a photo, measurements or a scan, and have them made.",
};

// The auth mode is read from the environment on every request, not frozen at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
  return getAuthMode() === "clerk" ? <ClerkProvider>{page}</ClerkProvider> : page;
}
