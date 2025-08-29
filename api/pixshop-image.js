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
    const t0 = Date.now();
    const body = await readBody(req);
    const { mode = 'retouch', prompt = '', image, hotspot, outcrop } = body || {};
    if (!image || typeof image !== 'string') return send(res, 400, { error: 'Missing image dataUrl' });

    // Parse data URL
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
      adjust: 'Perform global photo adjustments (exposure, contrast, white balance) to enhance realism. Minimal changes; no additions.'
    };

    // Outcrop template (extend canvas). We rely on the client to embed a solid black blank region.
    let outcropTemplate = '';
    if (mode === 'outcrop') {
      const side = outcrop?.side || 'right';
      const frac = Math.max(0.01, Math.min(0.6, Number(outcrop?.frac) || 0.2)); // 1–60%
      // Norm rect of original content inside the larger canvas (optional, improves control)
      const nr = outcrop?.normRect;
      const norm = (nr && typeof nr.l === 'number')
        ? `Original content normalized rect: left=${nr.l.toFixed(3)}, top=${nr.t.toFixed(3)}, right=${nr.r.toFixed(3)}, bottom=${nr.b.toFixed(3)}.`
        : '';
      outcropTemplate = [
        `Extend the scene by filling ONLY the solid black blank strip added on the ${side} side (about ${(frac*100).toFixed(0)}% of the new ${side==='left'||side==='right'?'width':'height'}).`,
        'Do not alter any existing pixel from the original region; treat it as locked.',
        'Synthesize new content that matches perspective, lighting, textures, reflections, and horizon, producing a seamless extension with no visible boundary.',
        'Do not crop or change the final resolution; return a single, completed image exactly the same size as the input.',
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

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!r.ok) {
      const errText = await r.text();
      return send(res, r.status, { error: 'Gemini error', details: errText });
    }

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

    const elapsedMs = Date.now() - t0;
    return send(res, 200, {
      model: MODEL,
      elapsedMs,
      dataUrl
    });
  } catch (e) {
    return send(res, 500, { error: 'server', details: e?.message || String(e) });
  }
}
