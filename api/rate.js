import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { episodeId, stars } = req.body || {};
    if (!/^[Ss]\d{2}E\d{2}$/.test(String(episodeId))) return res.status(400).json({ error: 'bad episodeId' });
    const s = Number(stars);
    if (!(s >= 1 && s <= 5)) return res.status(400).json({ error: 'bad stars' });

    const key = `sunny:ep:${String(episodeId).toUpperCase()}`;
    await kv.hincrby(key, 'totalStars', s);
    await kv.hincrby(key, 'voteCount', 1);

    const data = await kv.hgetall(key); // { totalStars, voteCount } (strings)
    const total = Number(data?.totalStars || 0);
    const votes = Number(data?.voteCount || 0);
    res.json({ average: votes ? total / votes : 0, votes });
  } catch (e) {
    res.status(500).json({ error: 'server', details: e?.message });
  }
}
