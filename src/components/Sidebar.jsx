// src/components/Sidebar.jsx
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function NavItem({ item }) {
  const [open, setOpen] = useState(true);

  if (item.type === 'project') {
    return (
      <NavLink
        to={`/${encodePath(item.id)}`}
        className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        title={item.name}
      >
        <span className="dot" /> {item.name}
      </NavLink>
    );
  }

  if (item.type === 'category') {
    return (
      <div className="category">
        <button className="category-btn" onClick={() => setOpen((o) => !o)}>
          <span className={'chev' + (open ? ' open' : '')}>▶</span>
          <span className="category-name">{item.name}</span>
        </button>
        {open && (
          <div className="children">
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
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-dot" />
          Showcase
        </Link>

        {/* Modern, minimal toggle */}
        <button
          className={'toggle ' + (theme === 'dark' ? 'is-dark' : 'is-light')}
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title="Toggle theme"
        >
          <span className="toggle-track" />
          <span className="toggle-thumb" />
          <span className="toggle-icon sun" aria-hidden>☀️</span>
          <span className="toggle-icon moon" aria-hidden>🌙</span>
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
