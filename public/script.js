document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        nav: document.getElementById('project-nav'),
        iframe: document.getElementById('content-frame'),
        welcome: document.getElementById('welcome-screen'),
        themeToggle: document.getElementById('theme-toggle'),
        siteTitle: document.getElementById('site-title'),
        html: document.documentElement,
    };

    let projects = [];

    const renderNav = () => {
        if (projects.length === 0) {
            dom.nav.innerHTML = '<p class="nav-message">No projects found.</p>';
            return;
        }
        dom.nav.innerHTML = projects.map(p =>
            `<a href="/${p.id}" data-id="${p.id}">${p.name}</a>`
        ).join('');
    };

    const showProject = (projectId) => {
        dom.welcome.classList.add('hidden');
        dom.iframe.classList.remove('hidden');
        // The path is now relative to the deployed site root
        dom.iframe.src = `pages/${projectId}/index.html`;

        document.querySelectorAll('#project-nav a').forEach(a => {
            a.classList.toggle('active', a.dataset.id === projectId);
        });
        document.title = projects.find(p => p.id === projectId)?.name || 'Showcase';
    };

    const showWelcome = () => {
        dom.welcome.classList.remove('hidden');
        dom.iframe.classList.add('hidden');
        dom.iframe.src = 'about:blank';
        document.querySelectorAll('#project-nav a').forEach(a => a.classList.remove('active'));
        document.title = 'My Showcase';
    };

    const handleRoute = () => {
        const path = window.location.pathname;
        // Check if path is just "/" or "/index.html"
        if (path === '/' || path === '/index.html') {
            showWelcome();
            return;
        }
        const projectId = path.substring(1);
        if (projectId && projects.some(p => p.id === projectId)) {
            showProject(projectId);
        } else {
            // If the URL is invalid, redirect to the home page
            history.replaceState({}, '', '/');
            showWelcome();
        }
    };

    const navigate = (path) => {
        if (window.location.pathname !== path) {
            history.pushState({}, '', path);
            handleRoute();
        }
    };

    // --- Event Listeners ---
    dom.nav.addEventListener('click', e => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            navigate(e.target.getAttribute('href'));
        }
    });

    dom.siteTitle.addEventListener('click', () => {
        navigate('/');
    });

    dom.themeToggle.addEventListener('click', () => {
        const newTheme = dom.html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        dom.html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    window.addEventListener('popstate', handleRoute);

    // --- Initialization ---
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    dom.html.setAttribute('data-theme', savedTheme);

    fetch('projects.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            projects = data;
            renderNav();
            handleRoute(); // Handle initial route after projects have loaded
        })
        .catch(err => {
            console.error("Failed to load projects.json", err);
            dom.nav.innerHTML = '<p class="nav-message">Error loading projects.</p>';
        });
});