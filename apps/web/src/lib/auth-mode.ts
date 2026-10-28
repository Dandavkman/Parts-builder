/**
 * How the app handles sign-in, decided from environment variables.
 *
 * - clerk: both Clerk keys are set. Protected pages require a signed-in user.
 * - dev-bypass: no keys, development mode, and ALLOW_UNAUTHENTICATED_DEV=true. Lets the
 *   team work on pages before Clerk is set up. Never active in production.
 * - unconfigured: no keys and no bypass. Every page redirects to /setup (fails closed).
 */
export type AuthMode = "clerk" | "dev-bypass" | "unconfigured";

type Env = Record<string, string | undefined>;

export function getAuthMode(env: Env = process.env): AuthMode {
  if (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY) return "clerk";
  if (env.NODE_ENV === "development" && env.ALLOW_UNAUTHENTICATED_DEV === "true") {
    return "dev-bypass";
  }
  return "unconfigured";
}

export const PROTECTED_PATHS = ["/dashboard(.*)", "/viewer(.*)", "/api/demo-plate(.*)", "/api/agent(.*)", "/api/designs(.*)", "/api/orders(.*)", "/api/stores(.*)", "/api/account(.*)", "/admin(.*)", "/api/admin(.*)", "/design(.*)"];
