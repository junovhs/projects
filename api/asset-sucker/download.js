// projects/api/asset-sucker/download.js
import JSZip from 'jszip';
import { discoverAssets, cleanFileName, extCategory } from '../_lib/asset-sucker-helpers.js';
import { fetchBinaryWithBudget } from '../_lib/net.js';
import { log } from '../_lib/log.js';

// Visible budgets and bounds per the mantra.
const CONCURRENT_WORKERS = 6;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES_PER_FILE = 10_000_000;  // 10MB
const TOTAL_ZIP_BUDGET_BYTES = 75_000_000; // 75MB

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let totalBytesDownloaded = 0;

  try {
    const { url, limit } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing 'url' parameter." });
    }

    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only http(s) URLs are allowed.' });
    }

    const assetLimit = Math.min(Number(limit || 120), 300);
    const { assets } = await discoverAssets(parsedUrl.toString(), assetLimit);

    const zip = new JSZip();
    const manifest = [];
    let assetIndex = 0;

    const worker = async () => {
      while (assetIndex < assets.length) {
        const currentIndex = assetIndex++;
        const asset = assets[currentIndex];
        try {
          // Enforce total budget before fetching.
          if (totalBytesDownloaded > TOTAL_ZIP_BUDGET_BYTES) {
            throw new Error(`Total zip budget exceeded (${TOTAL_ZIP_BUDGET_BYTES} bytes)`);
          }

          const data = await fetchBinaryWithBudget(asset.url, {
            timeoutMs: FETCH_TIMEOUT_MS,
            maxBytes: MAX_BYTES_PER_FILE
          });

          totalBytesDownloaded += data.byteLength;
          const { category } = extCategory(asset.url);
          const pathname = new URL(asset.url).pathname;
          const baseName = pathname.split('/').pop() || `file_${currentIndex}`;
          const safeName = cleanFileName(baseName);
          const folder = zip.folder(category) || zip;

          folder.file(safeName, data);
          manifest.push({ url: asset.url, savedAs: `${category}/${safeName}`, bytes: data.byteLength });

        } catch (e) {
          manifest.push({ url: asset.url, error: true, reason: e?.message || 'Unknown fetch error' });
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENT_WORKERS, assets.length) }, worker);
    await Promise.all(workers);

    zip.file('manifest.json', JSON.stringify({ page: parsedUrl.toString(), assets: manifest }, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const safeHostname = parsedUrl.hostname.replace(/[^a-z0-9.-]/gi, '_');
    const zipFileName = `assets_${safeHostname}.zip`;

    log('info', 'asset-sucker', 'zip_download_success', {
      url: parsedUrl.toString(),
      assets_discovered: assets.length,
      assets_downloaded: manifest.filter(m => !m.error).length,
      total_bytes: totalBytesDownloaded,
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    return res.status(200).send(zipBuffer);

  } catch (e) {
    log('error', 'asset-sucker', 'zip_download_failed', {
      url: req.body?.url,
      error: e?.message || 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to generate zip file.', details: e?.message });
  }
}

// NOTE: We need asset-sucker-helpers.js. Since it wasn't specified in the scaffolding,
// I've assumed it should be added to api/_lib/. I will provide it after this file.