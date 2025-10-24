// projects/src/App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Sidebar } from "./components/Sidebar";
import { ProjectPage } from "./components/ProjectPage";
import { WelcomePage } from "./components/WelcomePage";
import { useIsMobile } from "./hooks/useIsMobile";
import { useProjects } from "./hooks/useProjects";

function App() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Encapsulated data fetching and derived state.
  const { projects, slugToPath, slugsReady } = useProjects();
  const location = useLocation();

  // Determine active path for sidebar highlight.
  const rawPath = decodeURIComponent(location.pathname.replace(/^\/+/, ""));
  const activeRelPath = rawPath.includes("/") ? rawPath : slugToPath[rawPath] || null;

  // Theme management.
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", isDark);
    document.documentElement.classList.toggle("theme-light", !isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        activeRelPath={activeRelPath}
        isMobile={isMobile}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      <main className="content-root">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Routes>
              <Route path="/" element={<WelcomePage projects={projects} />} />
              <Route
                path="/*"
                element={
                  <ProjectPage
                    slugToPath={slugToPath}
                    slugsReady={slugsReady}
                  />
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {isMobile && (
        <button
          className="open-drawer-fab"
          aria-label="Open navigation menu"
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>
      )}
    </div>
  );
}

export default App;