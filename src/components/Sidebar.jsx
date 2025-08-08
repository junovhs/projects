// src/components/Sidebar.jsx
import { useState, useMemo } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  ListTree,
  Sparkles,
  Beaker,
} from 'lucide-react';

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Count total descendant projects for a category node */
function countProjects(node) {
  if (!node) return 0;
  if (node.type === 'project') return 1;
  return (node.children || []).reduce((acc, n) => acc + countProjects(n), 0);
}

/** Choose a category icon based on the name */
function categoryIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('lifestyle')) return Sparkles;
  if (n.includes('optic') || n.includes('design')) return Layers;
  if (n.includes('research')) return Beaker;
  if (n.includes('utilit') || n.includes('tool')) return ListTree;
  return Folder;
}

function GroupRow({ name, open, toggle }) {
  const Icon = categoryIcon(name);
  return (
    <div className="tree-group-row" onClick={toggle} role="button" aria-expanded={open}>
      <span className="tree-disclosure">
        {open ? <ChevronDown className="chev" /> : <ChevronRight className="chev" />}
      </span>
      <Icon className="tree-icon" />
      <span className="tree-label">{name}</span>
      {/* Badge is set by parent via ::after; we keep a span for a11y and layout */}
      <span className="tree-badge" aria-hidden />
    </div>
  );
}

function TreeNode({ item, depth = 0, setBadgeCount }) {
  const [open, setOpen] = useState(true);

  if (item.type === 'project') {
    return (
      <li className="tree-leaf" style={{ '--depth': depth }} aria-label={item.name}>
        <span className="tree-connector" aria-hidden />
        <NavLink
          to={`/${encodePath(item.id)}`}
          className={({ isActive }) => 'tree-leaf-btn' + (isActive ? ' active' : '')}
          title={item.name}
        >
          <span className="leaf-dot" aria-hidden />
          <span className="leaf-text">{item.name}</span>
        </NavLink>
      </li>
    );
  }

  // category
  const total = useMemo(() => countProjects(item), [item]);
  // feed count to parent for badge content via CSS custom property
  const toggle = () => setOpen((o) => !o);

  return (
    <li className="tree-group" style={{ '--depth': depth, '--count': `"${total}"` }}>
      <GroupRow name={item.name} open={open} toggle={toggle} />
      <div className={'tree-collapse ' + (open ? 'open' : '')}>
        <ul className="tree-children">
          {(item.children || []).map((child) => (
            <TreeNode key={child.id} item={child} depth={depth + 1} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Sidebar({ projects, theme, toggleTheme }) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-dot" />
          Showcase
        </Link>

        {/* Modern toggle from previous version */}
        <button
          className={'toggle ' + (theme === 'dark' ? 'is-dark' : 'is-light')}
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title="Toggle theme"
        >
          <span className="toggle-track" />
          <span className="toggle-thumb" />
          <span className="toggle-icon sun" aria-hidden>
            ☀️
          </span>
          <span className="toggle-icon moon" aria-hidden>
            🌙
          </span>
        </button>
      </header>

      <nav className="nav">
        <ul className="tree-root">
          {projects.map((item) =>
            item.type === 'category' ? (
              <TreeNode key={item.id} item={item} />
            ) : (
              // top-level project (rare, but supported)
              <TreeNode key={item.id} item={item} />
            )
          )}
        </ul>
      </nav>
    </aside>
  );
}
