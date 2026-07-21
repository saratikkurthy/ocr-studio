import fs from "fs";
import path from "path";
import crypto from "crypto";

function safePart(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function root(projectPath) {
  return path.join(projectPath, ".ocr-studio", "revisions");
}

function pageDir(projectPath, documentId, pageNumber) {
  return path.join(root(projectPath), safePart(documentId), `page-${String(pageNumber).padStart(5, "0")}`);
}

function revisionPath(projectPath, documentId, pageNumber, revisionId) {
  return path.join(pageDir(projectPath, documentId, pageNumber), `${safePart(revisionId)}.json`);
}

function hashPage(page) {
  return crypto.createHash("sha256").update(JSON.stringify(page ?? null)).digest("hex");
}

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return fallback; }
}

export function createPageRevision({ projectPath, documentId, pageNumber, page, action = "edit", actor = "Local user", comment = "", sourceRevisionId = null }) {
  if (!projectPath || !page) return null;
  const dir = pageDir(projectPath, documentId, pageNumber);
  fs.mkdirSync(dir, { recursive: true });
  const createdAt = new Date().toISOString();
  const hash = hashPage(page);
  const existing = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => readJson(path.join(dir, name))).filter(Boolean);
  const latest = existing.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (latest?.pageHash === hash && action !== "restore") return latest;
  const revision = {
    id: `rev-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    documentId: Number(documentId), pageNumber: Number(pageNumber), createdAt,
    action, actor, comment, sourceRevisionId, pageHash: hash,
    summary: page.reviewSummary ?? null,
    page,
  };
  fs.writeFileSync(revisionPath(projectPath, documentId, pageNumber, revision.id), JSON.stringify(revision, null, 2), "utf8");
  return revision;
}

function list(projectPath, documentId, pageNumber) {
  const dir = pageDir(projectPath, documentId, pageNumber);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".json"))
    .map((name) => readJson(path.join(dir, name))).filter(Boolean)
    .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(({ page, ...meta }) => ({ ...meta, wordCount: Array.isArray(page?.words) ? page.words.length : 0 }));
}

function diffPages(before, after) {
  const a = new Map((before?.words ?? []).map((word) => [String(word.id), word]));
  const b = new Map((after?.words ?? []).map((word) => [String(word.id), word]));
  const ids = new Set([...a.keys(), ...b.keys()]);
  const changes = [];
  for (const id of ids) {
    const oldWord = a.get(id); const newWord = b.get(id);
    const oldText = oldWord ? (oldWord.correctedText || oldWord.text || "") : "";
    const newText = newWord ? (newWord.correctedText || newWord.text || "") : "";
    if (!oldWord) changes.push({ wordId:id, type:"added", before:"", after:newText });
    else if (!newWord) changes.push({ wordId:id, type:"removed", before:oldText, after:"" });
    else if (oldText !== newText || oldWord.status !== newWord.status) changes.push({ wordId:id, type:"modified", before:oldText, after:newText, beforeStatus:oldWord.status, afterStatus:newWord.status });
  }
  return { added: changes.filter(x=>x.type==="added").length, removed: changes.filter(x=>x.type==="removed").length, modified: changes.filter(x=>x.type==="modified").length, changes };
}

export function registerRevisionHistoryIpc(ipcMain) {
  ipcMain.handle("revision:list", async (_, data) => ({ success:true, revisions:list(data?.projectPath, data?.documentId, data?.pageNumber) }));
  ipcMain.handle("revision:get", async (_, data) => {
    const revision = readJson(revisionPath(data?.projectPath, data?.documentId, data?.pageNumber, data?.revisionId));
    return revision ? { success:true, revision } : { success:false, message:"Revision not found.", revision:null };
  });
  ipcMain.handle("revision:diff", async (_, data) => {
    const left = readJson(revisionPath(data?.projectPath, data?.documentId, data?.pageNumber, data?.leftRevisionId));
    const right = readJson(revisionPath(data?.projectPath, data?.documentId, data?.pageNumber, data?.rightRevisionId));
    if (!left || !right) return { success:false, message:"Select two valid revisions.", diff:null };
    return { success:true, diff:diffPages(left.page, right.page), left, right };
  });
  ipcMain.handle("revision:restore", async (_, data) => {
    const revision = readJson(revisionPath(data?.projectPath, data?.documentId, data?.pageNumber, data?.revisionId));
    if (!revision?.page) return { success:false, message:"Revision not found.", page:null };
    const target = path.join(data.projectPath, "ocr-word-index", String(data.documentId), `page-${String(data.pageNumber).padStart(5,"0")}.json`);
    if (!fs.existsSync(path.dirname(target))) return { success:false, message:"Word index page folder was not found.", page:null };
    const current = readJson(target);
    if (current) createPageRevision({ projectPath:data.projectPath, documentId:data.documentId, pageNumber:data.pageNumber, page:current, action:"before-restore", comment:`Automatic backup before restoring ${data.revisionId}` });
    const restored = { ...revision.page, updatedAt:new Date().toISOString() };
    fs.writeFileSync(target, JSON.stringify(restored, null, 2), "utf8");
    createPageRevision({ projectPath:data.projectPath, documentId:data.documentId, pageNumber:data.pageNumber, page:restored, action:"restore", comment:data.comment || `Restored ${data.revisionId}`, sourceRevisionId:data.revisionId });
    return { success:true, message:"Revision restored successfully.", page:restored };
  });
}
