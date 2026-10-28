import { isAdmin } from "./admin";
import { requireOwner } from "./require-owner";

/** The signed-in admin's id, or the error response to return (401 not signed in, 403 not an admin). */
export async function requireAdmin(): Promise<{ adminId: string } | { response: Response }> {
  const who = await requireOwner();
  if ("response" in who) return who;
  if (!isAdmin(who.ownerId)) return { response: Response.json({ error: "Admins only." }, { status: 403 }) };
  return { adminId: who.ownerId };
}
