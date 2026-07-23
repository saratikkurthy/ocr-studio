import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const citationDir = (workspacePath) => path.join(workspacePath, ".ocr-studio", "citations");
const citationFile = (workspacePath) => path.join(citationDir(workspacePath), "citations.json");
const emptyStore = () => ({ version: 1, citations: [], updatedAt: null });

function requireWorkspace(workspacePath) {
  if (!workspacePath || typeof workspacePath !== "string") throw new Error("Workspace path is required.");
}

function readStore(workspacePath) {
  try {
    const value = JSON.parse(fs.readFileSync(citationFile(workspacePath), "utf8"));
    return { ...emptyStore(), ...value, citations: Array.isArray(value.citations) ? value.citations : [] };
  } catch {
    return emptyStore();
  }
}

function saveStore(workspacePath, store) {
  fs.mkdirSync(citationDir(workspacePath), { recursive: true });
  store.updatedAt = now();
  fs.writeFileSync(citationFile(workspacePath), JSON.stringify(store, null, 2), "utf8");
  return store;
}

function normalize(input = {}, existing = {}) {
  const timestamp = now();
  return {
    id: existing.id || uid("citation"),
    notebookId: String(input.notebookId ?? existing.notebookId ?? ""),
    evidenceId: String(input.evidenceId ?? existing.evidenceId ?? ""),
    type: String(input.type ?? existing.type ?? "Manuscript"),
    title: String(input.title ?? existing.title ?? "Untitled source").trim() || "Untitled source",
    author: String(input.author ?? existing.author ?? "").trim(),
    editor: String(input.editor ?? existing.editor ?? "").trim(),
    publisher: String(input.publisher ?? existing.publisher ?? "").trim(),
    publicationPlace: String(input.publicationPlace ?? existing.publicationPlace ?? "").trim(),
    year: String(input.year ?? existing.year ?? "").trim(),
    volume: String(input.volume ?? existing.volume ?? "").trim(),
    chapter: String(input.chapter ?? existing.chapter ?? "").trim(),
    page: String(input.page ?? existing.page ?? "").trim(),
    manuscript: String(input.manuscript ?? existing.manuscript ?? "").trim(),
    projectName: String(input.projectName ?? existing.projectName ?? "").trim(),
    projectPath: String(input.projectPath ?? existing.projectPath ?? "").trim(),
    documentName: String(input.documentName ?? existing.documentName ?? "").trim(),
    reviewer: String(input.reviewer ?? existing.reviewer ?? "").trim(),
    verified: Boolean(input.verified ?? existing.verified ?? false),
    accessDate: String(input.accessDate ?? existing.accessDate ?? timestamp.slice(0, 10)),
    notes: String(input.notes ?? existing.notes ?? ""),
    createdAt: existing.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function authorLabel(c) {
  return c.author || c.editor || c.projectName || "Unknown author";
}

function formatCitation(c, style = "APA") {
  const author = authorLabel(c);
  const year = c.year || "n.d.";
  const title = c.title || c.documentName || c.manuscript || "Untitled source";
  const source = [c.manuscript || c.documentName, c.volume ? `Vol. ${c.volume}` : "", c.chapter ? `Ch. ${c.chapter}` : "", c.page ? `p. ${c.page}` : ""].filter(Boolean).join(", ");
  const publisher = [c.publicationPlace, c.publisher].filter(Boolean).join(": ");
  if (style === "MLA") return `${author}. “${title}.” ${source || c.projectName}${publisher ? `, ${publisher}` : ""}${c.year ? `, ${c.year}` : ""}.`;
  if (style === "Chicago") return `${author}. “${title}.” ${source || c.projectName}${publisher ? `. ${publisher}` : ""}${c.year ? `, ${c.year}` : ""}.`;
  if (style === "Indic") return `${author}, ${title}${source ? `, ${source}` : ""}${c.year ? ` (${c.year})` : ""}.`;
  return `${author}. (${year}). ${title}. ${source || c.projectName}${publisher ? `. ${publisher}` : ""}.`;
}

function dedupeKey(c) {
  return [c.author, c.title, c.year, c.manuscript, c.documentName, c.page].map((v) => String(v || "").trim().toLowerCase()).join("|");
}

function validateCitation(c) {
  const issues = [];
  if (!c.title) issues.push("Missing title");
  if (!c.author && !c.editor && !c.projectName) issues.push("Missing author or responsible project");
  if (!c.year) issues.push("Missing publication year");
  if (!c.page && ["OCR Page", "Verse", "Chapter", "Manuscript"].includes(c.type)) issues.push("Missing page reference");
  if (c.projectPath && !fs.existsSync(c.projectPath)) issues.push("Linked project path does not exist");
  return issues;
}

function toBibTeX(c, index) {
  const key = `${(c.author || c.projectName || "source").replace(/[^a-z0-9]/gi, "").slice(0, 18)}${c.year || "nd"}${index + 1}`;
  const fields = {
    author: c.author || c.editor || c.projectName,
    title: c.title,
    year: c.year,
    publisher: c.publisher,
    address: c.publicationPlace,
    volume: c.volume,
    chapter: c.chapter,
    pages: c.page,
    note: c.notes,
  };
  return `@book{${key},\n${Object.entries(fields).filter(([,v]) => v).map(([k,v]) => `  ${k} = {${String(v).replace(/[{}]/g, "")}}`).join(",\n")}\n}`;
}

function toRIS(c) {
  return ["TY  - BOOK", `TI  - ${c.title}`, c.author ? `AU  - ${c.author}` : "", c.year ? `PY  - ${c.year}` : "", c.publisher ? `PB  - ${c.publisher}` : "", c.page ? `SP  - ${c.page}` : "", c.notes ? `N1  - ${c.notes}` : "", "ER  -"].filter(Boolean).join("\n");
}

export function registerCitationIpc({ ipcMain, dialog, shell }) {
  ipcMain.handle("citation:list", async (_event, { workspacePath, notebookId }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const citations = notebookId ? store.citations.filter((c) => c.notebookId === notebookId) : store.citations;
    return { ...store, citations };
  });

  ipcMain.handle("citation:create", async (_event, { workspacePath, citation }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const created = normalize(citation);
    store.citations.unshift(created);
    saveStore(workspacePath, store);
    return { ...created, formatted: formatCitation(created, citation?.style || "APA") };
  });

  ipcMain.handle("citation:fromEvidence", async (_event, { workspacePath, notebookId, evidence, defaults = {} }) => {
    requireWorkspace(workspacePath);
    if (!evidence?.id) throw new Error("Evidence is required.");
    const store = readStore(workspacePath);
    const duplicate = store.citations.find((c) => c.notebookId === notebookId && c.evidenceId === evidence.id);
    if (duplicate) return duplicate;
    const created = normalize({
      ...defaults,
      notebookId,
      evidenceId: evidence.id,
      type: evidence.type === "Page" ? "OCR Page" : "Manuscript",
      title: evidence.title,
      manuscript: evidence.documentName,
      documentName: evidence.documentName,
      projectName: evidence.projectName,
      projectPath: evidence.projectPath,
      page: evidence.pageNumber ? String(evidence.pageNumber) : "",
      notes: evidence.excerpt || evidence.notes || "",
    });
    store.citations.unshift(created);
    saveStore(workspacePath, store);
    return created;
  });

  ipcMain.handle("citation:update", async (_event, { workspacePath, citation }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const index = store.citations.findIndex((c) => c.id === citation?.id);
    if (index < 0) throw new Error("Citation not found.");
    store.citations[index] = normalize(citation, store.citations[index]);
    saveStore(workspacePath, store);
    return store.citations[index];
  });

  ipcMain.handle("citation:delete", async (_event, { workspacePath, citationId }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    store.citations = store.citations.filter((c) => c.id !== citationId);
    saveStore(workspacePath, store);
    return { success: true };
  });

  ipcMain.handle("citation:bibliography", async (_event, { workspacePath, notebookId, style = "APA" }) => {
    requireWorkspace(workspacePath);
    const citations = readStore(workspacePath).citations.filter((c) => !notebookId || c.notebookId === notebookId);
    const seen = new Set();
    const entries = citations.filter((c) => { const key = dedupeKey(c); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((c) => ({ ...c, formatted: formatCitation(c, style), issues: validateCitation(c) }))
      .sort((a,b) => a.formatted.localeCompare(b.formatted));
    return { style, entries, duplicateCount: citations.length - entries.length };
  });

  ipcMain.handle("citation:validate", async (_event, { workspacePath, notebookId }) => {
    requireWorkspace(workspacePath);
    const citations = readStore(workspacePath).citations.filter((c) => !notebookId || c.notebookId === notebookId);
    const keys = new Map();
    const results = citations.map((c) => {
      const key = dedupeKey(c); const issues = validateCitation(c);
      if (keys.has(key)) issues.push("Possible duplicate citation"); else keys.set(key, c.id);
      return { citationId: c.id, title: c.title, issues };
    });
    return { valid: results.every((r) => r.issues.length === 0), results, issueCount: results.reduce((n,r) => n + r.issues.length, 0) };
  });

  ipcMain.handle("citation:export", async (_event, { workspacePath, notebookId, format = "bibtex", style = "APA" }) => {
    requireWorkspace(workspacePath);
    const citations = readStore(workspacePath).citations.filter((c) => !notebookId || c.notebookId === notebookId);
    const extension = format === "ris" ? "ris" : format === "csl" ? "json" : format === "markdown" ? "md" : "bib";
    const result = await dialog.showSaveDialog({ title: "Export bibliography", defaultPath: `ocr-studio-bibliography.${extension}`, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    let content;
    if (format === "ris") content = citations.map(toRIS).join("\n\n");
    else if (format === "csl") content = JSON.stringify(citations.map((c) => ({ id:c.id, type:"book", title:c.title, author:c.author ? [{ literal:c.author }] : [], issued:c.year ? { "date-parts":[[Number(c.year) || c.year]] } : undefined, publisher:c.publisher, volume:c.volume, page:c.page })), null, 2);
    else if (format === "markdown") content = (await (async()=>{ const seen=new Set(); return citations.filter(c=>{const k=dedupeKey(c); if(seen.has(k))return false; seen.add(k); return true;}).map(c=>`- ${formatCitation(c, style)}`).join("\n"); })());
    else content = citations.map(toBibTeX).join("\n\n");
    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("citation:openSource", async (_event, filePath) => filePath ? shell.openPath(filePath) : "");
}
