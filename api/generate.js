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

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*"); // tighten if you want
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
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return send(res, 500, { error: "GEMINI_API_KEY not configured on the server" });

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

    // Model selection (defaults to 2.5 Flash)
    const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // REST endpoint
    const geminiApiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Convert chat messages to Gemini "contents"
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    // Build payload (no thinkingConfig here)
    const payload = { contents };
    if (json) {
      // JSON mode via generationConfig (REST)
      payload.generationConfig = { response_mime_type: "application/json" };
    }

    // Call Gemini
    const r = await fetch(geminiApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      return send(res, r.status, { error: "Gemini error", details: errText });
    }

    const data = await r.json();

    // Extract text defensively
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      (Array.isArray(data?.candidates?.[0]?.content?.parts)
        ? data.candidates[0].content.parts.map((p) => p?.text).filter(Boolean).join("\n")
        : "") ??
      "";

    return send(res, 200, { model: MODEL, content: text });
  } catch (e) {
    return send(res, 500, { error: "server", details: e?.message || String(e) });
  }
}
