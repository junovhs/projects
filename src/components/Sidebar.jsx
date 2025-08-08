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

/** One-open-per-level accordion control */
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
          {/* dot only when active (CSS toggles opacity) */}
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
  const toggleId = 'sidebar-toggle';

  return (
    <aside className={'sidebar' + (isDark ? ' theme-dark' : '')}>
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-dot" />
          Showcase
        </Link>

        {/* CodePen-style toggle (compact, fully closed SVGs) */}
        <input
          id={toggleId}
          type="checkbox"
          className="dm-input"
          checked={isDark}
          onChange={onToggleDark}
        />
        <label htmlFor={toggleId} className="dm-toggle" aria-label="Toggle dark mode">
          {/* SUN */}
          <svg className="sun" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="2" r="1" />
            <circle cx="12" cy="22" r="1" />
            <circle cx="2" cy="12" r="1" />
            <circle cx="22" cy="12" r="1" />
            <circle cx="4.5" cy="4.5" r="1" />
            <circle cx="19.5" cy="4.5" r="1" />
            <circle cx="4.5" cy="19.5" r="1" />
            <circle cx="19.5" cy="19.5" r="1" />
          </svg>
          {/* MOON */}
          <svg className="moon" viewBox="0 0 24 24" aria-hidden>
            <path d="M21 14.5A9 9 0 0 1 9.5 3 7.5 7.5 0 1 0 21 14.5z" />
            <circle cx="16.5" cy="6.5" r="0.8" />
            <circle cx="18.5" cy="8.3" r="0.5" />
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
