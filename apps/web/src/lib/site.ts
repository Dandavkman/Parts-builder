/** The public address of the site, for the sitemap and robots file. Read when asked, not at build time. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
