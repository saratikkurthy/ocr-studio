import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const emptyStore = () => ({ version: 1, notebooks: [], updatedAt: null });
const researchDir = (workspacePath) => path.join(workspacePath, ".ocr-studio", "research");
const storeFile = (workspacePath) => path.join(researchDir(workspacePath), "notebooks.json");

function readStore(workspacePath) {
  try {
    const value = JSON.parse(fs.readFileSync(storeFile(workspacePath), "utf8"));
    return { ...emptyStore(), ...value, notebooks: Array.isArray(value.notebooks) ? value.notebooks : [] };
  } catch {
    return emptyStore();
  }
}

function saveStore(workspacePath, store) {
  fs.mkdirSync(researchDir(workspacePath), { recursive: true });
  store.updatedAt = now();
  fs.writeFileSync(storeFile(workspacePath), JSON.stringify(store, null, 2), "utf8");
  return store;
}

function normalizeNotebook(input = {}, existing = {}) {
  const timestamp = now();
  return {
    id: existing.id || uid("notebook"),
    title: String(input.title ?? existing.title ?? "Untitled research notebook").trim() || "Untitled research notebook",
    description: String(input.description ?? existing.description ?? ""),
    tags: Array.isArray(input.tags) ? input.tags.map(String).map((x) => x.trim()).filter(Boolean) : (existing.tags || []),
    author: String(input.author ?? existing.author ?? "Local Researcher"),
    status: ["Draft", "Review", "Published"].includes(input.status) ? input.status : (existing.status || "Draft"),
    content: String(input.content ?? existing.content ?? "# Research notes\n\nStart writing here."),
    evidence: Array.isArray(existing.evidence) ? existing.evidence : [],
    createdAt: existing.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function requireWorkspace(workspacePath) {
  if (!workspacePath || typeof workspacePath !== "string") throw new Error("Workspace path is required.");
}

export function registerResearchWorkbenchIpc({ ipcMain, dialog, shell }) {
  ipcMain.handle("workbench:list", async (_event, { workspacePath }) => {
    requireWorkspace(workspacePath);
    return readStore(workspacePath);
  });

  ipcMain.handle("workbench:create", async (_event, { workspacePath, notebook }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const created = normalizeNotebook(notebook);
    store.notebooks.unshift(created);
    saveStore(workspacePath, store);
    return created;
  });

  ipcMain.handle("workbench:update", async (_event, { workspacePath, notebook }) => {
    requireWorkspace(workspacePath);
    if (!notebook?.id) throw new Error("Notebook id is required.");
    const store = readStore(workspacePath);
    const index = store.notebooks.findIndex((item) => item.id === notebook.id);
    if (index < 0) throw new Error("Notebook not found.");
    store.notebooks[index] = normalizeNotebook(notebook, store.notebooks[index]);
    saveStore(workspacePath, store);
    return store.notebooks[index];
  });

  ipcMain.handle("workbench:delete", async (_event, { workspacePath, notebookId }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    store.notebooks = store.notebooks.filter((item) => item.id !== notebookId);
    saveStore(workspacePath, store);
    return { success: true };
  });

  ipcMain.handle("workbench:addEvidence", async (_event, { workspacePath, notebookId, evidence }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const notebook = store.notebooks.find((item) => item.id === notebookId);
    if (!notebook) throw new Error("Notebook not found.");
    const item = {
      id: uid("evidence"),
      type: String(evidence?.type || "Passage"),
      title: String(evidence?.title || "Untitled evidence"),
      excerpt: String(evidence?.excerpt || ""),
      projectId: evidence?.projectId ?? null,
      projectName: String(evidence?.projectName || ""),
      projectPath: String(evidence?.projectPath || ""),
      documentId: evidence?.documentId ?? null,
      documentName: String(evidence?.documentName || ""),
      pageNumber: evidence?.pageNumber ? Number(evidence.pageNumber) : null,
      sourceId: String(evidence?.sourceId || ""),
      notes: String(evidence?.notes || ""),
      addedAt: now(),
    };
    notebook.evidence.unshift(item);
    notebook.updatedAt = now();
    saveStore(workspacePath, store);
    return item;
  });

  ipcMain.handle("workbench:removeEvidence", async (_event, { workspacePath, notebookId, evidenceId }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const notebook = store.notebooks.find((item) => item.id === notebookId);
    if (!notebook) throw new Error("Notebook not found.");
    notebook.evidence = notebook.evidence.filter((item) => item.id !== evidenceId);
    notebook.updatedAt = now();
    saveStore(workspacePath, store);
    return { success: true };
  });

  ipcMain.handle("workbench:export", async (_event, { workspacePath, notebookId, format = "markdown" }) => {
    requireWorkspace(workspacePath);
    const notebook = readStore(workspacePath).notebooks.find((item) => item.id === notebookId);
    if (!notebook) throw new Error("Notebook not found.");
    const extension = format === "json" ? "json" : "md";
    const result = await dialog.showSaveDialog({
      title: "Export research notebook",
      defaultPath: `${notebook.title.replace(/[^a-z0-9-_]+/gi, "-")}.${extension}`,
      filters: [{ name: extension === "json" ? "JSON" : "Markdown", extensions: [extension] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const content = format === "json"
      ? JSON.stringify(notebook, null, 2)
      : `${notebook.content}\n\n## Evidence\n\n${notebook.evidence.map((item, index) => `${index + 1}. **${item.title}**${item.projectName ? ` — ${item.projectName}` : ""}${item.documentName ? `, ${item.documentName}` : ""}${item.pageNumber ? `, p. ${item.pageNumber}` : ""}\n\n   ${item.excerpt || item.notes || ""}`).join("\n\n")}`;
    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("workbench:openSource", async (_event, filePath) => {
    if (!filePath) return "";
    return shell.openPath(filePath);
  });
}
