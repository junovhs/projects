// projects/src/hooks/useProjects.js
import { useState, useEffect, useMemo } from 'react';

/**
 * Creates a mapping from a project's URL-friendly slug to its relative file path.
 * @param {Array} nodes - The array of project/category nodes.
 * @returns {Object} A map where keys are slugs and values are relative paths.
 */
function buildSlugMap(nodes) {
  const map = {};
  for (const node of nodes || []) {
    if (node.type === "project" && node.slug && node.id) {
      map[node.slug] = node.id;
    } else if (node.children) {
      Object.assign(map, buildSlugMap(node.children));
    }
  }
  return map;
}

/**
 * Custom hook to fetch and manage the project list from projects.json.
 */
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [slugsReady, setSlugsReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchProjects() {
      try {
        const response = await fetch("/projects.json");
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (!isCancelled) {
          setProjects(data);
          setSlugsReady(true);
        }
      } catch (error) {
        console.error("Failed to load projects.json:", error);
        if (!isCancelled) {
          setProjects([]);
          setSlugsReady(true); // Mark as ready even on failure to avoid infinite loading state
        }
      }
    }

    fetchProjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  const slugToPath = useMemo(() => buildSlugMap(projects), [projects]);

  return { projects, slugToPath, slugsReady };
}