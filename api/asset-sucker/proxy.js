// projects/api/asset-sucker/proxy.js
function isHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

export default async function handler(req, res) {
  try {
    const { url: raw, download: asDownload } = req.query;

    if (!raw || !isHttpUrl(raw)) {
      return res.status(400).send('Bad URL');
    }

    const upstream = await fetch(raw, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(502).send(`Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, immutable');

    if (asDownload === '1') {
      const name = (() => {
        try {
          const u = new URL(raw);
          const base = u.pathname.split('/').pop() || 'file';
          return base.replace(/[^a-z0-9._-]/gi, '_');
        } catch { return 'file'; }
      })();
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    }

    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).send(e?.message || 'Proxy error');
  }
}