// projects/api/_lib/asset-sucker-helpers.js
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function isHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

export function extCategory(url) {
  const path = new URL(url).pathname.toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(path);
  const ext = match ? match[1] : '';
  let category = 'others';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(ext)) category = 'images';
  else if (['gif'].includes(ext)) category = 'gifs';
  else if (['svg'].includes(ext)) category = 'svgs';
  else if (['ico', 'icns'].includes(ext)) category = 'icons';
  return { ext, category };
}

export function looksLikeImageUrl(s) {
  if (!s || s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('about:')) return false;
  return /(\.)(png|jpe?g|gif|svg|webp|avif|ico)(\?|$)/i.test(s);
}

export function unique(arr) {
  return Array.from(new Set(arr));
}

export function cleanFileName(name) {
  return name.replace(/[^a-z0-9._-]/gi, '_');
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept': 'text/html,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function fetchCSS(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept': 'text/css,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch CSS ${url}: ${res.status}`);
  return await res.text();
}

function resolveUrl(base, maybeRelative, cssBase) {
  const raw = maybeRelative.trim().replace(/^url\(/, '').replace(/\)$/, '').replace(/^['"]|['"]$/g, '');
  if (!raw) return null;
  try {
    if (isHttpUrl(raw)) return raw;
    const baseToUse = cssBase ? new URL(cssBase) : new URL(base);
    return new URL(raw, baseToUse).toString();
  } catch { return null; }
}

function parseSrcset(value, base) {
  return value.split(',').map(s => s.trim()).filter(Boolean).map(item => {
    const [u] = item.split(/\s+/);
    return resolveUrl(base, u);
  }).filter(Boolean);
}

function extractFromInlineStyles($, base) {
  const urls = [];
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const re = /url\(([^)]+)\)/gi;
    let m;
    while ((m = re.exec(style)) !== null) {
      const u = resolveUrl(base, m[1]);
      if (u) urls.push(u);
    }
  });
  return urls;
}

function extractFromHTML($, base) {
  const candidates = [];
  $('img[src]').each((_, el) => { const u = $(el).attr('src'); if (u) candidates.push(resolveUrl(base, u)); });
  $('img[srcset]').each((_, el) => { const v = $(el).attr('srcset'); if (v) candidates.push(...parseSrcset(v, base)); });
  $('picture source[srcset]').each((_, el) => { const v = $(el).attr('srcset'); if (v) candidates.push(...parseSrcset(v, base)); });
  $('link[rel~="icon"][href], link[rel="apple-touch-icon"][href]').each((_, el) => { const u = $(el).attr('href'); if (u) candidates.push(resolveUrl(base, u)); });
  $('meta[property="og:image"][content]').each((_, el) => { const u = $(el).attr('content'); if (u) candidates.push(resolveUrl(base, u)); });
  $('svg image').each((_, el) => { const u = $(el).attr('href') || $(el).attr('xlink:href'); if (u) candidates.push(resolveUrl(base, u)); });
  candidates.push(...extractFromInlineStyles($, base));
  return unique(candidates.filter(Boolean));
}

function extractCssUrls(css, base) {
  const urls = [];
  const re = /url\(([^)]+)\)/ig;
  let m;
  while ((m = re.exec(css)) !== null) {
    const u = resolveUrl(base, m[1], base);
    if (u) urls.push(u);
  }
  return unique(urls);
}

export async function discoverAssets(pageUrl, limit = 120) {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const base = new URL(pageUrl).toString();

  let urls = extractFromHTML($, base);

  const cssHrefs = $('link[rel="stylesheet"][href]').map((_, el) => $(el).attr('href') || '').get();
  for (const href of cssHrefs) {
    const abs = resolveUrl(base, href);
    if (!abs) continue;
    try {
      const css = await fetchCSS(abs);
      urls.push(...extractCssUrls(css, abs));
    } catch { /* ignore */ }
  }

  urls = unique(urls.filter(u => looksLikeImageUrl(u))).slice(0, limit);

  const assets = urls.map(u => ({ url: u, ...extCategory(u) }));

  const counts = { images: 0, gifs: 0, svgs: 0, icons: 0, others: 0 };
  assets.forEach(a => { if (counts[a.category] !== undefined) counts[a.category]++; });

  return { assets, counts };
}