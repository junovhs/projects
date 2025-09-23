// api/generate.js

// --- helpers ---
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  if (req.body != null) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const ALLOWED_MODELS = new Set([
  "x-ai/grok-4-fast:free",
]);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Method Not Allowed" });
  }

  // Password check (Bearer)
  const PASSWORD = process.env.AI_API_PASSWORD;
  if (!PASSWORD) return send(res, 500, { error: "Server misconfigured: AI_API_PASSWORD missing" });

  const auth = req.headers.authorization || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || token !== PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="AI API", error="invalid_token"');
    return send(res, 401, { error: "Unauthorized" });
  }

  // API key
  const AI_API_KEY = process.env.AI_API_KEY;
  if (!AI_API_KEY) return send(res, 500, { error: "AI_API_KEY not configured on the server" });

  try {
    // Parse JSON body
    let raw = await readBody(req);
    let body = raw;
    if (typeof raw === "string") {
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    if (!body || !Array.isArray(body.messages)) {
      return send(res, 400, { error: "Invalid request: 'messages' array required" });
    }

    const { messages = [], json = false } = body;

    // Model selection: allow override via body.model (whitelisted), else env, else default
    const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
    const MODEL = ALLOWED_MODELS.has(requestedModel)
      ? requestedModel
      : (process.env.XAI_MODEL || "x-ai/grok-4-fast:free");

    // OpenRouter endpoint
    const openRouterApiUrl = `https://openrouter.ai/api/v1/chat/completions`;

    // Build payload
    const payload = {
      model: MODEL,
      messages,
    };
    if (json) {
      payload.response_format = { type: "json_object" };
    }

    // Call OpenRouter
    const r = await fetch(openRouterApiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      return send(res, r.status, { error: "OpenRouter error", details: errText });
    }

    const data = await r.json();

    // Extract content defensively
    const text =
      data?.choices?.[0]?.message?.content ??
      "";

    return send(res, 200, { model: MODEL, content: text });
  } catch (e) {
    return send(res, 500, { error: "server", details: e?.message || String(e) });
  }
}