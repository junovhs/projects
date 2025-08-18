/**
 * QUICK DEPLOY (Vercel + GitHub):
 * 1) Push this repo to GitHub, import into Vercel (Next.js defaults are fine).
 * 2) Hobby timeouts? Lower "Max assets" or upgrade plan.
 *
 * UX:
 * - Square collage grid (normalized), hover overlay with actions.
 * - Proxied previews via /api/proxy (no CORS noise).
 * - Lightbox with arrows + keyboard (Esc, ←, →).
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Counts = { images: number; gifs: number; svgs: number; icons: number; others: number };
type Category = keyof Counts | "all";
type Asset = { url: string; source: string; category: keyof Counts };

const TABS: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "images", label: "Images" },
  { key: "svgs", label: "SVGs" },
  { key: "gifs", label: "GIFs" },
  { key: "icons", label: "Icons" },
  { key: "others", label: "Others" },
];

const fileNameFromUrl = (raw: string) => {
  try { const u = new URL(raw); return (u.pathname.split("/").pop() || u.hostname); }
  catch { return raw; }
};
const hostFromUrl = (raw: string) => { try { return new URL(raw).hostname; } catch { return ""; } };
const extFromUrl = (raw: string) => {
  try { const m = /\.([a-z0-9]+)$/i.exec(new URL(raw).pathname); return m ? m[1].toLowerCase() : ""; }
  catch { return ""; }
};

export default function Page() {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(120);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [active, setActive] = useState<Category>("all");
  const [q, setQ] = useState("");
  const [tile, setTile] = useState(220); // square size in px

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const host = useMemo(() => { try { return new URL(url).hostname; } catch { return ""; } }, [url]);
  const total = assets.length;

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return assets.filter(a => {
      if (active !== "all" && a.category !== active) return false;
      if (!lower) return true;
      try {
        const u = new URL(a.url);
        const name = (u.pathname.split("/").pop() || "").toLowerCase();
        return u.hostname.toLowerCase().includes(lower) || name.includes(lower);
      } catch {
        return a.url.toLowerCase().includes(lower);
      }
    });
  }, [assets, active, q]);

  async function scan() {
    setLoading(true);
    setAssets([]);
    setCounts(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, limit })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scrape");
      setAssets(data.assets);
      setCounts(data.counts);
      setActive("all");
      setQ("");
    } catch (e: any) {
      alert(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    try {
      setLoading(true);
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, limit })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Download failed");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const fileName = `assets_${host || "site"}.zip`;
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert(e?.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }

  // Lightbox keyboard controls
  const onKey = useCallback((e: KeyboardEvent) => {
    if (lightboxIndex === null) return;
    if (e.key === "Escape") setLightboxIndex(null);
    if (e.key === "ArrowRight") setLightboxIndex(i => (i === null ? null : Math.min(filtered.length - 1, i + 1)));
    if (e.key === "ArrowLeft") setLightboxIndex(i => (i === null ? null : Math.max(0, i - 1)));
  }, [lightboxIndex, filtered.length]);
  useEffect(() => {
    if (lightboxIndex !== null) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [lightboxIndex, onKey]);

  return (
    <div className="container" style={{ ["--tile" as any]: `${tile}px` }}>
      <div className="card">
        <div className="header">
          <h1 className="title">
            Asset Sucker <span className="badge">visual assets → ZIP</span>
          </h1>
          <p className="kicker">Paste a URL. We’ll grab images, SVGs, GIFs, icons, and CSS background images — then bundle them.</p>
        </div>

        <div className="content">
          <div className="form">
            <input
              className="input"
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
            />
            <button className="button" onClick={scan} disabled={loading || !url}>
              {loading ? "Working..." : "Scan"}
            </button>
            <button className="button secondary" onClick={downloadZip} disabled={loading || !url || total === 0}>
              {loading ? "…" : "Download ZIP"}
            </button>
          </div>

          <div className="toolbar">
            <label className="toolbar-field">
              <span>Max assets</span>
              <input
                type="number"
                className="input"
                min={10}
                max={300}
                value={limit}
                onChange={e => setLimit(Number(e.target.value || 120))}
                disabled={loading}
                style={{ width: 120 }}
              />
            </label>

            <label className="toolbar-field">
              <span>Filter</span>
              <input
                type="text"
                className="input"
                placeholder="filename or domain…"
                value={q}
                onChange={e => setQ(e.target.value)}
                disabled={loading || total === 0}
                style={{ width: 220 }}
              />
            </label>

            <label className="toolbar-field" title="Tile size">
              <span>Density</span>
              <input type="range" min={160} max={320} value={tile} onChange={e => setTile(Number(e.target.value))} />
            </label>

            {counts && (
              <div className="stats">
                <span className="badge-count">{total} total</span>
                <span className="badge-count">images {counts.images}</span>
                <span className="badge-count">svgs {counts.svgs}</span>
                <span className="badge-count">gifs {counts.gifs}</span>
                <span className="badge-count">icons {counts.icons}</span>
              </div>
            )}
          </div>

          <div className="tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`tab ${active === t.key ? "active" : ""}`}
                onClick={() => setActive(t.key)}
                disabled={total === 0}
              >
                {t.label}
              </button>
            ))}
          </div>

          <hr className="sep" />

          {filtered.length > 0 ? (
            <div className="grid" role="list">
              {filtered.map((a, i) => {
                const proxied = `/api/proxy?url=${encodeURIComponent(a.url)}`;
                const name = fileNameFromUrl(a.url);
                const host = hostFromUrl(a.url);
                const ext = extFromUrl(a.url) || a.category;
                return (
                  <div
                    key={i}
                    className="tile"
                    role="listitem"
                    onClick={(e) => {
                      // open lightbox unless clicking an action
                      const target = e.target as HTMLElement;
                      if (target.closest("a,button")) return;
                      setLightboxIndex(i);
                    }}
                  >
                    <div className="thumb">
                      <img src={proxied} alt="" loading="lazy" />
                      <div className="chip">{ext}</div>
                    </div>
                    <div className="footer">
                      <div className="row">
                        <div className="meta">
                          <div className="name" title={name}>{name}</div>
                          <div className="sub">{a.category} • {host || "external"}</div>
                        </div>
                        <div className="lb-actions">
                          <a className="btn" href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Open</a>
                          <a className="btn" href={proxied + "&download=1"} onClick={e => e.stopPropagation()}>Download</a>
                          <button
                            className="btn"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.url); }}
                            title="Copy original URL"
                            aria-label="Copy original URL"
                          >
                            Copy URL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              {total === 0 ? "Nothing yet. Paste a URL and click Scan." : "No matches for this filter."}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && filtered[lightboxIndex] && (
        <div className="lightbox" onClick={() => setLightboxIndex(null)}>
          <div className="lb-card" onClick={e => e.stopPropagation()}>
            <div className="lb-head">
              <div className="lb-title">{fileNameFromUrl(filtered[lightboxIndex].url)}</div>
              <div className="lb-actions">
                <a className="btn" href={filtered[lightboxIndex].url} target="_blank" rel="noreferrer">Open</a>
                <a className="btn" href={`/api/proxy?url=${encodeURIComponent(filtered[lightboxIndex].url)}&download=1`}>Download</a>
                <button className="lb-close" onClick={() => setLightboxIndex(null)}>Close</button>
              </div>
            </div>
            <div className="lb-body">
              <img
                src={`/api/proxy?url=${encodeURIComponent(filtered[lightboxIndex].url)}`}
                alt=""
                loading="eager"
              />
              {lightboxIndex > 0 && (
                <button className="navbtn navprev" onClick={() => setLightboxIndex(i => (i ?? 1) - 1)}>←</button>
              )}
              {lightboxIndex < filtered.length - 1 && (
                <button className="navbtn navnext" onClick={() => setLightboxIndex(i => (i ?? -1) + 1)}>→</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
