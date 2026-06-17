import type { MetadataRoute } from "next";

const BASE = "https://housedata.us";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE}/texas`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE}/texas/harris-tx`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${BASE}/texas/travis-tx`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${BASE}/texas/collin-tx`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${BASE}/calendar`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
