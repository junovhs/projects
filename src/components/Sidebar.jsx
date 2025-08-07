// src/components/Sidebar.jsx (New Recursive Version)
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

// This is a new, recursive component to render each item
function NavItem({ item }) {
    const [isOpen, setIsOpen] = useState(true); // Categories are open by default

    // If it's a project, render a simple link
    if (item.type === 'project') {
        return (
            <NavLink to={`/${item.id}`} className="nav-link">
                {item.name}
            </NavLink>
        );
    }

    // If it's a category, render a button and its children
    if (item.type === 'category') {
        return (
            <div className="category-item">
                <button onClick={() => setIsOpen(!isOpen)} className="category-toggle">
                    <span className={`category-arrow ${isOpen ? 'open' : ''}`}>▶</span>
                    {item.name}
                </button>
                {isOpen && (
                    <div className="category-children">
                        {item.children.map(child => <NavItem key={child.id} item={child} />)}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// The main Sidebar component is now simpler
function Sidebar({ projects, theme, toggleTheme }) {
    return (
        <aside className="sidebar">
            <header className="sidebar-header">
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                     <h1>Showcase</h1>
                </Link>
                <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
            </header>
            <nav className="nav">
                {projects.map(item => <NavItem key={item.id} item={item} />)}
            </nav>
        </aside>
    );
}

export default Sidebar;