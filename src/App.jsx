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

export default function App() {
  const [projects, setProjects] = useState([]);
  const [sidebarDark, setSidebarDark] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetch('/projects.json')
      .then((r) => r.json())
      .then(setProjects)
      .catch((e) => console.error('Failed to load projects.json', e));
  }, []);

  // Build a lookup: slug -> full relative path (id)
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

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        isDark={sidebarDark}
        onToggleDark={() => setSidebarDark((v) => !v)}
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
              <Route path="/" element={<WelcomePage isDark={sidebarDark} />} />
              {/* single catch-all; component resolves slug OR legacy path */}
              <Route path="/*" element={<ProjectPage slugToPath={slugToPath} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
