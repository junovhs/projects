// projects/api/discover.js
import { discoverAssets } from './lib/asset-sucker-helpers.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { url, limit } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    // Add protocol if missing
    const target = url.startsWith('http') ? url : `https://${url}`;
    
    const data = await discoverAssets(target, Number(limit) || 150);
    
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}