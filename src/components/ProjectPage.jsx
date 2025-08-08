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
      const res = await fetch(url);
      if (res.ok) return { url, text: await res.text() };
    } catch { /* ignore */ }
  }
  return null;
}

export default function ProjectPage({ slugToPath = {}, panelOpen, setPanelOpen }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw];
  const baseUrl = relPath ? `/pages/${relPath}/index.html` : null;

  // If parent doesn't control panel, use local state (keeps compatibility)
  const [localOpen, setLocalOpen] = useState(() => localStorage.getItem('panel') !== '0');
  const isControlled = typeof panelOpen === 'boolean' && typeof setPanelOpen === 'function';
  const open = isControlled ? panelOpen : localOpen;
  const setOpen = isControlled ? setPanelOpen : setLocalOpen;

  useEffect(() => {
    if (!isControlled) localStorage.setItem('panel', open ? '1' : '0');
  }, [open, isControlled]);

  const [aboutHtml, setAboutHtml] = useState('<p class="muted">No write-up yet.</p>');

  useEffect(() => {
    if (!relPath) return;
    (async () => {
      const tryFiles = [
        `/pages/${relPath}/writeup.html`,
        `/pages/${relPath}/README.md`,
        `/pages/${relPath}/writeup.md`,
      ];
      const hit = await fetchFirst(tryFiles);
      if (!hit) return setAboutHtml('<p class="muted">No write-up yet.</p>');
      if (hit.url.endsWith('.html')) setAboutHtml(hit.text);
      else setAboutHtml(simpleMarkdown(hit.text));
    })();
  }, [relPath]);

  const projectUrl = useMemo(() => baseUrl || null, [baseUrl]);

  if (!projectUrl) {
    return (
      <div className="iframe-wrap">
        <div className="welcome">
          <div className="welcome-overlay">
            <h2>Not found</h2>
            <p>Couldn’t find a project for “{raw}”.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={'project-layout' + (open ? ' with-panel' : '')}>
      <div className="project-left">
        {/* Top toolbar removed completely */}
        <div className="iframe-wrap">
          <iframe key={relPath} src={projectUrl} className="project-iframe" title={relPath} />
        </div>
      </div>

      <aside className="project-panel">
        <div className="panel-inner">
          <h3>About this project</h3>
          <div className="about" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
          <div className="note">
            <strong>Tip:</strong> add <code>writeup.html</code> or <code>writeup.md</code> next to the app’s <code>index.html</code>.
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
