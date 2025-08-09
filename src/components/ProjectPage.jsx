// src/components/ProjectPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function simpleMarkdown(md) {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const h = esc
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return h
    .split(/\n{2,}/)
    .map((para) => (/^<h\d>/.test(para) ? para : `<p>${para.replace(/\n/g, '<br/>')}</p>`))
    .join('\n');
}

async function fetchFirst(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok) return { url, text: await res.text() };
    } catch { /* swallow */ }
  }
  return null;
}

export default function ProjectPage({ slugToPath = {}, panelOpen, setPanelOpen }) {
  const { pathname } = useLocation();

  // Resolve path: allow old-style /cat.Foo/Project or slug like /iasip-random
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw] || null;
  const projectUrl = useMemo(
    () => (relPath ? `/pages/${relPath}/index.html` : null),
    [relPath]
  );

  // About content (loaded ONLY when the panel is opened)
  const [aboutHtml, setAboutHtml] = useState('<p class="muted">No write-up yet.</p>');

  useEffect(() => {
    let cancelled = false;
    async function loadAbout() {
      if (!panelOpen || !relPath) return;
      const tryFiles = [
        `/pages/${relPath}/writeup.html`,
        `/pages/${relPath}/README.md`,
        `/pages/${relPath}/writeup.md`,
      ];
      const hit = await fetchFirst(tryFiles);
      if (cancelled) return;
      if (!hit) {
        setAboutHtml('<p class="muted">No write-up yet.</p>');
      } else if (hit.url.endsWith('.html')) {
        setAboutHtml(hit.text);
      } else {
        setAboutHtml(simpleMarkdown(hit.text));
      }
    }
    loadAbout();
    return () => { cancelled = true; };
  }, [panelOpen, relPath]);

  // Basic not-found state
  if (!projectUrl) {
    return (
      <div style={{
        display: 'grid',
        placeItems: 'center',
        height: 'var(--vh-100, 100vh)',
        padding: 24
      }}>
        <div style={{ opacity: 0.7, textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>Not found</h2>
          <p>Couldn’t find a project for “{raw}”.</p>
        </div>
      </div>
    );
  }

  // Inline layout styles to defeat any stray CSS that was shrinking the iframe on iPhone
  const layoutCls = 'project-layout' + (panelOpen ? ' with-panel' : '');
  const leftWrapStyle = {
    position: 'relative',
    width: '100%',
    height: 'var(--vh-100, 100vh)',
    // On desktop we sit next to sidebar; parent CSS can adjust, but we force full height.
    overflow: 'hidden',
    background: 'var(--surface, #0b1016)'
  };
  const iframeStyle = {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 0,
    margin: 0,
    padding: 0,
    borderRadius: 0, // you wanted it flush
  };

  return (
    <div className={layoutCls} style={{ display: 'flex', width: '100%' }}>
      <div className="project-left" style={{ flex: 1, minWidth: 0 }}>
        <div className="iframe-wrap" style={leftWrapStyle}>
          <iframe
            key={relPath}                // force reload on route change
            src={projectUrl}
            className="project-iframe"
            title={relPath}
            style={iframeStyle}
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      {panelOpen && (
        <aside
          className="project-panel"
          style={{
            width: 'min(420px, 90vw)',
            maxWidth: '100%',
            borderLeft: '1px solid var(--border, #1f2937)',
            background: 'var(--surface, #0f172a)',
            color: 'var(--text, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            height: 'var(--vh-100, 100vh)',
            overflow: 'auto'
          }}
        >
          <div className="panel-inner" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h3 style={{ margin: 0, flex: 1 }}>About this project</h3>
              <button
                className="btn"
                onClick={() => setPanelOpen?.(false)}
                aria-label="Close about panel"
                style={{
                  border: '1px solid var(--border, #1f2937)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            <div
              className="about"
              dangerouslySetInnerHTML={{ __html: aboutHtml }}
              style={{ lineHeight: 1.5, opacity: 0.9 }}
            />
            <div className="note" style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
              Tip: add <code>writeup.html</code> or <code>README.md</code> next to the app’s <code>index.html</code>.
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
