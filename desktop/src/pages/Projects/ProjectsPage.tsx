import { useEffect, useState } from "react";
import CreateProjectModal from "../../components/CreateProjectModal";
import {
  addProject,
  deleteProject,
  getProjects,
} from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const loadProjects = () => {
    setProjects(getProjects());
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = (project: any) => {
    addProject(project);
    loadProjects();
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this project?")) return;
    deleteProject(id);
    loadProjects();
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
                  <td>
                    {project.name}
                    <br />
                    <small>{project.description || "No description"}</small>
                  </td>
                  <td>{project.language}</td>
                  <td>{project.workflow}</td>
                  <td><span className="badge pending">{project.status}</span></td>
                  <td>{project.createdAt}</td>
                  <td>
                    <button className="small-button">Open</button>
                    <button
                      className="small-button danger"
                      onClick={() => handleDelete(project.id)}
                    >
                      Delete
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