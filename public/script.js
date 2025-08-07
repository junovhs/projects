document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        nav: document.getElementById('project-nav'),
        iframe: document.getElementById('content-frame'),
        welcome: document.getElementById('welcome-screen'),
        themeToggle: document.getElementById('theme-toggle'),
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
        const projectId = window.location.pathname.substring(1);
        if (projectId && projects.some(p => p.id === projectId)) {
            showProject(projectId);
        } else {
            showWelcome();
        }
    };

    // --- Event Listeners ---
    dom.nav.addEventListener('click', e => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const url = e.target.getAttribute('href');
            if (window.location.pathname !== url) {
                history.pushState({}, '', url);
                handleRoute();
            }
        }
    });

    dom.themeToggle.addEventListener('click', () => {
        const currentTheme = dom.html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        dom.html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    window.addEventListener('popstate', handleRoute);

    // --- Initialization ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    dom.html.setAttribute('data-theme', savedTheme);

    fetch('projects.json')
        .then(res => res.json())
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