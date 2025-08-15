// src/ui.jsx — single-file shell (App + Sidebar + ProjectPage + WelcomePage)

// Global imports (one time)
import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import './app.css';

/* ------------------------------ Sidebar ------------------------------ */

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

function Sidebar({ projects, activeRelPath, isMobile, open, onClose, isDark, onToggleTheme }) {
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

/* ---------------------------- ProjectPage ---------------------------- */

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

function ProjectPage({ slugToPath = {}, slugsReady = false, panelOpen, setPanelOpen }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw] || null;
  const projectUrl = useMemo(
    () => (relPath ? `/pages/${relPath}/index.html` : null),
    [relPath]
  );

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

/* ----------------------------- WelcomePage --------------------------- */

function WelcomePage({ projects = [] }) {
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
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- App -------------------------------- */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 860);
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 860);
      // mobile 100vh fix
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--vh-100', `calc(var(--vh) * 100)`);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function buildSlugMap(nodes, map = {}) {
  for (const n of nodes || []) {
    if (n.type === 'project') {
      const slug = n.slug || n.id;
      map[slug] = n.id;
    } else if (n.children) {
      buildSlugMap(n.children, map);
    }
  }
  return map;
}

function AppShell() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // theme
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // projects.json
  const [projects, setProjects] = useState([]);
  const [slugsReady, setSlugsReady] = useState(false);
  const [slugToPath, setSlugToPath] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/projects.json', { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled) return;
        setProjects(data);
        setSlugToPath(buildSlugMap(data));
        setSlugsReady(true);
      } catch (e) {
        console.error('Failed to load projects.json', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // active path for sidebar highlight
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const activeRelPath = raw.includes('/') ? raw : (slugToPath[raw] || null);

  // animations (keep subtle to avoid visual change)
  const pageMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:     { opacity: 0 },
    transition: { duration: 0.15 }
  };

  return (
    <>
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        activeRelPath={activeRelPath}
        isMobile={isMobile}
        open={isMobile ? drawerOpen : true}
        onClose={() => setDrawerOpen(false)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />

      {/* Mobile FAB to open drawer (matches previous behavior) */}
      {isMobile && !drawerOpen && (
        <button
          className="open-drawer-fab"
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
          style={{
            position:'fixed', left:12, bottom:12, width:48, height:48, borderRadius:24,
            border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
            boxShadow:'0 2px 8px rgba(0,0,0,.15)', fontSize:22, lineHeight:'48px'
          }}
        >☰</button>
      )}

      {/* Routes */}
      <AnimatePresence mode="wait">
        <motion.div key={pathname} {...pageMotion}>
          <Routes>
            <Route path="/" element={<WelcomePage projects={projects} />} />
            <Route
              path="/*"
              element={
                <ProjectPage
                  slugToPath={slugToPath}
                  slugsReady={slugsReady}
                  panelOpen={panelOpen}
                  setPanelOpen={setPanelOpen}
                />
              }
            />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// Export the App from here so main.jsx can import it
export { AppShell as App, Sidebar, ProjectPage, WelcomePage };
