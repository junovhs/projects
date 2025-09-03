// /api/storage.js
// Node Serverless Function (NOT Edge)
// Returns { usedBytes, count, totalBytes?: number | null }
import { head } from "@vercel/blob";

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

export default async function handler(_req, res) {
  try {
    const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
    const usedBytes = meta.items.reduce((a, b) => a + (Number(b.size) || 0), 0);
    const totalBytes = Number(process.env.BLOB_TOTAL_BYTES || 0) || null;
    return res.status(200).json({
      usedBytes,
      count: meta.items.length,
      totalBytes,
      availableBytes: totalBytes ? Math.max(0, totalBytes - usedBytes) : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message ?? "Server error");
  }
}
