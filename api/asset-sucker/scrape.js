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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, limit } = req.body;

  try {
    // GUARDRAIL: Validate input before use.
    if (!url || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Invalid or missing 'url' parameter." });
    }

    // BOUNDS: Enforce a clear, visible limit.
    const assetLimit = Math.min(Number(limit || 120), 300);

    const { assets, counts } = await discoverAssets(url, assetLimit);

    log('info', 'asset-sucker', 'scrape_success', {
      url,
      limit: assetLimit,
      found: assets.length
    });

    return res.status(200).json({ ok: true, assets, counts, total: assets.length });

  } catch (e) {
    log('error', 'asset-sucker', 'scrape_failed', {
      url,
      error: e?.message || 'Unknown error'
    });
    return res.status(500).json({ error: 'Failed to discover assets.', details: e?.message });
  }
}