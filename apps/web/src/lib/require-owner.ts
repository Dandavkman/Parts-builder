import { auth } from "@clerk/nextjs/server";
import { getAuthMode } from "./auth-mode";

/** The signed-in user's id for API routes ("dev" in the local bypass), or the error response to return. */
export async function requireOwner(): Promise<{ ownerId: string } | { response: Response }> {
  const mode = getAuthMode();
  if (mode === "unconfigured") {
    return { response: Response.json({ error: "Auth is not configured" }, { status: 503 }) };
  }
  if (mode === "dev-bypass") return { ownerId: "dev" };
  const { userId } = await auth();
  if (!userId) return { response: Response.json({ error: "Sign in required" }, { status: 401 }) };
  return { ownerId: userId };
}
