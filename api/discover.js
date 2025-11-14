// FILE: api/discover.js
import { discoverAssets } from './lib/asset-sucker-helpers.js';
import { log } from './lib/log.js';

const MAX_LIMIT = 300;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 120;

function validateUrl(url) {
  if (!url) return { valid: false, error: "Missing 'url' parameter" };

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return { valid: false, error: "Only http(s) URLs allowed" };
  }

  return { valid: true, url: parsed.toString() };
}

function validateLimit(rawLimit) {
  const limit = Number(rawLimit || DEFAULT_LIMIT);

  if (!Number.isFinite(limit) || limit < MIN_LIMIT) {
    return MIN_LIMIT;
  }

  if (limit > MAX_LIMIT) {
    return MAX_LIMIT;
  }

  return Math.floor(limit);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { url: rawUrl, limit: rawLimit } = req.body || {};

    const urlValidation = validateUrl(rawUrl);
    if (!urlValidation.valid) {
      log('warn', 'asset-discover', 'invalid_url', { url: rawUrl, error: urlValidation.error });
      return res.status(400).json({ error: urlValidation.error });
    }

    const limit = validateLimit(rawLimit);
    const url = urlValidation.url;

    log('info', 'asset-discover', 'scan_start', { url, limit });

    const { assets, counts } = await discoverAssets(url, limit);

    log('info', 'asset-discover', 'scan_complete', {
      url,
      limit,
      total: assets.length,
      counts
    });

    return res.status(200).json({
      ok: true,
      assets,
      counts,
      total: assets.length
    });

  } catch (e) {
    log('error', 'asset-discover', 'scan_failed', {
      url: req.body?.url,
      error: e?.message || String(e)
    });

    return res.status(500).json({
      error: e?.message || 'Asset discovery failed'
    });
  }
}
