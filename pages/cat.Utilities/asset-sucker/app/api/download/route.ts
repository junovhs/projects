import { NextRequest } from "next/server";
import JSZip from "jszip";
import { discoverAssets } from "@/lib/scrape";
import { cleanFileName, extCategory } from "@/lib/utils";
export const runtime = "nodejs";

async function fetchBinary(u: string): Promise<Uint8Array> {
  const res = await fetch(u, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing 'url'." }), { status: 400 });
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return new Response(JSON.stringify({ error: "Only http(s) URLs allowed." }), { status: 400 });

    const { assets } = await discoverAssets(parsed.toString(), Math.min(Number(limit || 120), 300));

    const zip = new JSZip();
    const manifest: any[] = [];

    // concurrency limit
    const CONC = 6;
    let i = 0;
    async function worker() {
      while (i < assets.length) {
        const idx = i++;
        const asset = assets[idx];
        try {
          const data = await fetchBinary(asset.url);
          const { ext, category } = extCategory(asset.url);
          const pathname = new URL(asset.url).pathname;
          const baseName = pathname.split("/").pop() || `file_${idx}`;
          const safe = cleanFileName(baseName);
          const folder = (zip.folder(category) || zip);
          folder.file(safe, data);
          manifest.push({ url: asset.url, savedAs: `${category}/${safe}`, bytes: data.byteLength });
        } catch {
          manifest.push({ url: asset.url, error: true });
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONC, assets.length) }, () => worker());
    await Promise.all(workers);

    zip.file("manifest.json", JSON.stringify({ page: parsed.toString(), assets: manifest }, null, 2));

    const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const host = parsed.hostname.replace(/[^a-z0-9.-]/gi, "_");
    const fileName = `assets_${host}.zip`;

    return new Response(buf, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}
