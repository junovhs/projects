// projects/api/asset-sucker/scrape.js
import { discoverAssets } from '../_lib/asset-sucker-helpers.js';
import { log } from '../_lib/log.js';

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS is now handled by vercel.json, no headers needed here.

  if (req.method !== 'POST') {
    // The browser might send an OPTIONS request first. Vercel handles this.
    // We only care about POST requests for the actual logic.
    if (req.method !== 'OPTIONS') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    return res.status(204).send(''); // Respond to OPTIONS
  }

  const { url, limit } = req.body;

  try {
    if (!url || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Invalid or missing 'url' parameter." });
    }

    const assetLimit = Math.min(Number(limit || 120), 300);
    const { assets, counts } = await discoverAssets(url, assetLimit);

    log('info', 'asset-sucker', 'scrape_success', { url, limit: assetLimit, found: assets.length });

    return res.status(200).json({ ok: true, assets, counts, total: assets.length });

  } catch (e) {
    log('error', 'asset-sucker', 'scrape_failed', { url, error: e?.message || 'Unknown error' });
    return res.status(500).json({ error: 'Failed to discover assets.', details: e?.message });
  }
}