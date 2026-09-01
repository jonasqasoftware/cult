import type { MetadataRoute } from "next";

function getSiteUrl(): string {
  return process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
}

// M10 sections 18/19 — staging must never be indexed; production may index the discovery
// home and event detail pages, but never technical endpoints. Gated on CULT_ENV (M10
// section 9's environment model), not NODE_ENV: a production Next.js build running in
// staging still has NODE_ENV=production, and must still come back noindex.
function isProduction(): boolean {
  return process.env["CULT_ENV"] === "production";
}

export default function robots(): MetadataRoute.Robots {
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/eventos/", "/privacidade", "/sobre"],
      disallow: ["/api/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
