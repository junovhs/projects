// Plain Node response helpers (no Express/Next sugar)
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method Not Allowed' });
  }

  return send(res, 200, {
    ok: true,
    env: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      AI_API_PASSWORD: Boolean(process.env.AI_API_PASSWORD),
    },
  });
}
