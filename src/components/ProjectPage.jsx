// src/components/ProjectPage.jsx
import { useLocation } from 'react-router-dom';

export default function ProjectPage() {
  const { pathname } = useLocation();
  // strip leading slash, decode for spaces/& etc.
  const projectPath = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const projectUrl = `/pages/${projectPath}/index.html`;

  return (
    <div className="iframe-wrap">
      <iframe
        key={projectPath}
        src={projectUrl}
        className="project-iframe"
        title={projectPath || 'project'}
        loading="eager"
      />
    </div>
  );
}
