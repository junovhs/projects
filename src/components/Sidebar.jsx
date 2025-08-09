// src/components/Sidebar.jsx
import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

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

function Leaf({
  item,
  depth,
  activeRelPath,
  onOpenAbout,
  onToggleAbout,
  isAboutOpen,
  isMobile,
  onNavigateDone,
}) {
  const to = `/${encodeURIComponent(item.slug || item.id)}`;
  const isActiveLeaf = item.id === activeRelPath;

  return (
    <li className={'tree-leaf' + (isActiveLeaf ? ' active' : '')} style={{ '--depth': depth }}>
      <span className="tree-connector" aria-hidden />
      <div className="leaf-row">
        <NavLink
          to={to}
          className={({ isActive }) => 'tree-leaf-btn' + (isActive ? ' active' : '')}
          onClick={() => {
            // let the route change, then close drawer & clear focus
            requestAnimationFrame(() => {
              try { document.activeElement?.blur(); } catch {}
              onNavigateDone?.();
            });
          }}
        >
          <span className="leaf-dot" aria-hidden />
          <span className="leaf-text">{item.name}</span>
        </NavLink>

        <button
          className="about-btn"
          aria-pressed={isActiveLeaf && isAboutOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isActiveLeaf) onToggleAbout();
            else {
              requestAnimationFrame(() => {
                onNavigateDone?.();
                onOpenAbout();
              });
            }
          }}
          title="About"
        >
          About
        </button>
      </div>
    </li>
  );
}

function Node(props) {
  const { item, depth, parentId, isOpen, onToggle } = props;
  if (item.type === 'project') return <Leaf {...props} />;
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
            <Node key={child.id} {...props} item={child} depth={depth + 1} parentId={item.id} />
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Sidebar({
  projects,
  isDark,
  onToggleDark,
  activeRelPath,
  parentMap,
  onOpenAbout,
  onToggleAbout,
  isAboutOpen,
  isMobile = false,
  open = true,
  onClose = () => {},
}) {
  const { isOpen, toggle, openChain } = useAccordionDefault(projects);

  useEffect(() => {
    if (!activeRelPath) return;
    openChain(activeRelPath, parentMap);
    const el = document.querySelector('.nav .tree-leaf-btn.active');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeRelPath, parentMap]); // eslint-disable-line

  return (
    <aside
      className={
        'sidebar' +
        (isDark ? ' theme-dark' : '') +
        (isMobile ? ' as-drawer' : '') +
        (open ? ' open' : '')
      }
      // IMPORTANT: use inert instead of aria-hidden so we don't hide a focused element
      inert={isMobile && !open ? '' : undefined}
    >
      <header className="sidebar-header">
        <Link to="/" className="brand" aria-label="Home">Showcase</Link>
        <div className="spacer" />
        <button className="btn-flat" onClick={onToggleDark} aria-label="Toggle dark mode">
          {isDark ? '🌙' : '☀️'}
        </button>
        {isMobile && (
          <button className="btn-flat close-btn" onClick={onClose} aria-label="Close menu">✕</button>
        )}
      </header>

      <nav className="nav" role="navigation">
        <ul className="tree-root">
          {(projects || []).map((node) => (
            <Node
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
              isMobile={isMobile}
              onNavigateDone={isMobile ? onClose : undefined}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
