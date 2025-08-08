// src/components/ProjectPage.jsx
import { useLocation } from 'react-router-dom';

export default function ProjectPage({ slugToPath = {} }) {
  const { pathname } = useLocation();
  const raw = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const relPath = raw.includes('/') ? raw : slugToPath[raw];
  const projectUrl = relPath ? `/pages/${relPath}/index.html` : null;

  return (
    <div className="iframe-wrap">
      {projectUrl ? (
        <iframe key={relPath} src={projectUrl} className="project-iframe" title={relPath} />
      ) : (
        <div className="welcome">
          <div className="welcome-overlay">
            <h2>Not found</h2>
            <p>Couldn’t find a project for “{raw}”.</p>
          </div>
        </div>
      )}
    </div>
  );
}
