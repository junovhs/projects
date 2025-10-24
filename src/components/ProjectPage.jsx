// projects/src/components/ProjectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Main component to display a project in a sandboxed iframe.
 */
export function ProjectPage({ slugToPath = {}, slugsReady = false }) {
  const { pathname } = useLocation();
  const [isIframeLoaded, setIframeLoaded] = useState(false);

  const rawSlug = decodeURIComponent(pathname.replace(/^\/+/, ""));
  const relPath = rawSlug.includes("/") ? rawSlug : slugToPath[rawSlug];
  const projectUrl = useMemo(() => (relPath ? `/pages/${relPath}/` : null), [relPath]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [projectUrl]);

  // If slugs are ready but we can't find a project, redirect to home.
  if (slugsReady && !projectUrl) {
    return <Navigate to="/" replace />;
  }

  // Show a spinner while waiting for slugs.json to load on the first visit.
  if (!projectUrl) {
    return (
      <div className="iframe-loader" style={{ opacity: 1 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="project-layout">
      <div className="project-iframe-container">
        <AnimatePresence>
          {!isIframeLoaded && (
            <motion.div
              className="iframe-loader"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="spinner"></div>
            </motion.div>
          )}
        </AnimatePresence>
        <iframe
          key={projectUrl}
          src={projectUrl}
          className={`project-iframe ${isIframeLoaded ? "loaded" : ""}`}
          title="Project Content"
          onLoad={() => setIframeLoaded(true)}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
        />
      </div>
    </div>
  );
}