// /api/albums.js
export const config = { runtime: "edge" };

import { head, put } from "@vercel/blob";

const META_ALBUMS = "meta/albums.json";

// --- helpers ---
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });

async function loadJson(path, fallback) {
  try {
    const info = await head(path);
    const res = await fetch(info.downloadUrl, { cache: "no-store" });
    return await res.json();
  } catch {
    return fallback;
  }
}

async function saveJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    // @ts-ignore
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0
  });
}

// --- handler ---
export default async function handler(req) {
  try {
    const { method } = req;

    if (method === "GET") {
      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      return json(meta.items);
    }

    if (method === "POST") {
      const album = await req.json().catch(() => ({}));
      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      meta.items.push(album);
      await saveJson(META_ALBUMS, meta);
      return json({ id: album.id }, 201);
    }

    if (method === "PUT") {
      const album = await req.json().catch(() => ({}));
      if (!album?.id) return json({ error: "Missing album.id" }, 400);

      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      const idx = meta.items.findIndex((a) => String(a.id) === String(album.id));
      if (idx === -1) return json({ error: "Not found" }, 404);

      meta.items[idx] = album;
      await saveJson(META_ALBUMS, meta);
      return json({ ok: true });
    }

    if (method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);

      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      const idx = meta.items.findIndex((a) => String(a.id) === String(id));
      if (idx === -1) return json({ error: "Not found" }, 404);

      meta.items.splice(idx, 1);
      await saveJson(META_ALBUMS, meta);
      return json({ ok: true });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
}
