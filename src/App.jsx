import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ProjectPage from './components/ProjectPage';

// --- Reusable Components (kept in App.jsx for simplicity) ---

function WelcomePage() {
    return (
        <div className="welcome-page">
            <h2>Showcase</h2>
            <p>Select a project from the sidebar to begin.</p>
        </div>
    );
}

const pageVariants = {
    initial: { opacity: 0, y: 15 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -15 },
};

const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4,
};

// --- Main App Component ---

function App() {
    const [projects, setProjects] = useState([]);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const location = useLocation();

    useEffect(() => {
        fetch('/projects.json')
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(err => console.error("Failed to load projects.json", err));
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <>
            <Sidebar projects={projects} theme={theme} toggleTheme={toggleTheme} />
            <main className="content-area">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="page-container"
                    >
                        <Routes location={location}>
                            <Route path="/" element={<WelcomePage />} />
                            <Route path="/:projectId" element={<ProjectPage />} />
                        </Routes>
                    </motion.div>
                </AnimatePresence>
            </main>
        </>
    );
}

export default App;