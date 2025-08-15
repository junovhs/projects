export { default as Sidebar } from './components/Sidebar.jsx';
export { default as ProjectPage } from './components/ProjectPage.jsx';
export { default as WelcomePage } from './components/WelcomePage.jsx';

// ==== Sidebar.jsx ====
// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Tree({ nodes, level, onPick, activeRelPath, openTopId, setOpenTopId }) {
  return (
    <ul className="side-tree">
      {(nodes || []).map((n) => {
        if (n.type === 'category') {
          const isTop = level === 0;
          const isOpen = isTop ? openTopId === n.id : true;
          const count = (n.children || []).filter((c) => c.type === 'project').length;

          const handleToggle = () => {
            if (!isTop) return;
            setOpenTopId((prev) => (prev === n.id ? null : n.id));
          };

          return (
            <li key={n.id} className={`cat${isOpen ? ' open' : ''}`}>
              <div className="cat-head">
                <button type="button" className="cat-toggle" onClick={handleToggle}>
                  <span className="cat-name">{n.name}</span>
                  <span className="cat-count">{count}</span>
                  <span className={`chev${isOpen ? ' open' : ''}`} aria-hidden>▾</span>
                </button>
              </div>
              {(!isTop || isOpen) && (
                <div className="cat-panel">
                  <Tree
                    nodes={n.children}
                    level={level + 1}
                    onPick={onPick}
                    activeRelPath={activeRelPath}
                    openTopId={openTopId}
                    setOpenTopId={setOpenTopId}
                  />
                </div>
              )}
            </li>
          );
        }

        if (n.type === 'project') {
          const rel = n.id;
          const isActive = activeRelPath === rel;
          const label = n.title || n.name || rel;
          return (
            <li key={rel} className={`proj${isActive ? ' active' : ''}`}>
              <button className="proj-btn" onClick={() => onPick(n)}>
                <span className="dot" aria-hidden>•</span>
                <span className="label">{label}</span>
              </button>
            </li>
          );
        }

        return null;
      })}
    </ul>
  );
}

export default function Sidebar({
  projects,
  activeRelPath,
  isMobile,
  open,
  onClose,
  isDark,
  onToggleTheme
}) {
  const navigate = useNavigate();

  const [openTopId, setOpenTopId] = useState(null);
  useEffect(() => {
    if (!openTopId && Array.isArray(projects)) {
      const firstCat = projects.find((n) => n.type === 'category');
      if (firstCat) setOpenTopId(firstCat.id);
    }
  }, [projects, openTopId]);

  const goToProject = (n) => {
    const target = n.slug || n.id;
    navigate(`/${encodeURIComponent(target)}`);
    if (isMobile) onClose?.();
  };

  return (
    <aside
      className={`sidebar-root${open ? ' open' : ''}${isMobile ? ' mobile' : ' desktop'}`}
      aria-hidden={isMobile ? !open : false}
      aria-label="Project navigation"
    >
      <div className="side-inner">
        <header className="side-header">
          <div className="side-title">Showcase</div>
          <div className="side-actions">
            <button
              className="theme-toggle"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
              onClick={onToggleTheme}
            >
              {isDark ? '🌙' : '☀️'}
            </button>
            {isMobile && (
              <button className="close-drawer" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        </header>

        <nav className="side-nav" role="navigation">
          <Tree
            nodes={projects}
            level={0}
            onPick={goToProject}
            activeRelPath={activeRelPath}
            openTopId={openTopId}
            setOpenTopId={setOpenTopId}
          />
        </nav>
      </div>
    </aside>
  );
}

// ==== ProjectPage.jsx ====
// src/components/ProjectPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function simpleMarkdown(md) {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const h = esc
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return h
    .split(/\n{2,}/)
    .map((para) => (/^<h\d>/.test(para) ? para : `<p>${para.replace(/\n/g, '<br/>')}</p>`))
    .join('\n');
}

async function fetchFirst(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok) return { url, text: await res.text() };
    } catch { /* ignore */ }
  }
  return null;
}

