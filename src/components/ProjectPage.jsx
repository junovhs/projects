// src/components/ProjectPage.jsx
import { useLocation } from 'react-router-dom';

export default function ProjectPage() {
  const { pathname } = useLocation();
  // Drop leading "/" and decode for spaces/& etc.
  const projectPath = decodeURIComponent(pathname.replace(/^\/+/, ''));

  const projectUrl = `/pages/${projectPath}/index.html`;

  return (
    <iframe
      key={projectPath}
      src={projectUrl}
      className="project-iframe"
      title={projectPath}
    />
  );
}
