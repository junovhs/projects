// src/components/Sidebar.jsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function flattenCounts(nodes) {
  const counts = new Map();
  (function walk(list, parent = null) {
    (list || []).forEach((n) => {
      if (n.type === 'project') {
        counts.set(parent, (counts.get(parent) || 0) + 1);
      } else if (n.type === 'category') {
        walk(n.children, n.name);
      }
    });
  })(nodes);
  return counts;
}

function Tree({ nodes, onPick, activeRelPath }) {
  return (
    <ul className="side-tree">
      {(nodes || []).map((n) => {
        if (n.type === 'category') {
          return (
            <li key={n.id} className="cat">
              <details open>
                <summary>
                  <span className="cat-name">{n.name}</span>
                  <span className="cat-count">{(n.children || []).filter(c => c.type === 'project').length}</span>
                </summary>
                <Tree nodes={n.children} onPick={onPick} activeRelPath={activeRelPath} />
              </details>
            </li>
          );
        }
        if (n.type === 'project') {
          const rel = n.id;
          const isActive = activeRelPath === rel;
          const label = n.title || n.name || rel;
          return (
            <li key={rel} className={`proj${isActive ? ' active' : ''}`}>
              <button className="proj-btn" onClick={() => onPick(n)}>
                <span className="dot" aria-hidden>•</span>
                <span className="label">{label}</span>
              </button>
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
}

export default function Sidebar({
  projects,
  isDark,
  onToggleDark,
  activeRelPath,
  isMobile,
  open,
  onClose
}) {
  const navigate = useNavigate();
  const counts = useMemo(() => flattenCounts(projects), [projects]);

  const goToProject = (n) => {
    const target = n.slug || n.id;
    navigate(`/${encodeURIComponent(target)}`);
    if (isMobile) onClose?.();
  };

  return (
    <aside
      className={`sidebar-root${open ? ' open' : ''}${isMobile ? ' mobile' : ' desktop'}`}
      aria-hidden={isMobile ? !open : false}
      aria-label="Project navigation"
    >
      <div className="side-inner">
        <header className="side-header">
          <div className="side-title">Showcase</div>
          <button className="dark-toggle" title="Toggle theme" aria-label="Toggle theme" onClick={onToggleDark}>
            {isDark ? '🌙' : '☀️'}
          </button>
          {isMobile && (
            <button className="close-drawer" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>

        <nav className="side-nav" role="navigation">
          <Tree nodes={projects} onPick={goToProject} activeRelPath={activeRelPath} />
        </nav>
      </div>
    </aside>
  );
}
