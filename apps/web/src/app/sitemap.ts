import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";
import { VEHICLES } from "../lib/vehicles/catalog";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ["", "/pricing", "/faq", "/cars", "/terms", "/privacy"];
  return [...pages.map((p) => ({ url: `${base}${p}` })), ...VEHICLES.map((v) => ({ url: `${base}/cars/${v.id}` }))];
}
