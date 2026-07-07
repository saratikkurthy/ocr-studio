export type Project = {
  id: number;
  name: string;
  description: string;
  language: string;
  workflow: string;
  status: string;
  createdAt: string;
};

const STORAGE_KEY = "ocr_projects";

export function getProjects(): Project[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function addProject(project: Omit<Project, "id" | "status" | "createdAt">) {
  const projects = getProjects();

  const newProject: Project = {
    id: Date.now(),
    ...project,
    status: "Draft",
    createdAt: new Date().toLocaleString(),
  };

  const updated = [newProject, ...projects];
  saveProjects(updated);

  return newProject;
}

export function deleteProject(id: number) {
  const projects = getProjects();
  const updated = projects.filter((p) => p.id !== id);
  saveProjects(updated);
}