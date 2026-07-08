import { useEffect, useState } from "react";
import CreateProjectModal from "../../components/CreateProjectModal";
import { addProject, getProjects } from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";
import { getLanguageLabel } from "../../services/languageService";

export default function DashboardPage() {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

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
      <section className="hero">
        <div>
          <h2>जय श्री कृष्ण 🪶</h2>
          <h1>Welcome to OCR Studio</h1>
          <p>Convert scanned PDFs and images into searchable OCR documents.</p>

          <div className="actions">
            <button className="primary" onClick={() => setShowCreateProject(true)}>
              ＋ New Project
            </button>
            <button className="secondary">☁ Import Document</button>
          </div>
        </div>

        <div className="krishna">
          <img src="/krishna.png" alt="Lord Krishna" />
        </div>
      </section>

      <section className="stats">
        <div className="stat"><h3>Projects</h3><strong>{projects.length}</strong><p>Total Projects</p></div>
        <div className="stat"><h3>Running Jobs</h3><strong>0</strong><p>In Progress</p></div>
        <div className="stat"><h3>Completed</h3><strong>0</strong><p>Successfully Done</p></div>
        <div className="stat"><h3>Pending</h3><strong>0</strong><p>Waiting in Queue</p></div>
      </section>

      <div className="panel">
        <div className="panel-header">
          <h2>Recent Projects</h2>
        </div>

        {projects.length === 0 ? (
          <div className="empty">No projects yet. Create your first OCR project.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Language</th>
                <th>Workflow</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 5).map((project) => (
                <tr key={project.id}>
                  <td>{project.name}<br /><small>{project.description || "No description"}</small></td>
                  <td>{getLanguageLabel(project.language)}</td>
                  <td>{project.workflow}</td>
                  <td><span className="badge pending">{project.status}</span></td>
                  <td>{new Date(project.createdAt).toLocaleString()}</td>
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