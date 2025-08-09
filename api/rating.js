import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const episodeId = req.query.episodeId;
  if (!/^[Ss]\d{2}E\d{2}$/.test(String(episodeId))) return res.status(400).json({ error: 'bad episodeId' });

  const key = `sunny:ep:${String(episodeId).toUpperCase()}`;
  const data = await kv.hgetall(key);
  const total = Number(data?.totalStars || 0);
  const votes = Number(data?.voteCount || 0);
  res.json({ average: votes ? total / votes : 0, votes });
}
