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
      if (n.type === 'project') {
        flat.push({ ...n, category: parentCatName });
      } else if (n.type === 'category') {
        walk(n.children, n.id, n.name);
      }
    });
  }
  walk(nodes);
  return { parentMap, flat };
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [sidebarDark, setSidebarDark] = useState(true); // Dark mode only for sidebar/welcome
  const [aboutOpen, setAboutOpen] = useState(false);     // Controls the right “About” panel
  const location = useLocation();

  useEffect(() => {
    fetch('/projects.json')
      .then((r) => r.json())
      .then(setProjects)
      .catch((e) => console.error('Failed to load projects.json', e));
  }, []);

  // slug -> full path (e.g., "tp-cruise-image-search" -> "TravelPerks/Tp Cruise Image Search")
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

  // Active project path from URL (supports legacy path or slug)
  const raw = decodeURIComponent(location.pathname.replace(/^\/+/, ''));
  const activeRelPath = raw.includes('/') ? raw : slugToPath[raw] || null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        isDark={sidebarDark}
        onToggleDark={() => setSidebarDark((v) => !v)}
        activeRelPath={activeRelPath}
        parentMap={parentMap}
        // Sidebar “About” button hooks
        onOpenAbout={() => setAboutOpen(true)}
        onToggleAbout={() => setAboutOpen((v) => !v)}
        isAboutOpen={aboutOpen}
      />

      <main className="content">
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
              <Route path="/" element={<WelcomePage isDark={sidebarDark} projects={flat} />} />
              <Route
                path="/*"
                element={
                  <ProjectPage
                    slugToPath={slugToPath}
                    panelOpen={aboutOpen}
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
