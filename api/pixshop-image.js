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

  if (!requireBearerAuth(req, res)) return; // sends 401

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = (process.env.GEMINI_IMG_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash-image-preview').trim();
  if (!GEMINI_API_KEY) return send(res, 500, { error: 'GEMINI_API_KEY is not set' });

  try {
    const t0 = Date.now();
    const body = await readBody(req);
    const { mode = 'retouch', prompt = '', image, hotspot, outcrop } = body || {};
    if (!image || typeof image !== 'string') return send(res, 400, { error: 'Missing image dataUrl' });

    const [head, b64] = String(image).split(',');
    const mimeMatch = /^data:(.*?);base64$/.exec(head || '');
    if (!mimeMatch || !b64) return send(res, 400, { error: 'Invalid image dataUrl' });
    const mimeType = mimeMatch[1];

    const baseTemplates = {
      retouch: [
        'You are an expert photo retoucher. Improve the local region around the user focus point.',
        'Keep global composition, identity, lighting, and background unchanged.',
        (hotspot && typeof hotspot.x === 'number' && typeof hotspot.y === 'number')
          ? `Focus (normalized): x=${hotspot.x.toFixed(3)}, y=${hotspot.y.toFixed(3)}.`
          : 'Focus: not specified.'
      ].join(' '),
      filter: 'Apply a global, stylistic color-grade/texture filter only. Do not add/remove objects; preserve geometry and layout.',
      adjust: 'Perform global photo adjustments (exposure, contrast, white balance). Minimal changes; no additions.'
    };

    // Outcrop (double-pad) prompt: the client sends a canvas where the blank strip is ~2× the final extension width.
    let outcropTemplate = '';
    if (mode === 'outcrop') {
      const side = outcrop?.side || 'right';
      const frac = Math.max(0.01, Math.min(0.6, Number(outcrop?.frac) || 0.2));
      const nr = outcrop?.normRect; // normalized rect of the original inside the larger canvas
      const norm = (nr && typeof nr.l === 'number')
        ? `Original content normalized rect: left=${nr.l.toFixed(3)}, top=${nr.t.toFixed(3)}, right=${nr.r.toFixed(3)}, bottom=${nr.b.toFixed(3)}.`
        : '';

      outcropTemplate = [
        `A solid black strip has been added on the ${side} side, about ${(frac*200).toFixed(0)}% of the final extension width (double-pad).`,
        'Fill ONLY the black strip and produce a seamless continuation of the scene.',
        'Do not alter any pixel of the non-black (original) area; treat those pixels as locked.',
        'Match perspective, lighting, horizon, textures, and reflections.',
        'Return exactly one completed image at the same resolution as the input.',
        norm
      ].filter(Boolean).join(' ');
    }

    const fullPrompt = [
      mode === 'outcrop' ? outcropTemplate : (baseTemplates[mode] || baseTemplates.retouch),
      prompt ? `User request: ${prompt}` : ''
    ].filter(Boolean).join('\n\n');

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

    return send(res, 200, { model: MODEL, elapsedMs: Date.now() - t0, dataUrl });
  } catch (e) {
    return send(res, 500, { error: 'server', details: e?.message || String(e) });
  }
}
