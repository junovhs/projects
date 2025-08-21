// projects/api/asset-sucker/scrape.js
import { discoverAssets } from '../_lib/asset-sucker-helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url, limit } = req.body;
    if (!url) return res.status(400).json({ error: "Missing 'url'." });

    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http(s) URLs allowed.' });
    }

    const { assets, counts } = await discoverAssets(parsed.toString(), Math.min(Number(limit || 120), 300));
    return res.json({ ok: true, assets, counts, total: assets.length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}