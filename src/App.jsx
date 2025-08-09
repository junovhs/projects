// src/App.jsx
import { useMemo, useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ProjectPage from './components/ProjectPage';
import WelcomePage from './components/WelcomePage';
import './index.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -12 },
};
const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.25 };

function buildMaps(nodes) {
  const parentMap = {};
  const flat = [];
  function walk(list, parentId = 'root', parentCatName = null) {
    (list || []).forEach((n) => {
      parentMap[n.id] = parentId;
      if (n.type === 'project') flat.push({ ...n, category: parentCatName });
      else if (n.type === 'category') walk(n.children, n.id, n.name);
    });
  }
  walk(nodes);
  return { parentMap, flat };
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projError, setProjError] = useState('');
  const [isDark, setIsDark] = useState(true);
  const location = useLocation();

  // Mobile breakpoint
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const fn = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  // Drawer open state (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Right “About” panel (desktop only)
  const [aboutOpen, setAboutOpen] = useState(false);

  // Close panels on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setAboutOpen(false);
    }
  }, [location.pathname, isMobile]);

  // iOS-safe viewport var for 100% heights
  useEffect(() => {
    const setVH = () => {
      const h = window.innerHeight;
      document.documentElement.style.setProperty('--vh-100', `${h}px`);
      // mobile header height var
      document.documentElement.style.setProperty('--mh', '56px');
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  // Robust projects.json fetch (works under any base path)
  useEffect(() => {
    const url = new URL(
      (import.meta?.env?.BASE_URL || '/') + 'projects.json',
      window.location.origin
    ).toString();

    (async () => {
      try {
        setProjError('');
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Malformed projects.json');
        setProjects(data);
      } catch (err) {
        console.error('Failed to load projects.json', err);
        setProjError(
          `Could not load projects.json (${err.message}). Make sure it exists at ${url}.`
        );
        setProjects([]);
      }
    })();
  }, []);

  // slug -> path
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

  const { parentMap, flat } = useMemo(() => buildMaps(projects), [projects]);

  const raw = decodeURIComponent(location.pathname.replace(/^\/+/, ''));
  const activeRelPath = raw.includes('/') ? raw : slugToPath[raw] || null;

  // visible fallback if projects.json fails
  const loading = !projError && projects.length === 0;

  return (
    <div className={`app-shell${isMobile ? ' is-mobile' : ''}${isDark ? ' theme-dark' : ''}`}>
      {isMobile && (
        <header className="mobile-header">
          <button className="icon-btn" aria-label="Open projects" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="mh-title">Showcase</div>
          <button className="icon-btn" aria-label="Toggle dark mode" onClick={() => setIsDark((v) => !v)}>
            {isDark ? '🌙' : '☀️'}
          </button>
        </header>
      )}

      <Sidebar
        projects={projects}
        isDark={isDark}
        onToggleDark={() => setIsDark((v) => !v)}
        activeRelPath={activeRelPath}
        parentMap={parentMap}
        onOpenAbout={() => setAboutOpen(true)}
        onToggleAbout={() => setAboutOpen((v) => !v)}
        isAboutOpen={!isMobile && aboutOpen}
        isMobile={isMobile}
        open={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
      />
      {isMobile && sidebarOpen ? (
        <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <main className="content" role="main">
        {projError ? (
          <div style={{
            display: 'grid', placeItems: 'center',
            height: 'calc(var(--vh-100, 100vh) - var(--mh, 56px))',
            padding: 24, textAlign: 'center'
          }}>
            <div style={{ opacity: 0.8 }}>
              <h2 style={{ margin: 0 }}>Can’t load project list</h2>
              <p style={{ marginTop: 8 }}>{projError}</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + (loading ? '-loading' : '')}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="page"
              style={{
                minHeight: isMobile
                  ? 'calc(var(--vh-100, 100vh) - var(--mh, 56px))'
                  : 'var(--vh-100, 100vh)',
              }}
            >
              {loading ? (
                <div style={{
                  display: 'grid', placeItems: 'center',
                  height: '100%', padding: 24, opacity: 0.6
                }}>
                  <div>Loading projects…</div>
                </div>
              ) : (
                <Routes location={location}>
                  <Route path="/" element={<WelcomePage isDark={isDark} projects={flat} />} />
                  <Route
                    path="/*"
                    element={
                      <ProjectPage
                        slugToPath={slugToPath}
                        panelOpen={!isMobile && aboutOpen}
                        setPanelOpen={setAboutOpen}
                      />
                    }
                  />
                </Routes>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
