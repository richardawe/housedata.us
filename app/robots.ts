import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/packets/"],
      },
    ],
    sitemap: "https://housedata.us/sitemap.xml",
  };
}
