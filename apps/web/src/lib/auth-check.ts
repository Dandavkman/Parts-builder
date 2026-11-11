/**
 * Checks the Clerk keys without ever returning them. Used by /api/health/auth so a bad key (a stray
 * smart quote, a space, test keys beside live keys) shows up as a plain answer instead of a blank
 * page and a redirect loop. Only booleans and the key kind (live or test) leave this file.
 */
type Env = Record<string, string | undefined>;

export interface KeyReport {
  set: boolean;
  /** Plain ASCII, no spaces, quotes or line breaks. */
  clean: boolean;
  kind: "live" | "test" | "unknown";
}

function report(value: string | undefined, prefix: "pk" | "sk"): KeyReport {
  if (!value) return { set: false, clean: false, kind: "unknown" };
  const clean = /^[\x21-\x7e]+$/.test(value) && !/["'`]/.test(value);
  const kind = value.startsWith(`${prefix}_live_`) ? "live" : value.startsWith(`${prefix}_test_`) ? "test" : "unknown";
  return { set: true, clean, kind };
}

export function checkClerkKeys(env: Env = process.env) {
  const publishable = report(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "pk");
  const secret = report(env.CLERK_SECRET_KEY, "sk");
  const problems: string[] = [];
  if (!publishable.set) problems.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
  else if (!publishable.clean) problems.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY has a space, quote or non-ASCII character; paste it again as one plain line");
  if (!secret.set) problems.push("CLERK_SECRET_KEY is not set");
  else if (!secret.clean) problems.push("CLERK_SECRET_KEY has a space, quote or non-ASCII character; paste it again as one plain line");
  if (publishable.kind !== "unknown" && secret.kind !== "unknown" && publishable.kind !== secret.kind) {
    problems.push(`the publishable key is ${publishable.kind} but the secret key is ${secret.kind}; both must come from the same Clerk instance`);
  }
  return { publishable, secret, problems };
}
