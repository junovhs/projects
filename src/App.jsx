// src/App.jsx
import { useMemo, useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar, ProjectPage, WelcomePage } from "./ui";
import './index.css';
import './ui-fixes.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -12 },
};
const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.25 };

function flattenProjects(nodes) {
  const out = [];
  (function walk(list) {
    (list || []).forEach((n) => {
      if (n.type === 'project') out.push(n);
      if (n.children) walk(n.children);
    });
  })(nodes);
  return out;
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projError, setProjError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const routeLocation = useLocation();
  const navigate = useNavigate();

  // THEME (persist + system default)
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {}
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(isDark ? 'theme-light' : 'theme-dark');
    root.classList.add(isDark ? 'theme-dark' : 'theme-light');
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Robust viewport height custom property (iOS safe)
  useEffect(() => {
    const setVH = () =>
      document.documentElement.style.setProperty('--vh-100', `${window.innerHeight}px`);
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  // Load projects.json
  useEffect(() => {
    (async () => {
      try {
        const base = import.meta?.env?.BASE_URL ?? '/';
        const url = `${base.replace(/\/+$/, '')}/projects.json`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Malformed projects.json');
        setProjects(data);
      } catch (err) {
        console.error('Failed to load projects.json', err);
        setProjError(err.message || 'load failed');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // slug -> path map
  const slugToPath = useMemo(() => {
    const map = {};
    const stack = [...projects];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.type === 'project' && n.slug) map[n.slug] = n.id;
      if (n.children) stack.push(...n.children);
    }
    return map;
  }, [projects]);

  const flat = useMemo(() => flattenProjects(projects), [projects]);

  // MOBILE: On "/" redirect to first project so the iframe is the main view
  const locPath = routeLocation.pathname.replace(/\/+$/, '');
  useEffect(() => {
    if (!isMobile || projError || !loaded) return;
    if (locPath === '' || locPath === '/') {
      const first = flat[0];
      if (first) {
        const target = first.slug || first.id;
        navigate(`/${encodeURIComponent(target)}`, { replace: true });
      }
    }
  }, [isMobile, projError, loaded, flat, locPath, navigate]);

  // Active file path from slug or id
  const raw = decodeURIComponent(routeLocation.pathname.replace(/^\/+/, ''));
  const activeRelPath = raw.includes('/') ? raw : slugToPath[raw] || null;

  const showLoader = !loaded && !projError;

  // Tiny floating Projects button (mobile only)
  const fabStyle = {
    position: 'fixed',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'var(--app-surface)',
    color: 'var(--app-text)',
    border: '1px solid var(--app-border)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1
  };

  return (
    <div
      className={`app-shell${isMobile ? ' is-mobile' : ''}`}
      style={isMobile ? { ['--mobile-header-h']: '0px' } : undefined}
    >
      {isMobile && (
        <button
          aria-label="Open projects"
          title="Projects"
          onClick={() => setSidebarOpen(true)}
          style={fabStyle}
        >
          ☰
        </button>
      )}

      {/* Backdrop below the drawer */}
      {isMobile && sidebarOpen ? (
        <div
          className="drawer-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ zIndex: 60 }}
        />
      ) : null}

      {/* Sidebar above the backdrop */}
      <div className="sidebar-layer" style={isMobile ? { zIndex: 70, position: 'relative' } : undefined}>
        <Sidebar
          projects={projects}
          activeRelPath={activeRelPath}
          isMobile={isMobile}
          open={isMobile ? sidebarOpen : true}
          onClose={() => setSidebarOpen(false)}
          isDark={isDark}
          onToggleTheme={() => setIsDark((v) => !v)}
        />
      </div>

      <main className="content" role="main">
        {projError ? (
          <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',padding:24,textAlign:'center'}}>
            <div>
              <h3 style={{margin:0}}>Couldn’t load project list</h3>
              <div style={{opacity:.7,marginTop:8}}>{projError}</div>
            </div>
          </div>
        ) : showLoader ? (
          <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',opacity:.6}}>Loading…</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={routeLocation.pathname}
              initial="initial" animate="in" exit="out"
              variants={pageVariants} transition={pageTransition}
              className="page"
              style={{minHeight: 'var(--vh-100,100vh)'}}
            >
              <Routes location={routeLocation}>
                <Route path="/" element={<WelcomePage projects={projects} />} />
                <Route
                  path="/*"
                  element={
                    <ProjectPage
                      slugToPath={slugToPath}
                      slugsReady={Object.keys(slugToPath).length > 0}
                    />
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
