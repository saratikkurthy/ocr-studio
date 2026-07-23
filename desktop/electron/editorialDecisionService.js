import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const read = (file, fallback) => { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback; } catch { return fallback; } };
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8"); };
const editionIndex = (workspacePath) => path.join(workspacePath, ".ocr-studio", "editions", "editions.json");
function edition(workspacePath, editionId) { return (read(editionIndex(workspacePath), { editions: [] }).editions || []).find((item) => item.id === editionId) || null; }
function baseDir(workspacePath, editionRecord) { return path.join(workspacePath, ".ocr-studio", "editions", editionRecord.folderName); }
function storeFile(workspacePath, editionRecord) { return path.join(baseDir(workspacePath, editionRecord), "editorial-decisions.json"); }
function revisionFile(workspacePath, editionRecord) { return path.join(baseDir(workspacePath, editionRecord), "editorial-decision-revisions.json"); }
function evidenceFile(workspacePath, editionRecord) { return path.join(baseDir(workspacePath, editionRecord), "editorial-decision-evidence.json"); }
function loadStore(workspacePath, editionRecord) {
  const decisions = read(storeFile(workspacePath, editionRecord), { entries: [] });
  const revisions = read(revisionFile(workspacePath, editionRecord), { entries: [] });
  const evidence = read(evidenceFile(workspacePath, editionRecord), { entries: [] });
  decisions.entries = Array.isArray(decisions.entries) ? decisions.entries : [];
  revisions.entries = Array.isArray(revisions.entries) ? revisions.entries : [];
  evidence.entries = Array.isArray(evidence.entries) ? evidence.entries : [];
  return { decisions, revisions, evidence };
}
function snapshot(decision) {
  return {
    label: decision.label || "",
    content: decision.content || "",
    reading: decision.reading || "",
    reason: decision.reason || "",
    confidence: Number(decision.confidence || 0),
    editor: decision.editor || "",
    status: decision.status || "Proposed",
    witnesses: Array.isArray(decision.witnesses) ? decision.witnesses : [],
    reviewedBy: decision.reviewedBy || "",
    reviewNote: decision.reviewNote || ""
  };
}
function addRevision(store, decision, action, actor, note = "") {
  store.revisions.entries.unshift({
    id: crypto.randomUUID(),
    decisionId: decision.id,
    verseId: decision.verseId,
    action,
    actor: String(actor || decision.editor || "Unknown editor"),
    note: String(note || ""),
    snapshot: snapshot(decision),
    createdAt: now()
  });
}
function updateEditionStats(workspacePath, editionId, decisions) {
  const index = read(editionIndex(workspacePath), { version: 1, editions: [] });
  const target = (index.editions || []).find((item) => item.id === editionId);
  if (!target) return;
  const entries = decisions.entries || [];
  target.stats = {
    ...(target.stats || {}),
    decisions: entries.length,
    acceptedDecisions: entries.filter((item) => item.status === "Accepted").length,
    rejectedDecisions: entries.filter((item) => item.status === "Rejected").length,
    pendingDecisions: entries.filter((item) => ["Proposed", "Under Review"].includes(item.status || "Proposed")).length
  };
  target.updatedAt = now();
  write(editionIndex(workspacePath), index);
}
function getWorkspace(workspacePath, editionId, verseId = "") {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return null;
  const store = loadStore(workspacePath, editionRecord);
  const decisions = verseId ? store.decisions.entries.filter((item) => item.verseId === verseId) : store.decisions.entries;
  return {
    edition: editionRecord,
    decisions,
    revisions: store.revisions.entries.filter((item) => !verseId || item.verseId === verseId),
    evidence: store.evidence.entries.filter((item) => !verseId || item.verseId === verseId),
    summary: {
      total: decisions.length,
      proposed: decisions.filter((item) => (item.status || "Proposed") === "Proposed").length,
      underReview: decisions.filter((item) => item.status === "Under Review").length,
      accepted: decisions.filter((item) => item.status === "Accepted").length,
      rejected: decisions.filter((item) => item.status === "Rejected").length,
      superseded: decisions.filter((item) => item.status === "Superseded").length
    }
  };
}
function transition(workspacePath, editionId, input) {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return { success: false, message: "Edition not found." };
  const store = loadStore(workspacePath, editionRecord);
  const decision = store.decisions.entries.find((item) => item.id === input?.decisionId);
  if (!decision) return { success: false, message: "Editorial decision not found." };
  const allowed = ["Proposed", "Under Review", "Accepted", "Rejected", "Superseded"];
  const status = allowed.includes(input?.status) ? input.status : "Proposed";
  addRevision(store, decision, `Status changed from ${decision.status || "Proposed"} to ${status}`, input?.reviewedBy, input?.reviewNote);
  decision.status = status;
  decision.reviewedBy = String(input?.reviewedBy || "");
  decision.reviewNote = String(input?.reviewNote || "");
  decision.reviewedAt = now();
  decision.updatedAt = now();
  write(storeFile(workspacePath, editionRecord), store.decisions);
  write(revisionFile(workspacePath, editionRecord), store.revisions);
  updateEditionStats(workspacePath, editionId, store.decisions);
  return { success: true, message: `Decision marked ${status}.`, workspace: getWorkspace(workspacePath, editionId, input?.verseId) };
}
function addEvidence(workspacePath, editionId, input) {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return { success: false, message: "Edition not found." };
  const store = loadStore(workspacePath, editionRecord);
  const decision = store.decisions.entries.find((item) => item.id === input?.decisionId);
  if (!decision) return { success: false, message: "Editorial decision not found." };
  const evidence = {
    id: crypto.randomUUID(), decisionId: decision.id, verseId: decision.verseId,
    type: String(input?.type || "Manuscript passage"), title: String(input?.title || "Supporting evidence"),
    source: String(input?.source || ""), locator: String(input?.locator || ""), excerpt: String(input?.excerpt || ""),
    note: String(input?.note || ""), strength: Number(input?.strength || 80), createdAt: now()
  };
  store.evidence.entries.unshift(evidence);
  addRevision(store, decision, "Evidence attached", input?.actor, evidence.title);
  write(evidenceFile(workspacePath, editionRecord), store.evidence);
  write(revisionFile(workspacePath, editionRecord), store.revisions);
  return { success: true, message: "Evidence attached to decision.", workspace: getWorkspace(workspacePath, editionId, decision.verseId) };
}
function deleteEvidence(workspacePath, editionId, input) {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return { success: false, message: "Edition not found." };
  const store = loadStore(workspacePath, editionRecord);
  const evidence = store.evidence.entries.find((item) => item.id === input?.evidenceId);
  store.evidence.entries = store.evidence.entries.filter((item) => item.id !== input?.evidenceId);
  if (evidence) {
    const decision = store.decisions.entries.find((item) => item.id === evidence.decisionId);
    if (decision) addRevision(store, decision, "Evidence removed", input?.actor, evidence.title);
  }
  write(evidenceFile(workspacePath, editionRecord), store.evidence);
  write(revisionFile(workspacePath, editionRecord), store.revisions);
  return { success: true, message: "Evidence removed.", workspace: getWorkspace(workspacePath, editionId, input?.verseId) };
}
function restoreRevision(workspacePath, editionId, input) {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return { success: false, message: "Edition not found." };
  const store = loadStore(workspacePath, editionRecord);
  const revision = store.revisions.entries.find((item) => item.id === input?.revisionId);
  if (!revision) return { success: false, message: "Revision not found." };
  const decision = store.decisions.entries.find((item) => item.id === revision.decisionId);
  if (!decision) return { success: false, message: "Editorial decision not found." };
  addRevision(store, decision, "Current state saved before restoration", input?.actor, `Restoring revision ${revision.id}`);
  Object.assign(decision, revision.snapshot, { updatedAt: now(), restoredFromRevisionId: revision.id });
  addRevision(store, decision, "Revision restored", input?.actor, revision.action);
  write(storeFile(workspacePath, editionRecord), store.decisions);
  write(revisionFile(workspacePath, editionRecord), store.revisions);
  updateEditionStats(workspacePath, editionId, store.decisions);
  return { success: true, message: "Earlier editorial decision restored.", workspace: getWorkspace(workspacePath, editionId, decision.verseId) };
}
function compare(workspacePath, editionId, input) {
  const editionRecord = edition(workspacePath, editionId);
  if (!editionRecord) return { success: false, message: "Edition not found." };
  const store = loadStore(workspacePath, editionRecord);
  const ids = Array.isArray(input?.decisionIds) ? input.decisionIds.slice(0, 4) : [];
  const decisions = ids.map((id) => store.decisions.entries.find((item) => item.id === id)).filter(Boolean);
  return { success: true, message: `${decisions.length} editorial decisions selected for comparison.`, decisions: decisions.map((item) => ({ ...item, evidence: store.evidence.entries.filter((ev) => ev.decisionId === item.id), revisions: store.revisions.entries.filter((rev) => rev.decisionId === item.id) })) };
}
export function registerEditorialDecisionIpc({ ipcMain }) {
  ipcMain.handle("editorialDecision:get", async (_event, data) => {
    const result = getWorkspace(String(data?.workspacePath || ""), String(data?.editionId || ""), String(data?.verseId || ""));
    return result ? { success: true, message: "Editorial decisions loaded.", workspace: result } : { success: false, message: "Edition not found." };
  });
  ipcMain.handle("editorialDecision:transition", async (_event, data) => transition(String(data?.workspacePath || ""), String(data?.editionId || ""), data));
  ipcMain.handle("editorialDecision:addEvidence", async (_event, data) => addEvidence(String(data?.workspacePath || ""), String(data?.editionId || ""), data));
  ipcMain.handle("editorialDecision:deleteEvidence", async (_event, data) => deleteEvidence(String(data?.workspacePath || ""), String(data?.editionId || ""), data));
  ipcMain.handle("editorialDecision:restore", async (_event, data) => restoreRevision(String(data?.workspacePath || ""), String(data?.editionId || ""), data));
  ipcMain.handle("editorialDecision:compare", async (_event, data) => compare(String(data?.workspacePath || ""), String(data?.editionId || ""), data));
}
