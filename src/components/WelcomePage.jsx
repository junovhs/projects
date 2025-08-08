// src/components/WelcomePage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function relativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export default function WelcomePage({ isDark, projects = [] }) {
  const canvasRef = useRef(null);
  const [sort, setSort] = useState('recent'); // 'az' | 'recent'

  const sorted = useMemo(() => {
    const copy = [...projects];
    if (sort === 'az') {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      copy.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }
    return copy;
  }, [projects, sort]);

  // subtle shader bg
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d', { alpha: false });
    let rafId, w, h, dpr;

    const N = 80;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0008,
      vy: (Math.random() - 0.5) * 0.0008,
    }));

    const bg = isDark ? '#0b1016' : '#ffffff';
    const dot = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)';
    const line = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    resize();
    window.addEventListener('resize', resize);

    function step() {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h;
        const d2 = dx*dx + dy*dy;
        if (d2 < 120*120) {
          ctx.globalAlpha = 1 - d2/(120*120);
          ctx.beginPath(); ctx.moveTo(a.x*w, a.y*h); ctx.lineTo(b.x*w, b.y*h); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dot;
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x*w, n.y*h, 2.2, 0, Math.PI*2); ctx.fill(); }
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, [isDark]);

  return (
    <div className={'welcome' + (isDark ? ' theme-dark' : '')}>
      <canvas ref={canvasRef} className="welcome-canvas" />
      <div className="welcome-overlay">
        <h1 className="hero">Showcase</h1>
        <p className="sub">A curated portfolio of hands-on marketing tech projects.</p>

        <div className="controls">
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Recently updated</option>
              <option value="az">A–Z</option>
            </select>
          </label>
        </div>

        <div className="grid">
          {sorted.map((p) => (
            <Link key={p.slug || p.id} to={`/${encodeURIComponent(p.slug || p.id)}`} className="card">
              <div className="card-title">{p.name}</div>
              <div className="card-meta">
                {p.category ? <span className="chip">{p.category}</span> : null}
                {p.updatedAt ? <span className="muted">• {relativeDate(p.updatedAt)}</span> : null}
              </div>
              {p.summary ? <div className="card-summary">{p.summary}</div> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
