import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateProjectModal from "../../components/CreateProjectModal";
import { addProject, getProjects } from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";
import { getLanguageLabel } from "../../services/languageService";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (project: any) => {
    await addProject(project);
    await loadProjects();
  };

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <h2>Projects</h2>
          <button onClick={() => setShowCreateProject(true)}>＋ Create Project</button>
        </div>

        {projects.length === 0 ? (
          <div className="empty">No projects created yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Language</th>
                <th>Workflow</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}<br /><small>{project.projectPath || "No path"}</small></td>
                  <td>{getLanguageLabel(project.language)}</td>
                  <td>{project.workflow}</td>
                  <td><span className="badge pending">{project.status}</span></td>
                  <td>{new Date(project.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="small-button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreate={handleCreateProject}
      />
    </>
  );
}