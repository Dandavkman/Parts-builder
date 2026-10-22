import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { PROTECTED_PATHS, getAuthMode } from "./lib/auth-mode";

const isProtected = createRouteMatcher(PROTECTED_PATHS);

const clerk = clerkMiddleware(async (auth, request) => {
  if (isProtected(request)) await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const mode = getAuthMode();
  if (mode === "clerk") return clerk(request, event);
  if (mode === "dev-bypass" || request.nextUrl.pathname === "/setup") return NextResponse.next();
  return NextResponse.redirect(new URL("/setup", request.url));
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
