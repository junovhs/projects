// src/components/Sidebar.jsx
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function NavItem({ item }) {
  const [isOpen, setIsOpen] = useState(true);

  if (item.type === 'project') {
    return (
      <NavLink to={`/${encodePath(item.id)}`} className="nav-link">
        {item.name}
      </NavLink>
    );
  }

  if (item.type === 'category') {
    return (
      <div className="category-item">
        <button onClick={() => setIsOpen((o) => !o)} className="category-toggle">
          <span className={`category-arrow ${isOpen ? 'open' : ''}`}>▶</span>
          {item.name}
        </button>
        {isOpen && (
          <div className="category-children">
            {item.children.map((child) => (
              <NavItem key={child.id} item={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function Sidebar({ projects, theme, toggleTheme }) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <Link to="/"><h1>Showcase</h1></Link>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </header>
      <nav className="nav">
        {projects.map((item) => (
          <NavItem key={item.id} item={item} />
        ))}
      </nav>
    </aside>
  );
}
