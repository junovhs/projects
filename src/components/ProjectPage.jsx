// src/components/ProjectPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function simpleMarkdown(md) {
  // ultra-light MD → HTML (headings, strong/em, code, links, paras)
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

export default function ProjectPage({ slugToPath = {} }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw];
  const baseUrl = relPath ? `/pages/${relPath}/index.html` : null;

  const [demo, setDemo] = useState(() => localStorage.getItem('demo') === '1');
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem('panel') !== '0');
  const [aboutHtml, setAboutHtml] = useState('<p class="muted">No write-up yet. Add <code>writeup.html</code> or <code>writeup.md</code> inside this project folder to show details here.</p>');

  useEffect(() => { localStorage.setItem('demo', demo ? '1' : '0'); }, [demo]);
  useEffect(() => { localStorage.setItem('panel', panelOpen ? '1' : '0'); }, [panelOpen]);

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
      if (hit.url.endsWith('.html')) {
        setAboutHtml(hit.text);
      } else {
        setAboutHtml(simpleMarkdown(hit.text));
      }
    })();
  }, [relPath]);

  const projectUrl = useMemo(() => {
    if (!baseUrl) return null;
    return demo ? `${baseUrl}?demo=1` : baseUrl;
  }, [baseUrl, demo]);

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

  const openNew = () => window.open(projectUrl, '_blank', 'noopener,noreferrer');
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch {}
  };

  return (
    <div className={'project-layout' + (panelOpen ? ' with-panel' : '')}>
      <div className="project-left">
        <div className="toolbar">
          <div className="toolbar-left">
            <label className="switch">
              <input type="checkbox" checked={demo} onChange={() => setDemo(!demo)} />
              <span className="slider" />
              <span className="label">Demo mode</span>
            </label>
          </div>
          <div className="toolbar-right">
            <button className="btn" onClick={openNew} title="Open in new tab">Open</button>
            <button className="btn" onClick={copyLink} title="Copy link">Copy link</button>
            <button className="btn" onClick={() => setPanelOpen((v) => !v)}>{panelOpen ? 'Hide' : 'About'}</button>
          </div>
        </div>
        <div className="iframe-wrap">
          <iframe key={relPath + (demo ? '?demo=1' : '')} src={projectUrl} className="project-iframe" title={relPath} />
        </div>
      </div>

      <aside className="project-panel">
        <div className="panel-inner">
          <h3>About this project</h3>
          <div className="about" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
          <div className="note">
            <strong>Tip:</strong> add <code>writeup.html</code> or <code>writeup.md</code> next to the app’s <code>index.html</code>.
            You can embed screenshots, GIFs, or links to Loom/YouTube. The “Demo mode” toggle appends <code>?demo=1</code> to the app URL.
          </div>
        </div>
      </aside>
    </div>
  );
}
