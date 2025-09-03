import { put, head, del } from '@vercel/blob';

const META_IMAGES = 'meta/images.json';

// Helpers to load/save JSON in Vercel Blob
async function loadJson(path, fallback) {
  try {
    const info = await head(path);
    const res = await fetch(info.downloadUrl, { cache: 'no-store' });
    return await res.json();
  } catch {
    return fallback;
  }
}

async function saveJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    // Not in types yet but supported; allow overwrite of same path:
    // @ts-ignore
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0
  });
}

function decodeDataURL(dataURL) {
  const comma = dataURL.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL');
  const meta = dataURL.slice(5, dataURL.indexOf(';')); // e.g. "image/jpeg"
  const base64 = dataURL.slice(comma + 1);
  const buffer = Buffer.from(base64, 'base64');
  const contentType = meta;
  return { buffer, contentType };
}

function safeName(name = '') {
  return name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 140);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      // Return the list directly
      return res.status(200).json(meta.items);
    }

    if (req.method === 'POST') {
      const { id, name, data, uploadDate, tags = [], size } = req.body || {};
      if (!data || !name || !id) {
        return res.status(400).send('Missing id, name, or data');
      }

      // Store the binary in Blob
      const { buffer, contentType } = decodeDataURL(data);
      const filename = safeName(name);
      const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;

      const blob = await put(key, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType
      });

      // Update metadata file
      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const item = {
        id,
        name,
        url: blob.url,
        pathname: blob.pathname,
        uploadDate: uploadDate || new Date().toISOString(),
        tags,
        size
      };
      meta.items.push(item);
      await saveJson(META_IMAGES, meta);

      return res.status(201).json({ id });
    }

    if (req.method === 'PUT') {
      const { id, name, tags } = req.body || {};
      if (!id) return res.status(400).send('Missing id');

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex(it => String(it.id) === String(id));
      if (idx === -1) return res.status(404).send('Not found');

      if (typeof name === 'string') meta.items[idx].name = name;
      if (Array.isArray(tags)) meta.items[idx].tags = Array.from(new Set(tags));

      await saveJson(META_IMAGES, meta);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).send('Missing id');

      const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
      const idx = meta.items.findIndex(it => String(it.id) === String(id));
      if (idx === -1) return res.status(404).send('Not found');

      // Delete the blob
      const pathname = meta.items[idx].pathname;
      if (pathname) await del(pathname);

      // Remove from meta
      meta.items.splice(idx, 1);
      await saveJson(META_IMAGES, meta);

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,PUT,DELETE');
    return res.status(405).send('Method Not Allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).send(e?.message ?? 'Server error');
  }
}
