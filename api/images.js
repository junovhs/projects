import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { list, head, put, del } from "@vercel/blob";

const META_IMAGES = "meta/images.json";

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

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const body = await req.json();

      const json = await handleUpload({
        request: req,
        body: body,
        onBeforeGenerateToken: async () => {
          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
            addRandomSuffix: true,
            tokenPayload: "{}",
          };
        },
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

    if (req.method === "GET") {
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      return res.status(200).json(meta.items);
    }

    if (req.method === "PUT") {
      const { id, name, tags } = await req.json();
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => it.id === id);
      if (idx === -1) return res.status(404).send("Not found");
      if (name) meta.items[idx].name = name;
      if (tags) meta.items[idx].tags = Array.from(new Set(tags));
      await saveJson(META_IMAGES, meta);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex((it) => it.id === id);
      if (idx === -1) return res.status(404).send("Not found");

      await del(meta.items[idx].pathname);
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
