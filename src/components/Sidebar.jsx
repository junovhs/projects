// src/components/Sidebar.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Tree({ nodes, level, onPick, activeRelPath, openTopId, setOpenTopId }) {
  return (
    <ul className="side-tree">
      {(nodes || []).map((n) => {
        if (n.type === 'category') {
          const isTop = level === 0;
          const isOpen = isTop ? openTopId === n.id : true; // only top level is accordion
          const toggle = () => {
            if (!isTop) return;
            setOpenTopId((prev) => (prev === n.id ? null : n.id));
          };
          return (
            <li key={n.id} className="cat">
              <details open={isOpen} onToggle={toggle}>
                <summary>
                  <span className="cat-name">{n.name}</span>
                  <span className="cat-count">
                    {(n.children || []).filter((c) => c.type === 'project').length}
                  </span>
                </summary>
                <Tree
                  nodes={n.children}
                  level={level + 1}
                  onPick={onPick}
                  activeRelPath={activeRelPath}
                  openTopId={openTopId}
                  setOpenTopId={setOpenTopId}
                />
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
  activeRelPath,
  isMobile,
  open,
  onClose
}) {
  const navigate = useNavigate();
  const [openTopId, setOpenTopId] = useState(null);

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
          {isMobile && (
            <button className="close-drawer" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>

        <nav className="side-nav" role="navigation">
          <Tree
            nodes={projects}
            level={0}
            onPick={goToProject}
            activeRelPath={activeRelPath}
            openTopId={openTopId}
            setOpenTopId={setOpenTopId}
          />
        </nav>
      </div>
    </aside>
  );
}
