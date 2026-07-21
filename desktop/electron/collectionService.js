import fs from "fs";
import path from "path";
import { spawn } from "child_process";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function safeReadJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : fallback; }
  catch { return fallback; }
}
function writeJson(file, value) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8"); }
function registryPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "collections.json"); }
function assignmentsPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "collection-assignments.json"); }
function readRegistry(workspacePath) { return safeReadJson(registryPath(workspacePath), { version: 1, collections: [], updatedAt: null }); }
function readAssignments(workspacePath) { return safeReadJson(assignmentsPath(workspacePath), { version: 1, assignments: {}, updatedAt: null }); }
function saveRegistry(workspacePath, registry) { registry.updatedAt = new Date().toISOString(); writeJson(registryPath(workspacePath), registry); return registry; }
function saveAssignments(workspacePath, assignments) { assignments.updatedAt = new Date().toISOString(); writeJson(assignmentsPath(workspacePath), assignments); return assignments; }
function folderSize(folder) {
  if (!folder || !fs.existsSync(folder)) return 0;
  let total = 0;
  const stack = [folder];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else { try { total += fs.statSync(full).size; } catch {} }
    }
  }
  return total;
}
function projectStats(project) {
  const projectPath = project.projectPath;
  const docs = safeReadJson(path.join(projectPath || "", "documents.json"), []);
  const manifest = safeReadJson(path.join(projectPath || "", "ocr-word-index", "manifest.json"), { documents: [] });
  const confidence = safeReadJson(path.join(projectPath || "", "page-confidence.json"), []);
  const publishHistory = safeReadJson(path.join(projectPath || "", "Publish", "history.json"), []);
  const indexedDocs = Array.isArray(manifest.documents) ? manifest.documents : [];
  const totalWords = indexedDocs.reduce((sum, d) => sum + Number(d.totalWords || 0), 0);
  const pages = indexedDocs.reduce((sum, d) => sum + Number(d.pageCount || d.indexedPageCount || 0), 0);
  const avgConfidence = confidence.length ? confidence.reduce((sum, p) => sum + Number(p.confidence || 0), 0) / confidence.length : 0;
  let reviewed = 0, indexed = 0;
  if (projectPath && fs.existsSync(path.join(projectPath, "ocr-word-index"))) {
    for (const d of indexedDocs) {
      const folder = path.join(projectPath, "ocr-word-index", String(d.documentId));
      if (!fs.existsSync(folder)) continue;
      for (const file of fs.readdirSync(folder).filter(x => /^page-\d+\.json$/i.test(x))) {
        const page = safeReadJson(path.join(folder, file), null);
        if (!page?.words) continue;
        indexed += page.words.length;
        reviewed += page.words.filter(w => w.status && w.status !== "Unreviewed").length;
      }
    }
  }
  return {
    documents: Array.isArray(docs) ? docs.length : 0,
    pages,
    words: totalWords,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    reviewPercent: indexed ? Number(((reviewed / indexed) * 100).toFixed(1)) : 0,
    publishedDocuments: Array.isArray(publishHistory) ? publishHistory.length : 0,
    storageBytes: folderSize(projectPath),
  };
}
function aggregateCollection(collection, projects, assignments) {
  const members = projects.filter(p => assignments.assignments[String(p.id)] === collection.id);
  const stats = members.map(projectStats);
  const pages = stats.reduce((s, x) => s + x.pages, 0);
  const words = stats.reduce((s, x) => s + x.words, 0);
  const documents = stats.reduce((s, x) => s + x.documents, 0);
  const storageBytes = stats.reduce((s, x) => s + x.storageBytes, 0);
  const publishedDocuments = stats.reduce((s, x) => s + x.publishedDocuments, 0);
  const avgConfidence = stats.length ? stats.reduce((s, x) => s + x.averageConfidence, 0) / stats.length : 0;
  const reviewPercent = stats.length ? stats.reduce((s, x) => s + x.reviewPercent, 0) / stats.length : 0;
  return { ...collection, projects: members, statistics: { projectCount: members.length, documents, pages, words, storageBytes, publishedDocuments, averageConfidence: Number(avgConfidence.toFixed(2)), reviewPercent: Number(reviewPercent.toFixed(1)) } };
}

