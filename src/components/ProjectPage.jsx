// projects/src/components/ProjectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import DOMPurify from 'dompurify';
import { AnimatePresence, motion } from "framer-motion";
import { useIsMobile } from "../hooks/useIsMobile";

/**
 * Renders a sandboxed iframe for project content.
 */
function ProjectIframe({ projectUrl, onIframeLoad, isIframeLoaded }) {
  const iframeClass = `project-iframe ${isIframeLoaded ? "loaded" : ""}`;
  return (
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
        className={iframeClass}
        title="Project Content"
        onLoad={onIframeLoad}
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
      />
    </div>
  );
}

/**
 * Renders a sandboxed iframe for the "About" panel content.
 */
function AboutPanel({ aboutHtml, isOpen, onClose }) {
  // Sanitize HTML to prevent XSS before embedding in srcDoc.
  const safeHtml = DOMPurify.sanitize(aboutHtml);
  
  // Basic CSS for the iframe content to match theme.
  const iframeStyles = `
    <style>
      :root { color-scheme: light dark; }
      body { 
        font-family: ui-sans-serif, system-ui, sans-serif;
        line-height: 1.6;
        background-color: transparent;
        color: var(--text);
        margin: 0; padding: 4px;
      }
      a { color: var(--accent); }
      h1, h2, h3 { margin: 1.2em 0 0.5em; }
      code { font-family: ui-monospace, monospace; background-color: rgba(128,128,128,0.1); padding: 2px 5px; border-radius: 4px; }
      pre { padding: 12px; background-color: rgba(128,128,128,0.1); border-radius: 8px; overflow-x: auto; }
    </style>
  `;
  const finalHtml = `
    <!DOCTYPE html>
    <html>
      <head>${iframeStyles}</head>
      <body>${safeHtml}</body>
    </html>
  `;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
           <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drawer-backdrop"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <aside className={`project-panel ${isOpen ? "open" : ""}`}>
        <header className="panel-header">
          <h2 className="panel-title">About Project</h2>
          <button className="panel-close-btn" onClick={onClose} aria-label="Close about panel">✕</button>
        </header>
        <iframe
          className="about-frame"
          sandbox="" /* No scripts, no top navigation, completely locked down */
          referrerPolicy="no-referrer"
          srcDoc={finalHtml}
          title="About Project"
        />
      </aside>
    </>
  );
}


/**
 * Main component to display a project.
 */
export function ProjectPage({ slugToPath = {}, slugsReady = false }) {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(!isMobile);

  const [isIframeLoaded, setIframeLoaded] = useState(false);
  const [aboutHtml, setAboutHtml] = useState('<p>Loading write-up...</p>');

  const rawSlug = decodeURIComponent(pathname.replace(/^\/+/, ""));
  const relPath = rawSlug.includes("/") ? rawSlug : slugToPath[rawSlug];
  const projectUrl = useMemo(() => (relPath ? `/pages/${relPath}/` : null), [relPath]);

  useEffect(() => {
    setIframeLoaded(false);
    setPanelOpen(!isMobile);
  }, [projectUrl, isMobile]);

  useEffect(() => {
    if (!relPath) return;
    let isCancelled = false;
    
    async function fetchWriteup() {
      try {
        const potentialFiles = [`/pages/${relPath}/writeup.html`, `/pages/${relPath}/README.md`];
        for (const fileUrl of potentialFiles) {
          const response = await fetch(fileUrl);
          if (response.ok) {
            const text = await response.text();
            if (!isCancelled) {
              setAboutHtml(text);
            }
            return;
          }
        }
        if (!isCancelled) setAboutHtml('<p>No write-up found for this project.</p>');
      } catch (error) {
        if (!isCancelled) setAboutHtml('<p>Could not load write-up.</p>');
      }
    }

    fetchWriteup();
    return () => { isCancelled = true; };
  }, [relPath]);

  if (slugsReady && !projectUrl) {
    return <Navigate to="/" replace />;
  }

  if (!projectUrl) {
    return (
      <div className="iframe-loader" style={{ opacity: 1 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="project-layout">
      <ProjectIframe
        projectUrl={projectUrl}
        isIframeLoaded={isIframeLoaded}
        onIframeLoad={() => setIframeLoaded(true)}
      />
      <AboutPanel 
        aboutHtml={aboutHtml}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
      {isMobile && !panelOpen && (
        <button
          className="open-panel-fab"
          aria-label="Show project information"
          onClick={() => setPanelOpen(true)}
        >
          ℹ
        </button>
      )}
    </div>
  );
}