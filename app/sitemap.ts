import type { MetadataRoute } from "next";
import { listScripts, listGames } from "@/lib/data";
import { SITE } from "@/lib/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/scripts`, lastModified: now, priority: 0.9 },
    { url: `${base}/jogos`, lastModified: now, priority: 0.8 },
  ];

  let scriptRoutes: MetadataRoute.Sitemap = [];
  let gameRoutes: MetadataRoute.Sitemap = [];

  try {
    const [scripts, games] = await Promise.all([
      listScripts({ limit: 48, sort: "newest" }),
      listGames({ limit: 60, status: "approved" }),
    ]);

    scriptRoutes = scripts.items.map((s) => ({
      url: `${base}/scripts/${s.slug}`,
      lastModified: s.updatedAt ? new Date(s.updatedAt) : now,
      priority: 0.8,
    }));

    gameRoutes = games.items.map((g) => ({
      url: `${base}/jogos/${g.placeId}`,
      lastModified: g.updatedAt ? new Date(g.updatedAt) : now,
      priority: 0.7,
    }));
  } catch {
    /* segue com as rotas fixas */
  }

  return [...staticRoutes, ...scriptRoutes, ...gameRoutes];
}
