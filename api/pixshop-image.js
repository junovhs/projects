// projects/api/pixshop-image.js
import { requireBearerAuth } from './_lib/auth.js';

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  if (req.body != null) return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });

  if (!requireBearerAuth(req, res)) return; // sends 401 on failure

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = (process.env.GEMINI_IMG_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash-image-preview').trim();
  if (!GEMINI_API_KEY) return send(res, 500, { error: 'GEMINI_API_KEY is not set' });

  try {
    const body = await readBody(req);
    const { mode = 'retouch', prompt = '', image, hotspot } = body || {};
    if (!image || typeof image !== 'string') return send(res, 400, { error: 'Missing image dataUrl' });

    const [head, b64] = image.split(',');
    const mimeMatch = /^data:(.*?);base64$/.exec(head || '');
    if (!mimeMatch || !b64) return send(res, 400, { error: 'Invalid image dataUrl' });
    const mimeType = mimeMatch[1];

    const templates = {
      retouch: [
        'You are an expert photo retoucher. Improve the local region around the user focus point. Keep global composition, identity, lighting, and background unchanged.',
        hotspot && typeof hotspot.x==='number' && typeof hotspot.y==='number' ? `Focus (normalized): x=${hotspot.x.toFixed(3)}, y=${hotspot.y.toFixed(3)}.` : 'Focus: not specified.'
      ].filter(Boolean).join(' '),
      filter: 'Apply a global, stylistic color-grade/texture filter only. Do not add/remove objects; preserve geometry and layout.',
      adjust: 'Perform global photo adjustments (exposure, contrast, white balance) to enhance realism. Minimal changes; no additions.'
    };

    const fullPrompt = `${templates[mode] || templates.retouch}\n\nUser request: ${prompt}`.trim();

    const contents = {
      parts: [
        { inlineData: { mimeType, data: b64 } },
        { text: fullPrompt }
      ]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
    if (!r.ok) return send(res, r.status, { error: 'Gemini error', details: await r.text() });

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inline = parts.find(p => p?.inlineData?.data && p?.inlineData?.mimeType);

    if (!inline) {
      const maybeText = parts.map(p => p?.text).filter(Boolean).join('\n');
      return send(res, 422, { error: 'No image returned', details: maybeText || 'Response did not include an image part.' });
    }

    const outMime = inline.inlineData.mimeType || 'image/png';
    const outB64 = inline.inlineData.data;
    const dataUrl = `data:${outMime};base64,${outB64}`;

    return send(res, 200, { model: MODEL, dataUrl });
  } catch (e) {
    return send(res, 500, { error: 'server', details: e?.message || String(e) });
  }
}