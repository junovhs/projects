// src/components/WelcomePage.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./welcome.css";

/**
 * A clean, minimal landing page for your project showcase.
 * - No external assets
 * - Works at 320px width and up
 * - Offers a single "Open first project" CTA
 * - Shows a tidy summary of categories and project counts
 */
export default function WelcomePage({ projects = [] }) {
  const navigate = useNavigate();

  // First real project for the CTA
  const firstProject = useMemo(() => {
    let found = null;
    const walk = (list) => {
      for (const n of list || []) {
        if (n.type === "project") {
          found = n;
          return;
        }
        if (n.children) walk(n.children);
        if (found) return;
      }
    };
    walk(projects);
    return found;
  }, [projects]);

  // Top-level categories summary
  const categories = useMemo(() => {
    return (projects || [])
      .filter((n) => n.type === "category")
      .map((cat) => {
        const all = [];
        const walk = (list) => {
          for (const n of list || []) {
            if (n.type === "project") all.push(n);
            if (n.children) walk(n.children);
          }
        };
        walk(cat.children || []);
        return {
          id: cat.id,
          name: cat.name,
          count: all.length,
          sample: all.slice(0, 4).map((p) => p.title || p.name || p.id),
        };
      });
  }, [projects]);

  const openFirstProject = () => {
    if (!firstProject) return;
    const slug = firstProject.slug || firstProject.id;
    navigate(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="welcome-wrap">
      <section className="welcome-hero">
        <div className="welcome-hero__bg" aria-hidden="true">
          <svg viewBox="0 0 800 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>
            <rect width="800" height="300" fill="url(#grad)" />
            <g opacity="0.18">
              <circle cx="90" cy="60" r="2" />
              <circle cx="210" cy="110" r="2" />
              <circle cx="380" cy="80" r="2" />
              <circle cx="520" cy="150" r="2" />
              <circle cx="700" cy="70" r="2" />
              <circle cx="640" cy="210" r="2" />
              <circle cx="120" cy="220" r="2" />
              <line x1="90" y1="60" x2="210" y2="110" />
              <line x1="210" y1="110" x2="380" y2="80" />
              <line x1="380" y1="80" x2="520" y2="150" />
              <line x1="520" y1="150" x2="700" y2="70" />
              <line x1="520" y1="150" x2="640" y2="210" />
              <line x1="90" y1="60" x2="120" y2="220" />
            </g>
          </svg>
        </div>

        <div className="welcome-hero__content">
          <h1 className="welcome-title">Welcome to the Project Showcase</h1>
          <p className="welcome-sub">
            A tidy, mobile-friendly template for presenting hands-on tools and experiments.
            Open anything from the sidebar, or jump straight into a project below.
          </p>

          <div className="welcome-actions">
            <button
              className="btn btn-primary"
              onClick={openFirstProject}
              disabled={!firstProject}
              title={firstProject ? "Open first project" : "No projects found"}
            >
              {firstProject ? "Open first project" : "No projects available"}
            </button>
            <a className="btn btn-ghost" href="#browse">
              Browse categories
            </a>
          </div>

          <div className="welcome-tips">
            <div className="tip">
              <span className="tip-emoji" aria-hidden>📁</span>
              <div>
                <div className="tip-title">Projects live in the sidebar</div>
                <div className="tip-desc">
                  Click a project name to load it instantly in the main view.
                </div>
              </div>
            </div>
            <div className="tip">
              <span className="tip-emoji" aria-hidden>📱</span>
              <div>
                <div className="tip-title">Mobile-first layout</div>
                <div className="tip-desc">
                  On phones, tap the ☰ button to open navigation.
                </div>
              </div>
            </div>
            <div className="tip">
              <span className="tip-emoji" aria-hidden>✨</span>
              <div>
                <div className="tip-title">Drop-in friendly</div>
                <div className="tip-desc">
                  Add or remove projects without changing the layout.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="browse" className="welcome-cats">
        <h2 className="sec-title">Browse categories</h2>
        {categories.length === 0 ? (
          <div className="empty-note">
            No categories yet. Add a few projects and they’ll show up here.
          </div>
        ) : (
          <div className="cat-grid">
            {categories.map((c) => (
              <div key={c.id} className="cat-card">
                <div className="cat-head">
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-badge">{c.count}</div>
                </div>
                {c.sample.length > 0 && (
                  <ul className="sample-list">
                    {c.sample.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                    {c.count > c.sample.length && (
                      <li className="more">+{c.count - c.sample.length} more…</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
