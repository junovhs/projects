import { requireBearerAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // restrict in prod if you want
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!requireBearerAuth(req, res)) return;

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY missing');
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on the server' });
  }

  try {
    const body = req.body;
    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Invalid request: 'messages' array required" });
    }
    const { messages = [], json = false } = body;

    const geminiApiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '') }]
    }));

    const payload = {
      contents,
      ...(json ? { generationConfig: { response_mime_type: 'application/json' } } : {})
    };

    const r = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error(`Gemini API Error (${r.status}):`, errText);
      return res.status(r.status).json({ error: 'Gemini error', details: errText });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ content: text });
  } catch (e) {
    console.error('Error in /api/generate:', e);
    return res.status(500).json({ error: 'server', details: e?.message || String(e) });
  }
}
