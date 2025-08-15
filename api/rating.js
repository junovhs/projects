// /api/rating.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS (safe even if same-origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Accept new "id" or legacy "episodeId"
  const rawId =
    req.query.id ||
    req.query.episodeId ||
    req.body?.id ||
    req.body?.episodeId ||
    '';
  const id = String(rawId).trim();
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const key = `rating:${id}`;

  try {
    if (req.method === 'GET') {
      const data = await kv.hgetall(key); // { count, total } as strings or null
      const count = Number(data?.count || 0);
      const total = Number(data?.total || 0);
      const average = count ? +(total / count).toFixed(2) : 0;
      // Light caching for reads
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.json({ id, average, count });
    }

    if (req.method === 'POST') {
      const stars = Number(req.body?.stars);
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
        return res.status(400).json({ error: 'stars must be 1-5' });
      }
      await kv.hincrby(key, 'count', 1);
      await kv.hincrby(key, 'total', stars);
      const data = await kv.hgetall(key);
      const count = Number(data?.count || 0);
      const total = Number(data?.total || 0);
      const average = count ? +(total / count).toFixed(2) : 0;
      return res.json({ id, average, count });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).end('Method Not Allowed');
  } catch (e) {
    return res.status(500).json({ error: 'server', details: e?.message });
  }
}
