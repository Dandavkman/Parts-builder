import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/design", "/viewer"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
