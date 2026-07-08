export type Project = {
  id: number;
  name: string;
  description: string;
  language: string;
  workflow: string;
  status: string;
  workspacePath?: string;
  projectPath?: string;
  createdAt: string;
  updatedAt?: string;
  compression?: string;
};

const STORAGE_KEY = "ocr_projects";

export async function getProjects(): Promise<Project[]> {
  if (typeof window !== "undefined" && window.ocrStudio) {
    return await window.ocrStudio.listRecentProjects();
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

export async function addProject(project: {
  name: string;
  description: string;
  language: string;
  workflow: string;
  workspacePath: string;
}): Promise<Project> {
  if (window.ocrStudio) {
    return await window.ocrStudio.createProject(project);
  }

  const projects = await getProjects();

  const newProject: Project = {
    id: Date.now(),
    ...project,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify([newProject, ...projects]));

  return newProject;
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const projects = await getProjects();
  return projects.find((project) => project.id === id);
}