export default function ProjectPage({ slugToPath = {}, slugsReady = false, panelOpen, setPanelOpen }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw] || null;
  const projectUrl = useMemo(
    () => (relPath ? `/pages/${relPath}/index.html` : null),
    [relPath]
  );

  // About content (only when open)
  const [aboutHtml, setAboutHtml] = useState('<p class="muted">No write-up yet.</p>');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!panelOpen || !relPath) return;
      const hit = await fetchFirst([
        `/pages/${relPath}/writeup.html`,
        `/pages/${relPath}/README.md`,
        `/pages/${relPath}/writeup.md`,
      ]);
      if (cancelled) return;
      if (!hit) setAboutHtml('<p class="muted">No write-up yet.</p>');
      else if (hit.url.endsWith('.html')) setAboutHtml(hit.text);
      else setAboutHtml(simpleMarkdown(hit.text));
    })();
    return () => { cancelled = true; };
  }, [panelOpen, relPath]);

  // Slugs not ready yet → show loader (prevents blank screen on mobile)
  if (!projectUrl) {
    if (!slugsReady && !raw.includes('/')) {
      return (
        <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',opacity:.6}}>
          Loading project…
        </div>
      );
    }
    return (
      <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',padding:24}}>
        <div style={{opacity:.7,textAlign:'center'}}>
          <h2 style={{margin:0}}>Not found</h2>
          <p>Couldn’t find a project for “{raw}”.</p>
        </div>
      </div>
    );
  }

  const iframeStyle = {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 0,
    margin: 0,
    padding: 0,
    borderRadius: 0,
    background: '#000',
  };

  return (
    <div className={'project-layout' + (panelOpen ? ' with-panel' : '')} style={{ display: 'flex', width: '100%' }}>
      <div className="project-left" style={{ flex: 1, minWidth: 0, height: 'var(--vh-100, 100vh)' }}>
        <div className="iframe-wrap" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <iframe
            key={relPath}
            src={projectUrl}
            className="project-iframe"
            title={relPath}
            style={iframeStyle}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      {panelOpen && (
        <aside
          className="project-panel"
          style={{
            width: 'min(420px, 90vw)',
            background: 'var(--surface)', color: 'var(--text)',
            borderLeft: '1px solid var(--border)',
            height: 'var(--vh-100, 100vh)', overflow: 'auto'
          }}
        >
          <div className="panel-inner" style={{ padding: 16 }}>
            <div className="panel-row">
              <h3 style={{ margin: 0 }}>About this project</h3>
              <button
                className="btn"
                onClick={() => setPanelOpen?.(false)}
                aria-label="Close about panel"
                style={{ border:'1px solid var(--border)', padding:'6px 10px', borderRadius:8 }}
              >✕</button>
            </div>
            <div className="about" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
            <div className="note">Tip: add <code>writeup.html</code> or <code>README.md</code> next to <code>index.html</code>.</div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ==== WelcomePage.jsx ====
// src/components/WelcomePage.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./welcome.css";

/**
 * Minimal, polished landing page.
 * - No category grid
 * - One CTA: Open first project
 * - Responsive and theme-aware (uses CSS variables)
 */
export default function WelcomePage({ projects = [] }) {
  const navigate = useNavigate();

  const firstProject = useMemo(() => {
    let found = null;
    const walk = (list) => {
      for (const n of list || []) {
        if (n.type === "project") { found = n; return; }
        if (n.children) walk(n.children);
        if (found) return;
      }
    };
    walk(projects);
    return found;
  }, [projects]);

  const openFirstProject = () => {
    if (!firstProject) return;
    const slug = firstProject.slug || firstProject.id;
    navigate(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="welcome-wrap">
      <section className="welcome-hero">
        <div className="welcome-hero__bg" aria-hidden="true">
          <svg viewBox="0 0 800 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>
            <rect width="800" height="300" fill="url(#grad)" />
            <g opacity="0.18">
              <circle cx="90" cy="60" r="2" />
              <circle cx="210" cy="110" r="2" />
              <circle cx="380" cy="80" r="2" />
              <circle cx="520" cy="150" r="2" />
              <circle cx="700" cy="70" r="2" />
              <circle cx="640" cy="210" r="2" />
              <circle cx="120" cy="220" r="2" />
              <line x1="90" y1="60" x2="210" y2="110" />
              <line x1="210" y1="110" x2="380" y2="80" />
              <line x1="380" y1="80" x2="520" y2="150" />
              <line x1="520" y1="150" x2="700" y2="70" />
              <line x1="520" y1="150" x2="640" y2="210" />
              <line x1="90" y1="60" x2="120" y2="220" />
            </g>
          </svg>
        </div>

        <div className="welcome-hero__content">
          <h1 className="welcome-title">Welcome to the Project Showcase</h1>
          <p className="welcome-sub">
            A tidy, mobile-friendly template for presenting hands-on tools and experiments.
            Pick a project from the sidebar, or jump right in below.
          </p>

          <div className="welcome-actions">
            <button
              className="btn btn-primary"
              onClick={openFirstProject}
              disabled={!firstProject}
              title={firstProject ? "Open first project" : "No projects found"}
            >
              {firstProject ? "Open first project" : "No projects available"}
            </button>
          </div>

          <div className="welcome-tips">
            <div className="tip">
              <span className="tip-emoji" aria-hidden>📁</span>
              <div>
                <div className="tip-title">Projects live in the sidebar</div>
                <div className="tip-desc">
                  Click a project name to load it instantly in the main view.
                </div>
              </div>
            </div>
            <div className="tip">
              <span className="tip-emoji" aria-hidden>📱</span>
              <div>
                <div className="tip-title">Mobile-first layout</div>
                <div className="tip-desc">
                  On phones, tap the ☰ button to open navigation.
                </div>
              </div>
            </div>
            <div className="tip">
              <span className="tip-emoji" aria-hidden>✨</span>
              <div>
                <div className="tip-title">Drop-in friendly</div>
                <div className="tip-desc">
                  Add or remove projects without changing the layout.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export { Sidebar, ProjectPage, WelcomePage };
