import { NextRequest } from "next/server";
import { discoverAssets } from "@/lib/scrape";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { url, limit } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "Missing 'url'." }), { status: 400 });
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return new Response(JSON.stringify({ error: "Only http(s) URLs allowed." }), { status: 400 });

    const { assets, counts } = await discoverAssets(parsed.toString(), Math.min(Number(limit || 120), 300));
    return Response.json({ ok: true, assets, counts, total: assets.length });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
}
