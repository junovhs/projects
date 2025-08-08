// src/components/Sidebar.jsx
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

function encodePathSeg(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Count total descendant projects for a category node */
function countProjects(node) {
  if (!node) return 0;
  if (node.type === 'project') return 1;
  return (node.children || []).reduce((acc, n) => acc + countProjects(n), 0);
}

/** Simple icon “emoji” mapping — zero deps */
function iconEmojiFor(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('lifestyle')) return '✨';
  if (n.includes('optic') || n.includes('design')) return '⧉';
  if (n.includes('research')) return '🧪';
  if (n.includes('utilit') || n.includes('tool')) return '☰';
  if (n.includes('travel')) return '🗂';
  return '📁';
}

/** One-open-per-level accordion */
function useAccordionDefault(projects) {
  const firstCategoryId = useMemo(() => {
    const first = (projects || []).find((x) => x.type === 'category');
    return first ? first.id : null;
  }, [projects]);

  const [openByParent, setOpenByParent] = useState({ root: firstCategoryId });
  useEffect(() => {
    setOpenByParent({ root: firstCategoryId });
  }, [firstCategoryId]);

  function toggle(parentId, id) {
    setOpenByParent((m) => ({
      ...m,
      [parentId]: m[parentId] === id ? null : id,
    }));
  }

  const isOpen = (parentId, id) => openByParent[parentId] === id;

  // allow programmatic open (from App when route changes)
  function openChain(childId, parentMap) {
    if (!childId) return;
    const updates = {};
    let child = childId;
    let parent = parentMap[child];
    let upper = 'root';
    while (parent) {
      updates[upper] = parent;        // only one open per level
      upper = parent;
      child = parent;
      parent = parentMap[child];
    }
    setOpenByParent((m) => ({ ...m, ...updates }));
  }

  return { isOpen, toggle, openChain };
}

function GroupRow({ name, open, onToggle, badge, icon }) {
  return (
    <div className="tree-group-row" role="button" onClick={onToggle} aria-expanded={open}>
      <span className="tree-disclosure">{open ? '▾' : '▸'}</span>
      <span className="tree-emoji" aria-hidden>{icon}</span>
      <span className="tree-label">{name}</span>
      <span className="tree-badge" aria-label={`${badge} items`}>{badge}</span>
    </div>
  );
}

function TreeNode({ item, depth, parentId, isOpen, onToggle }) {
  if (item.type === 'project') {
    const to = `/${encodePathSeg(item.slug || item.id)}`;
    return (
      <li className="tree-leaf" style={{ '--depth': depth }}>
        <span className="tree-connector" aria-hidden />
        <NavLink
          to={to}
          className={({ isActive }) => 'tree-leaf-btn' + (isActive ? ' active' : '')}
          title={item.name}
        >
          <span className="leaf-dot" aria-hidden />
          <span className="leaf-text">{item.name}</span>
        </NavLink>
      </li>
    );
  }

  const open = isOpen(parentId, item.id);
  const badge = countProjects(item);
  return (
    <li className="tree-group" style={{ '--depth': depth }}>
      <GroupRow
        name={item.name}
        open={open}
        onToggle={() => onToggle(parentId, item.id)}
        badge={badge}
        icon={iconEmojiFor(item.name)}
      />
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
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Sidebar({ projects, isDark, onToggleDark, activeRelPath, parentMap }) {
  const { isOpen, toggle, openChain } = useAccordionDefault(projects);
  const toggleId = 'sidebar-toggle';

  // When route changes to a project, open its category chain and scroll it into view
  useEffect(() => {
    if (!activeRelPath) return;
    openChain(activeRelPath, parentMap);
    const el = document.querySelector('.nav .tree-leaf-btn.active');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeRelPath, parentMap]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={'sidebar' + (isDark ? ' theme-dark' : '')}>
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">Showcase</Link>

        {/* Flat toggle */}
        <input
          id={toggleId}
          type="checkbox"
          className="dm-input"
          checked={isDark}
          onChange={onToggleDark}
        />
        <label htmlFor={toggleId} className="dm-toggle dm-flat" aria-label="Toggle dark mode">
          <svg className="sun" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="5" />
          </svg>
          <svg className="moon" viewBox="0 0 24 24" aria-hidden>
            <path d="M20 14.5A9 9 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5z" />
          </svg>
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
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
