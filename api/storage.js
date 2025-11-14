// projects/api/storage.js
import { head } from "@vercel/blob";
import { log } from "./lib/log.js";

async function loadJson(path, fallback) {
  try {
    const info = await head(path);
    // Use a short cache timeout to avoid hitting rate limits on `head`
    const res = await fetch(info.downloadUrl, { next: { revalidate: 60 } });
    if (!res.ok) {
      throw new Error(`Failed to fetch metadata: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    // This is an expected case if the file doesn't exist yet, so log as info.
    log('info', 'storage', 'metadata_not_found', { path, fallback_used: true });
    return fallback;
  }
}

export default async function handler(_req, res) {
  try {
    const meta = await loadJson("meta/images.json", { version: 1, items: [] });
    const usedBytes = meta.items.reduce((acc, item) => acc + (Number(item.size) || 0), 0);
    const totalBytes = Number(process.env.BLOB_TOTAL_BYTES || 0) || null;

    const response = {
      usedBytes,
      count: meta.items.length,
      totalBytes,
      availableBytes: totalBytes ? Math.max(0, totalBytes - usedBytes) : null,
    };

    // Cache this response to reduce backend load.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(response);

  } catch (e) {
    log('error', 'storage', 'list_failed', { err: String(e?.message || e) });
    return res.status(500).json({ error: "Server error", details: e?.message });
  }
}