// Helpers
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  if (req.body != null) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // tighten if you want
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return send(res, 405, { error: 'Method Not Allowed' });
  }

  // Password check (Bearer)
  const PASSWORD = process.env.AI_API_PASSWORD;
  if (!PASSWORD) return send(res, 500, { error: 'Server misconfigured: AI_API_PASSWORD missing' });
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || token !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="AI API", error="invalid_token"');
    return send(res, 401, { error: 'Unauthorized' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return send(res, 500, { error: 'GEMINI_API_KEY not configured on the server' });

  try {
    // Parse JSON body
    let raw = await readBody(req);
    let body = raw;
    if (typeof raw === 'string') {
      try { body = JSON.parse(raw); } catch { body = {}; }
    }
    if (!body || !Array.isArray(body.messages)) {
      return send(res, 400, { error: "Invalid request: 'messages' array required" });
    }
    const { messages = [], json = false } = body;

    // Build Gemini request
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
      return send(res, r.status, { error: 'Gemini error', details: errText });
    }

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return send(res, 200, { content: text });
  } catch (e) {
    return send(res, 500, { error: 'server', details: e?.message || String(e) });
  }
}
