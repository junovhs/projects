// /api/images.js
export const config = { runtime: "edge" };

import { handleUpload } from "@vercel/blob/client";
import { head, put, del } from "@vercel/blob";

const META_IMAGES = "meta/images.json";

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
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      return json(meta.items);
    }

    if (method === "POST") {
      // Works both for token exchange + webhook (Blob client) and plain JSON body
      const body = await req.json().catch(() => ({}));

      try {
        const resp = await handleUpload({
          request: req,
          body,
          onBeforeGenerateToken: async () => ({
            allowedContentTypes: [
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/gif"
            ],
            addRandomSuffix: true,
            tokenPayload: "{}"
          }),
          onUploadCompleted: async ({ blob }) => {
            const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
            meta.items.push({
              id: blob.pathname, // pathname as ID
              name: blob.pathname.split("/").pop(),
              url: blob.url,
              pathname: blob.pathname,
              uploadDate: new Date().toISOString(),
              tags: [],
              size: blob.size
            });
            await saveJson(META_IMAGES, meta);
          }
        });

        return json(resp);
      } catch (e) {
        return json({ error: e?.message ?? "Upload failed" }, 500);
      }
    }

    if (method === "PUT") {
      const { id, name, tags } = await req.json().catch(() => ({}));
      if (!id) return json({ error: "Missing id" }, 400);

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return json({ error: "Not found" }, 404);

      if (name != null) meta.items[idx].name = name;
      if (Array.isArray(tags)) meta.items[idx].tags = Array.from(new Set(tags));

      await saveJson(META_IMAGES, meta);
      return json({ ok: true });
    }

    if (method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return json({ error: "Not found" }, 404);

      try {
        await del(meta.items[idx].pathname);
      } catch {
        // ignore if blob already gone
      }
      meta.items.splice(idx, 1);
      await saveJson(META_IMAGES, meta);
      return json({ ok: true });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
}
