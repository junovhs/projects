// FILE: api/proxy.js
import { fetchBinaryWithBudget } from './lib/net.js';
import { log } from './lib/log.js';

// Read configuration from environment variables.
const ALLOWED_HOSTS = String(process.env.PROXY_ALLOW_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BYTES = Number(process.env.PROXY_MAX_BYTES || 10_000_000); // 10MB default
const FETCH_TIMEOUT_MS = 15_000;

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  // Set CORS headers for all responses.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const { url: rawUrl, download: asDownload } = req.query;

    if (!rawUrl || !isValidHttpUrl(rawUrl)) {
      return res.status(400).send('Invalid or missing URL parameter.');
    }

    const url = new URL(rawUrl);

    if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.includes(url.hostname)) {
      log('warn', 'asset-proxy', 'host_not_allowed', { hostname: url.hostname, url: rawUrl });
      return res.status(403).send('Forbidden: Hostname is not in the allow-list.');
    }

    const data = await fetchBinaryWithBudget(url.toString(), {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
    const buffer = Buffer.from(data);

    // Temporarily default to octet-stream. A HEAD request would be needed for the real type.
    const contentType = 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    if (asDownload === '1') {
      const filename = url.pathname.split('/').pop() || 'download';
      const safeFilename = filename.replace(/[^a-z0-9._-]/gi, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    return res.status(200).send(buffer);

  } catch (e) {
    log('error', 'asset-proxy', 'proxy_failed', { url: req.query?.url, error: e?.message });
    if (e.message.includes('timeout')) return res.status(504).send('Gateway Timeout');
    if (e.message.includes('too large')) return res.status(413).send('Payload Too Large');
    return res.status(502).send('Bad Gateway');
  }
}