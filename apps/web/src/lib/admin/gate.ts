import { isAdmin } from "../admin";
import { requireOwner } from "../require-owner";

/** Whether the person viewing an admin page is an admin. Pages show "Admins only." otherwise; the API routes check on their own. */
export async function viewerIsAdmin(): Promise<boolean> {
  const who = await requireOwner();
  return !("response" in who) && isAdmin(who.ownerId);
}
