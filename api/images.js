// /api/images.js
// Node Serverless Function (NOT Edge)
import { handleUpload } from "@vercel/blob/client";
import { head, put, del } from "@vercel/blob";

const META_IMAGES = "meta/images.json";
const REQ_HEADER = "x-api-password";

// ---------- helpers ----------
function getPasswordFromReq(req) {
  const h = (req.headers?.[REQ_HEADER] || req.headers?.authorization || "").toString();
  if (h.startsWith("Bearer ")) return h.slice(7);
  return h || null;
}
function requireAuth(req, res) {
  const expected = process.env.AI_API_PASSWORD || "";
  const provided = getPasswordFromReq(req);
  if (!expected || provided === expected) return true;
  res.status(401).send("Unauthorized");
  return false;
}

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
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      // also include a quick-used-bytes header for convenience
      const used = meta.items.reduce((a, b) => a + (Number(b.size) || 0), 0);
      res.setHeader("x-used-bytes", String(used));
      return res.status(200).json(meta.items);
    }

    if (req.method === "POST") {
      if (!requireAuth(req, res)) return;

      const body = parseBody(req);
      const json = await handleUpload({
        request: req,
        body,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],
          addRandomSuffix: true,
          tokenPayload: "{}",
        }),
        onUploadCompleted: async ({ blob }) => {
          const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
          meta.items.push({
            id: blob.pathname, // use pathname as ID
            name: blob.pathname.split("/").pop(),
            url: blob.url,
            pathname: blob.pathname,
            uploadDate: new Date().toISOString(),
            tags: [],
            size: blob.size,
          });
          await saveJson(META_IMAGES, meta);
        },
      });

      return res.status(200).json(json);
    }

    if (req.method === "PUT") {
      if (!requireAuth(req, res)) return;

      const { id, name, tags } = parseBody(req);
      if (!id) return res.status(400).send("Missing id");

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return res.status(404).send("Not found");

      if (name != null) meta.items[idx].name = name;
      if (Array.isArray(tags)) meta.items[idx].tags = Array.from(new Set(tags));

      await saveJson(META_IMAGES, meta);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      if (!requireAuth(req, res)) return;

      const { id } = req.query || {};
      if (!id) return res.status(400).send("Missing id");

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return res.status(404).send("Not found");

      try {
        await del(meta.items[idx].pathname);
      } catch {
        // ignore if blob already deleted
      }
      meta.items.splice(idx, 1);
      await saveJson(META_IMAGES, meta);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return res.status(405).send("Method Not Allowed");
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message ?? "Server error");
  }
}
