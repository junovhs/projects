// projects/api/asset-sucker/download.js
import JSZip from 'jszip';
import { discoverAssets, cleanFileName, extCategory } from '../_lib/asset-sucker-helpers.js';

async function fetchBinary(u) {
  const res = await fetch(u, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url, limit } = req.body;
    if (!url) return res.status(400).json({ error: "Missing 'url'." });

    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http(s) URLs allowed.' });
    }

    const { assets } = await discoverAssets(parsed.toString(), Math.min(Number(limit || 120), 300));

    const zip = new JSZip();
    const manifest = [];
    const CONC = 6;
    let i = 0;

    const worker = async () => {
      while (i < assets.length) {
        const idx = i++;
        const asset = assets[idx];
        try {
          const data = await fetchBinary(asset.url);
          const { category } = extCategory(asset.url);
          const pathname = new URL(asset.url).pathname;
          const baseName = pathname.split('/').pop() || `file_${idx}`;
          const safe = cleanFileName(baseName);
          const folder = zip.folder(category) || zip;
          folder.file(safe, data);
          manifest.push({ url: asset.url, savedAs: `${category}/${safe}`, bytes: data.byteLength });
        } catch {
          manifest.push({ url: asset.url, error: true });
        }
      }
    };
    
    await Promise.all(Array.from({ length: Math.min(CONC, assets.length) }, worker));

    zip.file('manifest.json', JSON.stringify({ page: parsed.toString(), assets: manifest }, null, 2));

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const host = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_');
    const fileName = `assets_${host}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buf);

  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}