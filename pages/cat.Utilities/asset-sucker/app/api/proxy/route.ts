import { NextRequest } from "next/server";

export const runtime = "nodejs";

function isHttpUrl(u: string) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("url");
    const asDownload = searchParams.get("download") === "1";

    if (!raw || !isHttpUrl(raw)) {
      return new Response("Bad URL", { status: 400 });
    }

    // Fetch the target asset
    const upstream = await fetch(raw, { redirect: "follow" });
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }

    // Content type passthrough (fallback on octet-stream)
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const bytes = await upstream.arrayBuffer();

    // Optional forced download
    let cd = undefined as undefined | string;
    if (asDownload) {
      const name = (() => {
        try {
          const u = new URL(raw);
          const base = u.pathname.split("/").pop() || "file";
          return base.replace(/[^a-z0-9._-]/gi, "_");
        } catch { return "file"; }
      })();
      cd = `attachment; filename="${name}"`;
    }

    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        // CORS headers so the browser (and extensions) stop complaining
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=3600, s-maxage=3600, immutable",
        ...(cd ? { "content-disposition": cd } : {})
      }
    });
  } catch (e: any) {
    return new Response(e?.message || "Proxy error", { status: 500 });
  }
}
