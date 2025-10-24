// projects/src/components/WelcomePage.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export function WelcomePage({ projects = [] }) {
  const navigate = useNavigate();

  const firstProject = useMemo(() => {
    for (const category of projects) {
      if (category.type === 'category' && category.children) {
        const project = category.children.find(child => child.type === 'project');
        if (project) return project;
      }
    }
    return null;
  }, [projects]);

  const goToFirstProject = () => {
    if (firstProject?.slug) {
      navigate(`/${firstProject.slug}`);
    }
  };

  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <h1 className="welcome-title">Project Showcase</h1>
        <p className="welcome-subtitle">
          A collection of web experiments, utilities, and mini-applications.
          Select a project from the sidebar to begin.
        </p>
        <button
          className="btn btn-primary"
          onClick={goToFirstProject}
          disabled={!firstProject}
        >
          {firstProject ? 'Explore First Project' : 'No Projects Found'}
        </button>
      </header>
    </div>
  );
}