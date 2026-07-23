import fs from "fs";
import path from "path";
import crypto from "crypto";

function root(projectPath) { return path.join(projectPath, ".ocr-studio", "governance"); }
function statePath(projectPath) { return path.join(root(projectPath), "governance.json"); }
function reviewPath(projectPath) { return path.join(projectPath, ".ocr-studio", "word-index", "review-collaboration.json"); }
function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`; }
function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function defaultState() {
  return {
    version: 1,
    policy: { requiredApprovals: 1, blockUnresolvedComments: true, requireVerifiedStatus: true, requirePublicationNote: true, lockAfterPublication: true },
    signatures: [], publications: [], audit: [], updatedAt: null,
  };
}
function readState(projectPath) {
  const parsed = readJson(statePath(projectPath), defaultState());
  return { ...defaultState(), ...parsed, policy: { ...defaultState().policy, ...(parsed.policy || {}) }, signatures: parsed.signatures || [], publications: parsed.publications || [], audit: parsed.audit || [] };
}
function saveState(projectPath, state) {
  fs.mkdirSync(root(projectPath), { recursive: true }); state.updatedAt = now();
  fs.writeFileSync(statePath(projectPath), JSON.stringify(state, null, 2), "utf8"); return state;
}
function audit(state, action, details, actor = "Local User") {
  state.audit.push({ id: id("audit"), action, details, actor, createdAt: now() }); state.audit = state.audit.slice(-2000);
}
function readReview(projectPath) { return readJson(reviewPath(projectPath), { assignments: [], comments: [], reviewers: [] }); }
function assignmentPayload(projectPath, assignment) {
  const review = readReview(projectPath);
  const comments = (review.comments || []).filter(c => c.documentId === assignment.documentId && c.status !== "Resolved");
  return { assignmentId: assignment.id, documentId: assignment.documentId, documentName: assignment.documentName, reviewerName: assignment.reviewerName, scope: assignment.scope, pageStart: assignment.pageStart, pageEnd: assignment.pageEnd, status: assignment.status, updatedAt: assignment.updatedAt, openCommentIds: comments.map(c => c.id) };
}
function blockers(projectPath, state, assignment, note = "") {
  const review = readReview(projectPath); const result = [];
  const signatures = state.signatures.filter(s => s.assignmentId === assignment.id && s.valid);
  const open = (review.comments || []).filter(c => c.documentId === assignment.documentId && c.status !== "Resolved").length;
  if (signatures.length < Number(state.policy.requiredApprovals || 1)) result.push(`Requires ${state.policy.requiredApprovals} approval signature(s); ${signatures.length} found.`);
  if (state.policy.blockUnresolvedComments && open > 0) result.push(`${open} unresolved comment(s) remain.`);
  if (state.policy.requireVerifiedStatus && !["Verified", "Published"].includes(assignment.status)) result.push("Assignment must be Verified before publication.");
  if (state.policy.requirePublicationNote && !String(note).trim()) result.push("A publication note is required.");
  return result;
}
function summarize(project) {
  const state = readState(project.projectPath); const review = readReview(project.projectPath); const assignments = review.assignments || [];
  const invalid = state.signatures.filter(s => !s.valid).length;
  const ready = assignments.filter(a => blockers(project.projectPath, state, a, "ready").length === 0 && !state.publications.some(p => p.assignmentId === a.id && p.status === "Published")).length;
  return { projectId: project.id, projectName: project.name, projectPath: project.projectPath, assignments: assignments.length, signatures: state.signatures.filter(s => s.valid).length, invalidSignatures: invalid, publications: state.publications.filter(p => p.status === "Published").length, ready, policy: state.policy, auditCount: state.audit.length };
}

export function registerGovernanceIpc(ipcMain, dialog, shell, readRecentProjects) {
  ipcMain.handle("governance:getWorkspace", async () => {
    const projects = (await readRecentProjects()) || [];
    const summaries = projects.map(summarize);
    return { success: true, message: `Loaded governance for ${summaries.length} projects.`, projects: summaries, totals: summaries.reduce((a, p) => ({ projects: a.projects + 1, ready: a.ready + p.ready, signatures: a.signatures + p.signatures, invalid: a.invalid + p.invalidSignatures, published: a.published + p.publications }), { projects: 0, ready: 0, signatures: 0, invalid: 0, published: 0 }) };
  });
  ipcMain.handle("governance:getProject", async (_, data) => {
    const projectPath = data?.projectPath; if (!projectPath) return { success: false, message: "Project path is required." };
    const state = readState(projectPath); const review = readReview(projectPath);
    const assignments = (review.assignments || []).map(a => ({ ...a, signatures: state.signatures.filter(s => s.assignmentId === a.id), blockers: blockers(projectPath, state, a, "") }));
    return { success: true, message: "Governance loaded.", state, assignments };
  });
  ipcMain.handle("governance:savePolicy", async (_, data) => {
    const state = readState(data.projectPath); state.policy = { ...state.policy, ...data.policy }; audit(state, "POLICY_UPDATED", "Publication policy updated."); saveState(data.projectPath, state);
    return { success: true, message: "Publication policy saved.", state };
  });
  ipcMain.handle("governance:sign", async (_, data) => {
    const review = readReview(data.projectPath); const assignment = (review.assignments || []).find(a => a.id === data.assignmentId);
    if (!assignment) return { success: false, message: "Assignment not found." };
    const state = readState(data.projectPath); const payload = assignmentPayload(data.projectPath, assignment); const contentHash = hash(payload);
    state.signatures.push({ id: id("sig"), assignmentId: assignment.id, documentId: assignment.documentId, documentName: assignment.documentName, reviewer: String(data.reviewer || assignment.reviewerName || "Reviewer"), role: String(data.role || "Reviewer"), comment: String(data.comment || ""), contentHash, signedAt: now(), valid: true });
    audit(state, "REVISION_SIGNED", `${assignment.documentName} signed by ${data.reviewer || assignment.reviewerName}.`, data.reviewer || "Reviewer"); saveState(data.projectPath, state);
    return { success: true, message: "Tamper-evident approval signature created.", state };
  });
  ipcMain.handle("governance:scanIntegrity", async (_, data) => {
    const state = readState(data.projectPath); const review = readReview(data.projectPath); const issues = [];
    for (const sig of state.signatures) {
      const assignment = (review.assignments || []).find(a => a.id === sig.assignmentId);
      if (!assignment) { sig.valid = false; issues.push({ severity: "High", message: `Orphaned signature ${sig.id}.` }); continue; }
      const current = hash(assignmentPayload(data.projectPath, assignment));
      if (current !== sig.contentHash) { sig.valid = false; issues.push({ severity: "High", message: `${assignment.documentName}: signed review data changed.` }); }
    }
    const report = { id: id("integrity"), scannedAt: now(), issues, score: Math.max(0, 100 - issues.length * 15) };
    state.integrityReport = report; audit(state, "INTEGRITY_SCAN", `${issues.length} issue(s) found.`); saveState(data.projectPath, state);
    return { success: true, message: issues.length ? `${issues.length} integrity issue(s) found.` : "Integrity scan passed.", report, state };
  });
  ipcMain.handle("governance:publish", async (_, data) => {
    const review = readReview(data.projectPath); const assignment = (review.assignments || []).find(a => a.id === data.assignmentId);
    if (!assignment) return { success: false, message: "Assignment not found." };
    const state = readState(data.projectPath); const found = blockers(data.projectPath, state, assignment, data.note);
    if (found.length) return { success: false, message: "Publication blocked.", blockers: found };
    const record = { id: id("pub"), assignmentId: assignment.id, documentId: assignment.documentId, documentName: assignment.documentName, note: String(data.note), publishedBy: String(data.actor || "Editor"), publishedAt: now(), status: "Published", locked: Boolean(state.policy.lockAfterPublication), signatureIds: state.signatures.filter(s => s.assignmentId === assignment.id && s.valid).map(s => s.id) };
    state.publications.push(record); audit(state, "PUBLISHED", `${assignment.documentName} published.`, record.publishedBy); saveState(data.projectPath, state);
    return { success: true, message: "Document review assignment published and locked.", record, state };
  });
  ipcMain.handle("governance:exportCertificate", async (_, data) => {
    const state = readState(data.projectPath); const publication = state.publications.find(p => p.id === data.publicationId);
    if (!publication) return { success: false, message: "Publication record not found." };
    const signatures = state.signatures.filter(s => publication.signatureIds.includes(s.id));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>OCR Studio Approval Certificate</title><style>body{font-family:Georgia,serif;margin:48px;color:#3b2415}main{border:8px double #b86b21;padding:40px}h1{color:#9a4f12}code{word-break:break-all}</style></head><body><main><h1>Approval & Publication Certificate</h1><h2>${publication.documentName}</h2><p>Published by <b>${publication.publishedBy}</b> on ${publication.publishedAt}</p><p>${publication.note}</p><h3>Digital Signatures</h3>${signatures.map(s => `<p><b>${s.reviewer}</b> (${s.role}) — ${s.signedAt}<br><code>${s.contentHash}</code></p>`).join("")}<p>Certificate ID: ${publication.id}</p></main></body></html>`;
    const result = await dialog.showSaveDialog({ title: "Export Approval Certificate", defaultPath: `${publication.documentName.replace(/[^a-z0-9]+/gi, "-")}-certificate.html`, filters: [{ name: "HTML", extensions: ["html"] }] });
    if (result.canceled || !result.filePath) return { success: false, message: "Export cancelled." };
    fs.writeFileSync(result.filePath, html, "utf8"); return { success: true, message: "Certificate exported.", filePath: result.filePath };
  });
  ipcMain.handle("governance:openFile", async (_, filePath) => shell.openPath(filePath));
}
