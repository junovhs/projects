// src/components/Sidebar.jsx
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Count total descendant projects for a category node */
function countProjects(node) {
  if (!node) return 0;
  if (node.type === 'project') return 1;
  return (node.children || []).reduce((acc, n) => acc + countProjects(n), 0);
}

/** Pick a simple emoji-ish fallback icon by name (no external deps) */
function iconEmojiFor(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('lifestyle')) return '✨';
  if (n.includes('optic') || n.includes('design')) return '⧉';
  if (n.includes('research')) return '🧪';
  if (n.includes('utilit') || n.includes('tool')) return '☰';
  if (n.includes('travel')) return '🗂';
  return '📁';
}

/** One-open-per-level accordion control */
function useAccordionDefault(projects) {
  const firstCategoryId = useMemo(() => {
    const first = (projects || []).find((x) => x.type === 'category');
    return first ? first.id : null;
  }, [projects]);

  const [openByParent, setOpenByParent] = useState({ root: firstCategoryId });
  useEffect(() => {
    // Reset when project tree changes
    setOpenByParent({ root: firstCategoryId });
  }, [firstCategoryId]);

  function toggle(parentId, id) {
    setOpenByParent((m) => ({
      ...m,
      [parentId]: m[parentId] === id ? null : id,
    }));
  }

  const isOpen = (parentId, id) => openByParent[parentId] === id;
  return { isOpen, toggle };
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
    return (
      <li className="tree-leaf" style={{ '--depth': depth }}>
        <span className="tree-connector" aria-hidden />
        <NavLink
          to={`/${encodePath(item.id)}`}
          className={({ isActive }) => 'tree-leaf-btn' + (isActive ? ' active' : '')}
          title={item.name}
        >
          {/* dot only when active */}
          <span className="leaf-dot" aria-hidden />
          <span className="leaf-text">{item.name}</span>
        </NavLink>
      </li>
    );
  }

  // Category node
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

export default function Sidebar({ projects, isDark, onToggleDark }) {
  const { isOpen, toggle } = useAccordionDefault(projects);

  // toggle id must be unique per page load
  const toggleId = 'sidebar-toggle';

  return (
    <aside className={'sidebar' + (isDark ? ' theme-dark' : '')}>
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-dot" />
          Showcase
        </Link>

        {/* CodePen-style toggle, scaled down */}
        <input
          id={toggleId}
          type="checkbox"
          className="dm-input"
          checked={isDark}
          onChange={onToggleDark}
        />
        <label htmlFor={toggleId} className="dm-toggle" aria-label="Toggle dark mode">
          {/* tiny SVGs (same idea as CodePen) */}
          <svg className="sun" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <g>
              <line x1="12" y1="1.5" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22.5" />
              <line x1="1.5" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22.5" y2="12" />
              <line x1="4.8" y1="4.8"
