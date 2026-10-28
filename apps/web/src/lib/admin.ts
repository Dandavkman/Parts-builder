import { getAuthMode } from "./auth-mode";

type Env = Record<string, string | undefined>;

/**
 * Admins are the Clerk user ids listed in ADMIN_USER_IDS (comma separated). With no list nobody is an admin.
 * The local dev bypass user "dev" is an admin only in development, so pages can be built before Clerk is set up.
 */
export function isAdmin(userId: string, env: Env = process.env): boolean {
  if (userId === "dev") return getAuthMode(env) === "dev-bypass";
  const ids = (env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}
