// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Tree({ nodes, level, onPick, activeRelPath, openTopId, setOpenTopId }) {
  return (
    <ul className="side-tree">
      {(nodes || []).map((n) => {
        if (n.type === 'category') {
          const isTop = level === 0;
          const isOpen = isTop ? openTopId === n.id : true; // only top-level is accordion
          const count = (n.children || []).filter((c) => c.type === 'project').length;

          const handleToggle = () => {
            if (!isTop) return;
            setOpenTopId((prev) => (prev === n.id ? null : n.id));
          };

          return (
            <li key={n.id} className={`cat${isOpen ? ' open' : ''}`}>
              <div className="cat-head">
                <button type="button" className="cat-toggle" onClick={handleToggle}>
                  <span className="cat-name">{n.name}</span>
                  <span className="cat-count">{count}</span>
                  <span className={`chev${isOpen ? ' open' : ''}`} aria-hidden>▾</span>
                </button>
              </div>
              {(!isTop || isOpen) && (
                <div className="cat-panel">
                  <Tree
                    nodes={n.children}
                    level={level + 1}
                    onPick={onPick}
                    activeRelPath={activeRelPath}
                    openTopId={openTopId}
                    setOpenTopId={setOpenTopId}
                  />
                </div>
              )}
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

  // Open the first top-level category by default when projects load
  const [openTopId, setOpenTopId] = useState(null);
  useEffect(() => {
    if (!openTopId && Array.isArray(projects)) {
      const firstCat = projects.find((n) => n.type === 'category');
      if (firstCat) setOpenTopId(firstCat.id);
    }
  }, [projects, openTopId]);

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