export function registerCollectionIpc(ipcMain, dialog, shell, readRecentProjects) {
  ipcMain.handle("collection:list", async (_e, data) => {
    const workspacePath = data?.workspacePath;
    if (!workspacePath) return { success: false, message: "Workspace path is required.", collections: [] };
    const registry = readRegistry(workspacePath);
    const assignments = readAssignments(workspacePath);
    const projects = readRecentProjects().filter(p => p.workspacePath === workspacePath || p.projectPath?.startsWith(workspacePath));
    return { success: true, collections: registry.collections.map(c => aggregateCollection(c, projects, assignments)), unassignedProjects: projects.filter(p => !assignments.assignments[String(p.id)]) };
  });

  ipcMain.handle("collection:create", async (_e, data) => {
    const workspacePath = data?.workspacePath;
    const name = String(data?.name || "").trim();
    if (!workspacePath || !name) return { success: false, message: "Workspace and collection name are required." };
    const registry = readRegistry(workspacePath);
    const now = new Date().toISOString();
    const collection = { id: `collection-${Date.now()}`, name, description: String(data.description || ""), institution: String(data.institution || ""), owner: String(data.owner || ""), license: String(data.license || ""), languages: Array.isArray(data.languages) ? data.languages : [], tags: Array.isArray(data.tags) ? data.tags : [], color: String(data.color || "#c2410c"), icon: String(data.icon || "📚"), createdAt: now, updatedAt: now };
    registry.collections.unshift(collection);
    saveRegistry(workspacePath, registry);
    return { success: true, message: "Collection created.", collection };
  });

  ipcMain.handle("collection:update", async (_e, data) => {
    const registry = readRegistry(data.workspacePath);
    const index = registry.collections.findIndex(c => c.id === data.collection?.id);
    if (index < 0) return { success: false, message: "Collection not found." };
    registry.collections[index] = { ...registry.collections[index], ...data.collection, updatedAt: new Date().toISOString() };
    saveRegistry(data.workspacePath, registry);
    return { success: true, message: "Collection updated.", collection: registry.collections[index] };
  });

  ipcMain.handle("collection:delete", async (_e, data) => {
    const registry = readRegistry(data.workspacePath);
    registry.collections = registry.collections.filter(c => c.id !== data.collectionId);
    const assignments = readAssignments(data.workspacePath);
    for (const key of Object.keys(assignments.assignments)) if (assignments.assignments[key] === data.collectionId) delete assignments.assignments[key];
    saveRegistry(data.workspacePath, registry); saveAssignments(data.workspacePath, assignments);
    return { success: true, message: "Collection deleted." };
  });

  ipcMain.handle("collection:assignProject", async (_e, data) => {
    const assignments = readAssignments(data.workspacePath);
    if (data.collectionId) assignments.assignments[String(data.projectId)] = data.collectionId;
    else delete assignments.assignments[String(data.projectId)];
    saveAssignments(data.workspacePath, assignments);
    return { success: true, message: "Project collection updated." };
  });

  ipcMain.handle("collection:export", async (_e, data) => {
    const registry = readRegistry(data.workspacePath);
    const collection = registry.collections.find(c => c.id === data.collectionId);
    if (!collection) return { success: false, message: "Collection not found.", filePath: null };
    const assignments = readAssignments(data.workspacePath);
    const projects = readRecentProjects().filter(p => assignments.assignments[String(p.id)] === collection.id);
    const result = await dialog.showSaveDialog({ title: "Export Collection", defaultPath: path.join(data.workspacePath, `${collection.name.replace(/[^a-z0-9_-]+/gi, "-")}.zip`), filters: [{ name: "ZIP archive", extensions: ["zip"] }] });
    if (result.canceled || !result.filePath) return { success: false, message: "Export cancelled.", filePath: null };
    const staging = path.join(data.workspacePath, ".ocr-studio", "exports", `${collection.id}-${Date.now()}`); ensureDir(staging);
    writeJson(path.join(staging, "collection.json"), aggregateCollection(collection, projects, assignments));
    const projectRoot = path.join(staging, "projects");
    ensureDir(projectRoot);
    for (const project of projects) {
      if (!project.projectPath || !fs.existsSync(project.projectPath)) continue;
      const destination = path.join(projectRoot, `${String(project.id)}-${String(project.name).replace(/[^a-z0-9_-]+/gi, "-")}`);
      fs.cpSync(project.projectPath, destination, { recursive: true, force: true });
    }
    const ps = `[System.IO.Compression.ZipFile]::CreateFromDirectory('${staging.replace(/'/g,"''")}','${result.filePath.replace(/'/g,"''")}')`;
    await new Promise((resolve, reject) => { const child = spawn("powershell.exe", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.IO.Compression.FileSystem; " + ps]); child.on("exit", code => code === 0 ? resolve() : reject(new Error("ZIP export failed."))); child.on("error", reject); });
    fs.rmSync(staging, { recursive: true, force: true });
    return { success: true, message: "Collection export created.", filePath: result.filePath };
  });

  ipcMain.handle("collection:openExport", async (_e, filePath) => shell.openPath(filePath));
}
