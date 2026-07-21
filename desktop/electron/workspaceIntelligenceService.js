import fs from "fs";
import path from "path";

function safeReadJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : fallback; }
  catch { return fallback; }
}
function folderSize(folder) {
  if (!folder || !fs.existsSync(folder)) return 0;
  let total = 0; const stack = [folder];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try { if (entry.isDirectory()) stack.push(full); else total += fs.statSync(full).size; } catch {}
    }
  }
  return total;
}
function countFiles(folder, matcher = () => true) {
  if (!folder || !fs.existsSync(folder)) return 0;
  let count = 0; const stack = [folder];
  while (stack.length) {
    const current = stack.pop();
    let entries = []; try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full); else if (matcher(full)) count += 1;
    }
  }
  return count;
}
function parseDate(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? time : 0; }
function pct(value, total) { return total ? Math.round((value / total) * 100) : 0; }
function formatActivity(type, project, detail, timestamp) { return { type, projectId: project.id, projectName: project.name, detail, timestamp }; }

function inspectProject(project) {
  const projectPath = project.projectPath || "";
  const documents = safeReadJson(path.join(projectPath, "documents.json"), []);
  const jobs = safeReadJson(path.join(projectPath, "ocr-jobs.json"), []);
  const queue = safeReadJson(path.join(projectPath, "ocr-queue.json"), []);
  const manifest = safeReadJson(path.join(projectPath, "ocr-word-index", "manifest.json"), { documents: [] });
  const confidence = safeReadJson(path.join(projectPath, "page-confidence.json"), []);
  const publishHistory = safeReadJson(path.join(projectPath, "publication-history.json"), []);
  const publishQueue = safeReadJson(path.join(projectPath, "publication-queue.json"), []);
  const collab = safeReadJson(path.join(projectPath, "review-collaboration.json"), {});
  const docs = Array.isArray(documents) ? documents : [];
  const ocrJobs = Array.isArray(jobs) ? jobs : [];
  const queueItems = Array.isArray(queue) ? queue : Array.isArray(queue?.items) ? queue.items : [];
  const indexedDocs = Array.isArray(manifest?.documents) ? manifest.documents : [];
  const confidenceRows = Array.isArray(confidence) ? confidence : Array.isArray(confidence?.records) ? confidence.records : [];
  const publications = Array.isArray(publishHistory) ? publishHistory : Array.isArray(publishHistory?.items) ? publishHistory.items : [];
  const publicationQueue = Array.isArray(publishQueue) ? publishQueue : Array.isArray(publishQueue?.items) ? publishQueue.items : [];
  const assignments = Array.isArray(collab?.assignments) ? collab.assignments : [];
  const comments = Array.isArray(collab?.comments) ? collab.comments : [];

  let totalWords = 0, lowWords = 0, pages = 0, corrected = 0, verified = 0, unreviewed = 0;
  for (const doc of indexedDocs) {
    totalWords += Number(doc.totalWords) || 0;
    lowWords += Number(doc.lowConfidenceWords) || 0;
    pages += Number(doc.indexedPageCount ?? doc.pageCount) || 0;
  }
  const indexRoot = path.join(projectPath, "ocr-word-index");
  if (fs.existsSync(indexRoot)) {
    const docFolders = fs.readdirSync(indexRoot, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const folder of docFolders) {
      const pageFiles = fs.readdirSync(path.join(indexRoot, folder.name)).filter(name => /^page-\d+\.json$/i.test(name));
      for (const pageFile of pageFiles) {
        const page = safeReadJson(path.join(indexRoot, folder.name, pageFile), null);
        const words = Array.isArray(page?.words) ? page.words : [];
        for (const word of words) {
          const status = String(word.status || "Unreviewed").toLowerCase();
          if (status === "corrected") corrected += 1;
          else if (status === "verified") verified += 1;
          else if (status === "unreviewed") unreviewed += 1;
        }
      }
    }
  }
  const avgConfidence = confidenceRows.length
    ? confidenceRows.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / confidenceRows.length
    : indexedDocs.length ? indexedDocs.reduce((sum, item) => sum + (Number(item.averageConfidence) || 0), 0) / indexedDocs.length : 0;
  const converted = docs.filter(d => ["converted", "completed"].includes(String(d.status).toLowerCase()) || d.outputPath || d.searchablePath).length;
  const failed = docs.filter(d => String(d.status).toLowerCase() === "failed").length;
  const running = [...ocrJobs, ...queueItems].filter(j => ["running", "processing"].includes(String(j.status).toLowerCase())).length;
  const pending = [...ocrJobs, ...queueItems].filter(j => ["waiting", "queued", "pending"].includes(String(j.status).toLowerCase())).length;
  const completedJobs = ocrJobs.filter(j => String(j.status).toLowerCase() === "completed").length;
  const published = publications.filter(p => !["failed", "cancelled"].includes(String(p.status).toLowerCase())).length;
  const pendingPublish = publicationQueue.filter(p => ["queued", "waiting", "pending", "running"].includes(String(p.status).toLowerCase())).length;
  const activeAssignments = assignments.filter(a => !["completed", "closed"].includes(String(a.status).toLowerCase())).length;
  const openComments = comments.filter(c => !c.resolvedAt && String(c.status || "open").toLowerCase() !== "resolved").length;
  const latest = [project.updatedAt, project.createdAt, ...docs.map(d => d.completedAt || d.importedAt), ...ocrJobs.map(j => j.endedAt || j.startedAt), ...publications.map(p => p.createdAt || p.completedAt)].map(parseDate).sort((a,b)=>b-a)[0] || 0;
  const activities = [];
  docs.slice().sort((a,b)=>parseDate(b.completedAt||b.importedAt)-parseDate(a.completedAt||a.importedAt)).slice(0,2).forEach(d => activities.push(formatActivity("document", project, `${d.fileName || "Document"} · ${d.status || "Imported"}`, d.completedAt || d.importedAt)));
  ocrJobs.slice().sort((a,b)=>parseDate(b.endedAt||b.startedAt)-parseDate(a.endedAt||a.startedAt)).slice(0,2).forEach(j => activities.push(formatActivity("ocr", project, `${j.fileName || "OCR job"} · ${j.status || "Updated"}`, j.endedAt || j.startedAt)));
  publications.slice().sort((a,b)=>parseDate(b.completedAt||b.createdAt)-parseDate(a.completedAt||a.createdAt)).slice(0,1).forEach(p => activities.push(formatActivity("publish", project, `${p.fileName || p.profileName || "Publication"} · ${p.status || "Published"}`, p.completedAt || p.createdAt)));

  return {
    id: project.id, name: project.name, language: project.language, workflow: project.workflow, status: project.status,
    projectPath, documentCount: docs.length, converted, failed, running, pending, completedJobs,
    indexedDocuments: indexedDocs.length, pages, totalWords, lowWords, corrected, verified, unreviewed,
    averageConfidence: Number(avgConfidence.toFixed(1)), published, pendingPublish, activeAssignments, openComments,
    storageBytes: folderSize(projectPath), latestActivity: latest ? new Date(latest).toISOString() : project.createdAt,
    healthScore: Math.max(0, Math.min(100, Math.round((avgConfidence || 70) * 0.55 + pct(converted, docs.length) * 0.25 + pct(corrected + verified, corrected + verified + unreviewed) * 0.2))),
    activities,
  };
}

