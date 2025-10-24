// projects/api/asset-sucker/proxy.js
import { fetchBinaryWithBudget } from '../_lib/net.js';
import { log } from '../_lib/log.js';

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
  try {
    const { url: rawUrl, download: asDownload } = req.query;

    if (!rawUrl || !isValidHttpUrl(rawUrl)) {
      return res.status(400).send('Invalid or missing URL parameter.');
    }

    const url = new URL(rawUrl);

    // GUARDRAIL: Enforce hostname allow-list.
    if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.includes(url.hostname)) {
      log('warn', 'asset-proxy', 'host_not_allowed', { hostname: url.hostname, url: rawUrl });
      return res.status(403).send('Forbidden: Hostname is not in the allow-list.');
    }

    // Use the bounded fetch helper.
    const data = await fetchBinaryWithBudget(url.toString(), {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
    const buffer = Buffer.from(data);

    // Fetching the content-type requires another request, so we try to infer it.
    // A more robust solution might involve a HEAD request first, but that adds latency.
    const contentType = 'application/octet-stream'; // Default content type

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); // Cache for 1 day

    if (process.env.PROXY_CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', process.env.PROXY_CORS_ORIGIN);
    }

    if (asDownload === '1') {
      const filename = url.pathname.split('/').pop() || 'download';
      const safeFilename = filename.replace(/[^a-z0-9._-]/gi, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    return res.status(200).send(buffer);

  } catch (e) {
    log('error', 'asset-proxy', 'proxy_failed', {
      url: req.query?.url,
      error: e?.message || 'Unknown error',
    });
    // Respond with a client-friendly error based on the exception type.
    if (e.message.includes('timeout')) {
      return res.status(504).send('Gateway Timeout: The upstream server took too long to respond.');
    }
    if (e.message.includes('too large')) {
      return res.status(413).send('Payload Too Large: The requested resource exceeds the size limit.');
    }
    return res.status(502).send('Bad Gateway: Could not proxy the request.');
  }
}