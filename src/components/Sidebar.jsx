// projects/src/components/Sidebar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

function Category({ category, onPick }) {
  const [isOpen, setIsOpen] = useState(true);
  const projects = category.children.filter(c => c.type === 'project');

  return (
    <li className="category-item">
      <button className="category-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className={`category-chevron ${isOpen ? 'open' : ''}`}>▼</span>
        <span className="category-name">{category.name}</span>
        <span className="category-count">{projects.length}</span>
      </button>
      {isOpen && (
        <ul className="project-list">
          {projects.map(project => (
            <li key={project.id}>
              <NavLink
                to={`/${project.slug}`}
                className="project-link"
                onClick={onPick}
              >
                {project.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ projects = [], isMobile, open, onClose, isDark, onToggleTheme }) {
  const categories = projects.filter(p => p.type === 'category' && p.children?.length > 0);

  return (
    <>
      <AnimatePresence>
        {isMobile && open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drawer-backdrop"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <aside className={`sidebar-root ${open || !isMobile ? 'open' : ''}`}>
        <div className="sidebar-inner">
          <header className="sidebar-header">
            <h1 className="sidebar-title">Showcase</h1>
            <button
              className="theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </header>
          <nav className="tree-nav">
            <ul className="tree-list">
              {categories.map(cat => (
                <Category key={cat.id} category={cat} onPick={isMobile ? onClose : undefined} />
              ))}
            </ul>
          </nav>
        </div>
        {isMobile && (
          <button className="close-drawer-btn" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        )}
      </aside>
    </>
  );
}