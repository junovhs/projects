import { useParams } from 'react-router-dom';

function ProjectPage() {
    const { projectId } = useParams();
    // The URL for the project content is relative to the deployed site's root
    const projectUrl = `/pages/${projectId}/index.html`;

    return (
        <iframe
            key={projectId} // This is important: it forces the iframe to re-render on URL change
            src={projectUrl}
            className="project-iframe"
            title={projectId}
        />
    );
}

export default ProjectPage;