function buildDashboard(workspacePath, projects) {
  const scoped = projects.filter(p => (!workspacePath || p.workspacePath === workspacePath) && p.projectPath && fs.existsSync(p.projectPath));
  const projectStats = scoped.map(inspectProject);
  const sum = key => projectStats.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  const duplicateRegistry = workspacePath ? safeReadJson(path.join(workspacePath, ".ocr-studio", "duplicate-registry.json"), null) : null;
  const collections = workspacePath ? safeReadJson(path.join(workspacePath, ".ocr-studio", "collections.json"), { collections: [] }) : { collections: [] };
  const totalWords = sum("totalWords"), reviewedWords = sum("corrected") + sum("verified"), documents = sum("documentCount"), converted = sum("converted");
  const averageConfidence = projectStats.length ? projectStats.reduce((s,p)=>s+p.averageConfidence,0)/projectStats.length : 0;
  const health = projectStats.length ? Math.round(projectStats.reduce((s,p)=>s+p.healthScore,0)/projectStats.length) : 0;
  const activities = projectStats.flatMap(p => p.activities).filter(a => a.timestamp).sort((a,b)=>parseDate(b.timestamp)-parseDate(a.timestamp)).slice(0,12);
  const riskProjects = projectStats.filter(p => p.failed || p.averageConfidence < 60 || p.openComments > 0).sort((a,b)=>a.healthScore-b.healthScore).slice(0,6);
  const languageMap = {};
  for (const p of projectStats) languageMap[p.language || "Unknown"] = (languageMap[p.language || "Unknown"] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(), workspacePath,
    summary: {
      healthScore: health, projects: projectStats.length, collections: Array.isArray(collections.collections) ? collections.collections.length : 0,
      documents, converted, conversionRate: pct(converted, documents), runningJobs: sum("running"), pendingJobs: sum("pending"), failedDocuments: sum("failed"),
      indexedDocuments: sum("indexedDocuments"), indexedPages: sum("pages"), totalWords, lowConfidenceWords: sum("lowWords"), averageConfidence: Number(averageConfidence.toFixed(1)),
      reviewedWords, reviewProgress: pct(reviewedWords, totalWords), correctedWords: sum("corrected"), publishedItems: sum("published"), pendingPublications: sum("pendingPublish"),
      activeAssignments: sum("activeAssignments"), openComments: sum("openComments"), duplicateMatches: Number(duplicateRegistry?.summary?.matchCount) || 0,
      exactDuplicates: Number(duplicateRegistry?.summary?.exactCount) || 0, storageBytes: projectStats.reduce((s,p)=>s+p.storageBytes,0),
    },
    projects: projectStats.sort((a,b)=>parseDate(b.latestActivity)-parseDate(a.latestActivity)), activities, riskProjects,
    languages: Object.entries(languageMap).map(([language,count])=>({ language, count })).sort((a,b)=>b.count-a.count),
    throughput: Array.from({length: 7}, (_, index) => {
      const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() - (6-index));
      const next = new Date(day); next.setDate(next.getDate()+1);
      return { date: day.toISOString(), completed: projectStats.flatMap(p=>p.activities).filter(a=>a.type==="ocr" && parseDate(a.timestamp)>=day.getTime() && parseDate(a.timestamp)<next.getTime() && /completed/i.test(a.detail)).length };
    }),
  };
}

export function registerWorkspaceIntelligenceIpc(ipcMain, readRecentProjects) {
  ipcMain.handle("intelligence:getDashboard", async (_event, data) => {
    try { return { success: true, dashboard: buildDashboard(String(data?.workspacePath || ""), readRecentProjects()) }; }
    catch (error) { return { success: false, message: error instanceof Error ? error.message : "Could not build workspace dashboard.", dashboard: null }; }
  });
  ipcMain.handle("intelligence:exportSnapshot", async (_event, data) => {
    try {
      const workspacePath = String(data?.workspacePath || "");
      const dashboard = buildDashboard(workspacePath, readRecentProjects());
      if (!workspacePath) return { success: false, message: "Workspace path is required.", filePath: null };
      const dir = path.join(workspacePath, ".ocr-studio", "intelligence-snapshots"); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `workspace-intelligence-${new Date().toISOString().replace(/[:.]/g,"-")}.json`);
      fs.writeFileSync(file, JSON.stringify(dashboard, null, 2), "utf-8");
      return { success: true, message: "Workspace intelligence snapshot exported.", filePath: file };
    } catch (error) { return { success: false, message: error instanceof Error ? error.message : "Export failed.", filePath: null }; }
  });
}
