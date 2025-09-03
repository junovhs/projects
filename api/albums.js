// /api/albums.js
// Node Serverless Function (NOT Edge)
import { head, put } from "@vercel/blob";

const META_ALBUMS = "meta/albums.json";

// ---------- helpers ----------
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
    cacheControlMaxAge: 0,
  });
}

function parseBody(req) {
  try {
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    if (req.body && typeof req.body === "object") return req.body;
    return {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      return res.status(200).json(meta.items);
    }

    if (req.method === "POST") {
      const album = parseBody(req);
      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      meta.items.push(album);
      await saveJson(META_ALBUMS, meta);
      return res.status(201).json({ id: album.id });
    }

    if (req.method === "PUT") {
      const album = parseBody(req);
      if (!album?.id) return res.status(400).send("Missing album.id");

      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      const idx = meta.items.findIndex((a) => String(a.id) === String(album.id));
      if (idx === -1) return res.status(404).send("Not found");

      meta.items[idx] = album;
      await saveJson(META_ALBUMS, meta);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.query || {};
      if (!id) return res.status(400).send("Missing id");

      const meta = await loadJson(META_ALBUMS, { version: 1, items: [] });
      const idx = meta.items.findIndex((a) => String(a.id) === String(id));
      if (idx === -1) return res.status(404).send("Not found");

      meta.items.splice(idx, 1);
      await saveJson(META_ALBUMS, meta);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return res.status(405).send("Method Not Allowed");
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message ?? "Server error");
  }
}
