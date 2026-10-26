import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAuthMode } from "../lib/auth-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parts Builder",
  description: "Design custom parts from a photo, measurements or a scan, and have them made.",
};

// The auth mode is read from the environment on every request, not frozen at build time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  return getAuthMode() === "clerk" ? <ClerkProvider>{page}</ClerkProvider> : page;
}
