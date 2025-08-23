// /api/episode.js
import { kv } from '@vercel/kv';

function clamp05(n) { return Math.max(0, Math.min(5, Number(n) || 0)); }
function normalize(score) {
  if (!score) return null;
  const overall = clamp05(score.overall);
  const rewatch = clamp05(score.rewatch);
  const quote   = clamp05(score.quote);
  const chaos   = clamp05(score.chaos);
  const total   = overall + rewatch + quote + chaos; // 0–20
  return { overall, rewatch, quote, chaos, total };
}
function average(ratings) {
  const slots = ['a','b'].map(s => ratings?.[s]).filter(Boolean);
  const count = slots.length || 0;
  if (!count) return { average:{overall:0,rewatch:0,quote:0,chaos:0,total:0}, count:0 };
  const sum = slots.reduce((acc,s)=>({
    overall:acc.overall+s.overall, rewatch:acc.rewatch+s.rewatch,
    quote:acc.quote+s.quote, chaos:acc.chaos+s.chaos, total:acc.total+s.total
  }), {overall:0,rewatch:0,quote:0,chaos:0,total:0});
  return {
    average: {
      overall: sum.overall / count,
      rewatch: sum.rewatch / count,
      quote:   sum.quote   / count,
      chaos:   sum.chaos   / count,
      total:   sum.total   / count,
    },
    count
  };
}

export default async function handler(req, res) {
  // CORS similar to /api/rating.js
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const id = String(req.query.id || req.body?.id || '').trim();
  const key = `episode:${id}`;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    if (req.method === 'GET') {
      const doc = (await kv.get(key)) || { ratings: { a:null, b:null } };
      const { average: avg, count } = average(doc.ratings);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.json({ id, ratings: doc.ratings, average: avg, count });
    }

    if (req.method === 'POST') {
      const slot = (req.body?.slot || '').toLowerCase();
      const score = normalize(req.body?.score);
      if (!score) return res.status(400).json({ error: 'Invalid score' });

      const doc = (await kv.get(key)) || { ratings: { a:null, b:null } };

      let s = slot;
      if (!['a','b'].includes(s)) {
        // auto-pick a free slot; enforce max 2
        if (!doc.ratings.a) s = 'a';
        else if (!doc.ratings.b) s = 'b';
        else return res.status(409).json({ error: 'Both rating slots are filled (max 2).' });
      }

      doc.ratings[s] = score;
      await kv.set(key, doc);

      const { average: avg, count } = average(doc.ratings);
      return res.json({ id, savedSlot: s, ratings: doc.ratings, average: avg, count });
    }

    if (req.method === 'DELETE') {
      const s = (req.query.slot || '').toLowerCase(); // optional
      if (s && !['a','b'].includes(s)) return res.status(400).json({ error: 'slot must be a|b' });

      if (s) {
        const doc = (await kv.get(key)) || { ratings: { a:null, b:null } };
        doc.ratings[s] = null;
        await kv.set(key, doc);
      } else {
        await kv.del(key); // wipe both slots
      }

      const doc2 = (await kv.get(key)) || { ratings: { a:null, b:null } };
      const { average: avg, count } = average(doc2.ratings);
      return res.json({ id, ratings: doc2.ratings, average: avg, count });
    }

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).end('Method Not Allowed');
  } catch (e) {
    return res.status(500).json({ error: 'server', details: e?.message });
  }
}
