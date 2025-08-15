// src/App.jsx
import { useMemo, useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ProjectPage from './components/ProjectPage';
import WelcomePage from './components/WelcomePage';
import './index.css';
import './drawer-fix.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -12 },
};
const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.25 };

function buildMaps(nodes) {
  const parentMap = {};
  const flat = [];
  (function walk(list, parentId = 'root', parentCat = null) {
    (list || []).forEach((n) => {
      parentMap[n.id] = parentId;
      if (n.type === 'project') flat.push({ ...n, category: parentCat });
      else if (n.type === 'category') walk(n.children, n.id, n.name);
    });
  })(nodes);
  return { parentMap, flat };
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projError, setProjError] = useState('');
  const [isDark, setIsDark] = useState(true);
  const routeLocation = useLocation();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (isMobile) { setSidebarOpen(false); setAboutOpen(false); }
  }, [routeLocation.pathname, isMobile]);

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

  const [loaded, setLoaded] = useState(false);
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

  // Auto-open the first project on mobile when at "/"
  useEffect(() => {
    if (!isMobile || projError || !loaded) return;
    const path = routeLocation.pathname.replace(/\/+$/, '');
    if (path === '' || path === '/') {
      const first = flat[0];
      if (first) {
        const target = first.slug || first.id;
        navigate(`/${encodeURIComponent(target)}`, { replace: true });
      }
    }
  }, [isMobile, projError, loaded, flat, routeLocation.pathname, navigate]);

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
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
    zIndex: 70,
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1
  };

  return (
    <div
      className={`app-shell${isMobile ? ' is-mobile' : ''}${isDark ? ' theme-dark' : ''}`}
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

      {/* Backdrop FIRST, with lower z-index, so it sits behind the drawer */}
      {isMobile && sidebarOpen ? (
        <div
          className="drawer-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ zIndex: 50 }}
        />
      ) : null}

      {/* Sidebar (drawer) — ensure it layers above the backdrop */}
      <div className="sidebar-layer" style={isMobile ? { zIndex: 60, position: 'relative' } : undefined}>
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
                <Route path="/" element={<WelcomePage isDark={isDark} projects={flat} />} />
                <Route
                  path="/*"
                  element={
                    <ProjectPage
                      slugToPath={slugToPath}
                      slugsReady={Object.keys(slugToPath).length > 0}
                      panelOpen={!isMobile && aboutOpen}
                      setPanelOpen={setAboutOpen}
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
