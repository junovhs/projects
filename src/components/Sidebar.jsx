import { NavLink, Link } from 'react-router-dom';

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
                {projects.map(project => (
                    <NavLink
                        key={project.id}
                        to={`/${project.id}`}
                        className="nav-link"
                    >
                        {project.name}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}

export default Sidebar;