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
  const [isDark, setIsDark] = useState(true);
  const location = useLocation();

  // mobile breakpoint
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const fn = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  // mobile drawer open state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // right “About” panel
  const [aboutOpen, setAboutOpen] = useState(false);

  // close panels on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setAboutOpen(false);
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    fetch('/projects.json')
      .then((r) => r.json())
      .then(setProjects)
      .catch((e) => console.error('Failed to load projects.json', e));
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

  return (
    <div className={`app-shell${isMobile ? ' is-mobile' : ''}${isDark ? ' theme-dark' : ''}`}>
      {/* Mobile header */}
      {isMobile && (
        <header className="mobile-header">
          <button className="icon-btn" aria-label="Open projects" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="mh-title">Showcase</div>
          <button className="icon-btn" aria-label="Toggle dark mode" onClick={() => setIsDark((v) => !v)}>
            {isDark ? '🌙' : '☀️'}
          </button>
        </header>
      )}

      {/* Sidebar (drawer on mobile, static on desktop) */}
      <Sidebar
        projects={projects}
        isDark={isDark}
        onToggleDark={() => setIsDark((v) => !v)}
        activeRelPath={activeRelPath}
        parentMap={parentMap}
        onOpenAbout={() => setAboutOpen(true)}
        onToggleAbout={() => setAboutOpen((v) => !v)}
        isAboutOpen={aboutOpen}
        isMobile={isMobile}
        open={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Drawer backdrop */}
      {isMobile && sidebarOpen ? (
        <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <main className="content" role="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="page"
          >
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
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
