// projects/api/lib/asset-sucker-helpers.js
import * as cheerio from 'cheerio';

const FAKE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export function getExtAndCategory(url) {
  try {
    const pathname = new URL(url).pathname;
    // Remove params and get extension
    const ext = (pathname.split('.').pop() || '').toLowerCase();
    
    if (/^(jpg|jpeg|png|webp|avif|heic|bmp|tiff)$/.test(ext)) return { ext, category: 'image' };
    if (/^(gif)$/.test(ext)) return { ext, category: 'gif' };
    if (/^(svg)$/.test(ext)) return { ext, category: 'svg' };
    if (/^(ico|icns)$/.test(ext)) return { ext, category: 'icon' };
    if (/^(mp4|webm|mov|m4v)$/.test(ext)) return { ext, category: 'video' };
    
    // Fallback based on common pattern logic if no extension
    return { ext: 'unknown', category: 'unknown' };
  } catch {
    return { ext: '', category: 'unknown' };
  }
}

const resolve = (base, relative) => {
  try { return new URL(relative, base).href; } catch { return null; }
};

export async function discoverAssets(targetUrl, limit = 150) {
  const assets = new Map(); // Use Map to auto-dedupe by URL
  const add = (url, source) => {
    if (!url || url.startsWith('data:') || assets.size >= limit) return;
    const fullUrl = resolve(targetUrl, url);
    if (!fullUrl) return;
    
    // Check if likely an asset
    const { ext, category } = getExtAndCategory(fullUrl);
    if (['image', 'svg', 'gif', 'icon', 'video'].includes(category)) {
      assets.set(fullUrl, { url: fullUrl, type: category, ext, source });
    }
  };

  try {
    // 1. Fetch HTML
    const res = await fetch(targetUrl, { headers: FAKE_HEADERS });
    if (!res.ok) throw new Error(`Failed to load page: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // 2. Standard HTML Tags
    $('img, video, source').each((_, el) => {
      add($(el).attr('src'), 'html-src');
      add($(el).attr('data-src'), 'lazy-load'); // Common lazy load attr
      
      // Handle srcset
      const srcset = $(el).attr('srcset');
      if (srcset) {
        srcset.split(',').forEach(chunk => {
          const [url] = chunk.trim().split(/\s+/);
          add(url, 'srcset');
        });
      }
    });

    // 3. Meta Tags (Social Shares often have best quality)
    $('meta[property^="og:image"], meta[name="twitter:image"], link[rel="image_src"]').each((_, el) => {
      add($(el).attr('content') || $(el).attr('href'), 'meta');
    });

    // 4. Icons
    $('link[rel~="icon"], link[rel~="apple-touch-icon"]').each((_, el) => {
      add($(el).attr('href'), 'icon');
    });

    // 5. Inline Styles & CSS
    const cssRegex = /url\s*\(['"]?([^'"()]+)['"]?\)/gi;
    
    // Scan inline styles
    $('[style]').each((_, el) => {
      const style = $(el).attr('style');
      let match;
      while ((match = cssRegex.exec(style)) !== null) {
        add(match[1], 'inline-css');
      }
    });

    // 6. Advanced: JSON-LD (Structured Data)
    // Many e-commerce sites put high-res images here
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const scanObj = (obj) => {
          if (!obj) return;
          if (typeof obj === 'string' && (obj.match(/\.jpg|\.png|\.webp/) || obj.startsWith('http'))) add(obj, 'json-ld');
          else if (Array.isArray(obj)) obj.forEach(scanObj);
          else if (typeof obj === 'object') Object.values(obj).forEach(scanObj);
        };
        scanObj(data);
      } catch (e) {}
    });

    // 7. External CSS (Fetch top 3 stylesheets)
    const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get().slice(0, 3);
    await Promise.allSettled(cssLinks.map(async (link) => {
      try {
        const cssUrl = resolve(targetUrl, link);
        const cssRes = await fetch(cssUrl, { headers: FAKE_HEADERS });
        const cssText = await cssRes.text();
        let match;
        while ((match = cssRegex.exec(cssText)) !== null) {
          add(match[1], 'external-css');
        }
      } catch (e) {}
    }));

    // Formatting Output
    const results = Array.from(assets.values());
    const counts = results.reduce((acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + 1;
      return acc;
    }, {});

    return { assets: results, counts, total: results.length };

  } catch (error) {
    console.error('Asset Discovery Error:', error);
    throw error;
  }
}