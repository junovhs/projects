// src/components/WelcomePage.jsx
import { useEffect, useRef } from 'react';

export default function WelcomePage({ isDark }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d', { alpha: false });
    let rafId, w, h, dpr;

    const N = 80; // number of nodes
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
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // move nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }

      // draw lines
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 120 * 120) {
            ctx.globalAlpha = 1 - dist2 / (120 * 120);
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // draw nodes
      ctx.fillStyle = dot;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  return (
    <div className={'welcome' + (isDark ? ' theme-dark' : '')}>
      <canvas ref={canvasRef} className="welcome-canvas" />
      <div className="welcome-overlay">
        <h2>Showcase</h2>
        <p>Select a project from the sidebar to begin.</p>
      </div>
    </div>
  );
}
