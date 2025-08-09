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
    } catch { /* ignore */ }
  }
  return null;
}

export default function ProjectPage({ slugToPath = {}, slugsReady = false, panelOpen, setPanelOpen }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw] || null;
  const projectUrl = useMemo(
    () => (relPath ? `/pages/${relPath}/index.html` : null),
    [relPath]
  );

  // About content (only when open)
  const [aboutHtml, setAboutHtml] = useState('<p class="muted">No write-up yet.</p>');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!panelOpen || !relPath) return;
      const hit = await fetchFirst([
        `/pages/${relPath}/writeup.html`,
        `/pages/${relPath}/README.md`,
        `/pages/${relPath}/writeup.md`,
      ]);
      if (cancelled) return;
      if (!hit) setAboutHtml('<p class="muted">No write-up yet.</p>');
      else if (hit.url.endsWith('.html')) setAboutHtml(hit.text);
      else setAboutHtml(simpleMarkdown(hit.text));
    })();
    return () => { cancelled = true; };
  }, [panelOpen, relPath]);

  // Slugs not ready yet → show loader (prevents blank screen on mobile)
  if (!projectUrl) {
    if (!slugsReady && !raw.includes('/')) {
      return (
        <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',opacity:.6}}>
          Loading project…
        </div>
      );
    }
    return (
      <div style={{display:'grid',placeItems:'center',height:'var(--vh-100,100vh)',padding:24}}>
        <div style={{opacity:.7,textAlign:'center'}}>
          <h2 style={{margin:0}}>Not found</h2>
          <p>Couldn’t find a project for “{raw}”.</p>
        </div>
      </div>
    );
  }

  const iframeStyle = {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 0,
    margin: 0,
    padding: 0,
    borderRadius: 0,
    background: '#000',
  };

  return (
    <div className={'project-layout' + (panelOpen ? ' with-panel' : '')} style={{ display: 'flex', width: '100%' }}>
      <div className="project-left" style={{ flex: 1, minWidth: 0, height: 'var(--vh-100, 100vh)' }}>
        <div className="iframe-wrap" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <iframe
            key={relPath}
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
            background: 'var(--surface)', color: 'var(--text)',
            borderLeft: '1px solid var(--border)',
            height: 'var(--vh-100, 100vh)', overflow: 'auto'
          }}
        >
          <div className="panel-inner" style={{ padding: 16 }}>
            <div className="panel-row">
              <h3 style={{ margin: 0 }}>About this project</h3>
              <button
                className="btn"
                onClick={() => setPanelOpen?.(false)}
                aria-label="Close about panel"
                style={{ border:'1px solid var(--border)', padding:'6px 10px', borderRadius:8 }}
              >✕</button>
            </div>
            <div className="about" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
            <div className="note">Tip: add <code>writeup.html</code> or <code>README.md</code> next to <code>index.html</code>.</div>
          </div>
        </aside>
      )}
    </div>
  );
}
