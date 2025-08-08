// src/App.jsx
import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ProjectPage from './components/ProjectPage';

function WelcomePage() {
  return (
    <div className="welcome-page">
      <h2>Showcase</h2>
      <p>Select a project from the sidebar to begin.</p>
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 },
};
const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.4 };

export default function App() {
  const [projects, setProjects] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const location = useLocation();

  useEffect(() => {
    fetch('/projects.json')
      .then((r) => r.json())
      .then(setProjects)
      .catch((e) => console.error('Failed to load projects.json', e));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <>
      <Sidebar projects={projects} theme={theme} toggleTheme={toggleTheme} />
      <main className="content-area">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="page-container"
          >
            <Routes location={location}>
              <Route path="/" element={<WelcomePage />} />
              {/* catch-all so nested paths work */}
              <Route path="/*" element={<ProjectPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
