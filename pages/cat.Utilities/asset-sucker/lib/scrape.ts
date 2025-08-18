import * as cheerio from "cheerio";
import { extCategory, isHttpUrl, looksLikeImageUrl, unique } from "./utils";

export type Asset = {
  url: string;
  source: string; // where we found it (img/src, srcset, css, icon, meta, etc.)
  category: "images" | "gifs" | "svgs" | "icons" | "others";
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept": "text/html,*/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function fetchCSS(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept": "text/css,*/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch CSS ${url}: ${res.status} ${res.statusText}`);
  return await res.text();
}

function resolveUrl(base: string, maybeRelative: string, cssBase?: string): string | null {
  const raw = maybeRelative.trim().replace(/^url\(/, "").replace(/\)$/, "").replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  try {
    // if it's an absolute URL
    if (isHttpUrl(raw)) return raw;
    // otherwise resolve using cssBase first (if present), else document base
    const baseToUse = cssBase ? new URL(cssBase) : new URL(base);
    return new URL(raw, baseToUse).toString();
  } catch {
    return null;
  }
}

function parseSrcset(value: string, base: string): string[] {
  const items = value.split(",").map(s => s.trim()).filter(Boolean);
  const urls: string[] = [];
  for (const item of items) {
    const [u] = item.split(/\s+/);
    const resolved = resolveUrl(base, u);
    if (resolved) urls.push(resolved);
  }
  return urls;
}

function extractFromInlineStyles($: cheerio.CheerioAPI, base: string): string[] {
  const urls: string[] = [];
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || "";
    const re = /background(?:-image)?:\s*url\(([^)]+)\)/ig;
    let m; 
    while ((m = re.exec(style)) !== null) {
      const u = resolveUrl(base, m[1]);
      if (u) urls.push(u);
    }
  });
  return urls;
}

function extractFromHTML($: cheerio.CheerioAPI, base: string): string[] {
  const candidates: string[] = [];

  $('img[src]').each((_, el) => {
    const u = $(el).attr('src'); const r = u ? resolveUrl(base, u) : null; if (r) candidates.push(r);
  });
  $('img[srcset]').each((_, el) => {
    const v = $(el).attr('srcset'); if (v) candidates.push(...parseSrcset(v, base));
  });
  $('picture source[srcset]').each((_, el) => {
    const v = $(el).attr('srcset'); if (v) candidates.push(...parseSrcset(v, base));
  });
  $('source[type^="image/"][srcset]').each((_, el) => {
    const v = $(el).attr('srcset'); if (v) candidates.push(...parseSrcset(v, base));
  });

  // Icons & social images
  $('link[rel~="icon"][href], link[rel="apple-touch-icon"][href], link[rel="mask-icon"][href]').each((_, el) => {
    const u = $(el).attr('href'); const r = u ? resolveUrl(base, u) : null; if (r) candidates.push(r);
  });
  $('meta[property="og:image"][content], meta[name="twitter:image"][content]').each((_, el) => {
    const u = $(el).attr('content'); const r = u ? resolveUrl(base, u) : null; if (r) candidates.push(r);
  });

  // Inline SVG with external xlink:href or href in <image>
  $('svg image').each((_, el) => {
    const u = ($(el).attr('href') || $(el).attr('xlink:href')); const r = u ? resolveUrl(base, u) : null; if (r) candidates.push(r);
  });

  candidates.push(...extractFromInlineStyles($, base));
  return unique(candidates);
}

function extractCssUrls(css: string, base: string): string[] {
  const urls: string[] = [];
  const re = /url\(([^)]+)\)/ig; // naive on purpose; filtered later
  let m;
  while ((m = re.exec(css)) !== null) {
    const u = resolveUrl(base, m[1], base);
    if (u) urls.push(u);
  }
  return unique(urls);
}

export async function discoverAssets(pageUrl: string, limit = 120) {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const base = new URL(pageUrl).toString();

  // 1) From HTML
  let urls = extractFromHTML($, base);

  // 2) From linked stylesheets
  const cssHrefs = $('link[rel="stylesheet"][href]').map((_, el) => $(el).attr('href') || "").get();
  for (const href of cssHrefs) {
    const abs = resolveUrl(base, href);
    if (!abs) continue;
    try {
      const css = await fetchCSS(abs);
      urls.push(...extractCssUrls(css, abs));
    } catch { /* ignore stylesheet errors */ }
  }

  // 3) Filter to visual assets only & cap
  urls = urls.filter(u => looksLikeImageUrl(u));
  urls = unique(urls).slice(0, limit);

  const assets = urls.map(u => {
    const { category } = extCategory(u);
    const source = u.includes("og:") ? "meta" : "page";
    return { url: u, source, category } as const;
  });

  const counts: Record<string, number> = { images: 0, gifs: 0, svgs: 0, icons: 0, others: 0 };
  for (const a of assets) counts[a.category]++;

  return { assets, counts };
}
