// src/components/Sidebar.jsx
import { useEffect, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';

/** Utilities */
function countProjects(node) {
  if (!node) return 0;
  if (node.type === 'project') return 1;
  return (node.children || []).reduce((n, c) => n + countProjects(c), 0);
}
function iconEmojiFor(name = '') {
  const n = name.toLowerCase();
  if (/\blifestyle\b/.test(n)) return '🌿';
  if (/optics|design/.test(n)) return '🎨';
  if (/research/.test(n)) return '🔬';
  if (/travel/.test(n)) return '🧳';
  if (/utilities?/.test(n)) return '🧰';
  return '📁';
}
function useAccordionDefault() {
  const [open, setOpen] = useState({});
  const key = (p, id) => `${p}/${id}`;
  const isOpen = (p, id) => !!open[key(p, id)];
  const toggle = (p, id) => setOpen((m) => ({ ...m, [key(p, id)]: !m[key(p, id)] }));
  const openChain = (leafId, parentMap) => {
    if (!leafId || !parentMap) return;
    let cur = parentMap[leafId];
    const next = {};
    while (cur && cur !== 'root') {
      const parent = parentMap[cur];
      if (!parent) break;
      next[key(parent, cur)] = true;
      cur = parent;
    }
    setOpen((m) => ({ ...m, ...next }));
  };
  return { isOpen, toggle, openChain };
}

/** Tree node */
function TreeNode({
  item,
  depth,
  parentId,
  isOpen,
  onToggle,
  activeRelPath,
  onOpenAbout,
  onToggleAbout,
  isAboutOpen,
  navigate,
}) {
  if (item.type === 'project') {
    const to = `/${encodeURIComponent(item.slug || item.id)}`;
    const isActiveLeaf = item.id === activeRelPath;

    const handleAbout = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isActiveLeaf) onToggleAbout();
      else {
        navigate(to);
        onOpenAbout();
      }
    };

    return (
      <li className={'tree-leaf' + (isActiveLeaf ? ' active' : '')} style={{ '--depth': depth }}>
        <span className="tree-connector" aria-hidden />
        <div className="leaf-row">
          <NavLink to={to} className={({ isActive }) => 'tree-leaf-btn' + (isActive ? ' active' : '')}>
            <span className="leaf-dot" aria-hidden />
            <span className="leaf-text">{item.name}</span>
          </NavLink>
          <button
            className="about-btn"
            aria-pressed={isActiveLeaf && isAboutOpen}
            onClick={handleAbout}
            title="About"
          >
            About
          </button>
        </div>
      </li>
    );
  }

  // Category
  const open = isOpen(parentId, item.id);
  const badge = countProjects(item);
  return (
    <li className="tree-group" style={{ '--depth': depth }}>
      <div
        className="tree-group-row"
        role="button"
        onClick={() => onToggle(parentId, item.id)}
        aria-expanded={open}
      >
        <span className="tree-disclosure">{open ? '▾' : '▸'}</span>
        <span className="tree-emoji" aria-hidden>{iconEmojiFor(item.name)}</span>
        <span className="tree-label">{item.name}</span>
        <span className="tree-badge" aria-label={`${badge} items`}>{badge}</span>
      </div>
      <div className={'tree-collapse ' + (open ? 'open' : '')}>
        <ul className="tree-children">
          {(item.children || []).map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              parentId={item.id}
              isOpen={isOpen}
              onToggle={onToggle}
              activeRelPath={activeRelPath}
              onOpenAbout={onOpenAbout}
              onToggleAbout={onToggleAbout}
              isAboutOpen={isAboutOpen}
              navigate={navigate}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

/** Sidebar root */
export default function Sidebar({
  projects,
  isDark,
  onToggleDark,
  activeRelPath,
  parentMap,
  onOpenAbout,
  onToggleAbout,
  isAboutOpen,
}) {
  const { isOpen, toggle, openChain } = useAccordionDefault(projects);
  const toggleId = 'sidebar-toggle';
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeRelPath) return;
    openChain(activeRelPath, parentMap);
    const el = document.querySelector('.nav .tree-leaf-btn.active');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeRelPath, parentMap]); // eslint-disable-line

  return (
    <aside className={'sidebar' + (isDark ? ' theme-dark' : '')}>
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">Showcase</Link>

        <input
          id={toggleId}
          type="checkbox"
          className="dm-input"
          checked={isDark}
          onChange={onToggleDark}
        />
        <label htmlFor={toggleId} className="dm-toggle dm-flat" aria-label="Toggle dark mode">
          <svg className="sun" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="5" /></svg>
          <svg className="moon" viewBox="0 0 24 24" aria-hidden><path d="M20 14.5A9 9 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5z" /></svg>
        </label>
      </header>

      <nav className="nav">
        <ul className="tree-root">
          {(projects || []).map((node) => (
            <TreeNode
              key={node.id}
              item={node}
              depth={0}
              parentId="root"
              isOpen={isOpen}
              onToggle={toggle}
              activeRelPath={activeRelPath}
              onOpenAbout={onOpenAbout}
              onToggleAbout={onToggleAbout}
              isAboutOpen={isAboutOpen}
              navigate={navigate}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
