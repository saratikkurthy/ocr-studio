import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
const graphFile = (projectPath) => path.join(projectPath, ".ocr-studio", "knowledge-graph", "graph.json");
const workspaceRoot = (projects) => projects.find((p) => p.workspacePath)?.workspacePath || (projects[0]?.projectPath ? path.dirname(projects[0].projectPath) : null);
const storeDir = (workspacePath) => path.join(workspacePath, ".ocr-studio", "cross-project-graph");
const storeFile = (workspacePath) => path.join(storeDir(workspacePath), "workspace-graph.json");
const emptyStore = () => ({ version: 1, canonicalEntities: [], projectLinks: [], comparisons: [], variants: [], notes: [], updatedAt: null });
function readStore(workspacePath) { const value = readJson(storeFile(workspacePath), emptyStore()); return { ...emptyStore(), ...value, canonicalEntities: value.canonicalEntities || [], projectLinks: value.projectLinks || [], comparisons: value.comparisons || [], variants: value.variants || [], notes: value.notes || [] }; }
function saveStore(workspacePath, store) { fs.mkdirSync(storeDir(workspacePath), { recursive: true }); store.updatedAt = now(); fs.writeFileSync(storeFile(workspacePath), JSON.stringify(store, null, 2), "utf8"); return store; }
function projectGraph(project) { const graph = readJson(graphFile(project.projectPath), { entities: [], relationships: [] }); return { project, entities: graph.entities || [], relationships: graph.relationships || [] }; }
function names(entity) { return [entity.name, ...(entity.aliases || [])].filter(Boolean); }
function scoreEntity(a, b) {
  const aNames = names(a).map(normalize); const bNames = names(b).map(normalize);
  if (aNames.some((x) => bNames.includes(x))) return 1;
  const tokens = (x) => new Set(x.split(" ").filter(Boolean));
  let best = 0;
  for (const left of aNames) for (const right of bNames) {
    const A = tokens(left), B = tokens(right); const intersection = [...A].filter((x) => B.has(x)).length; const union = new Set([...A, ...B]).size || 1;
    best = Math.max(best, intersection / union);
  }
  return best;
}
function ensureCanonical(store, entity, project) {
  const linked = store.projectLinks.find((l) => l.projectPath === project.projectPath && l.entityId === entity.id && l.status !== "Rejected");
  if (linked) return store.canonicalEntities.find((c) => c.id === linked.canonicalId) || null;
  let match = null; let best = 0;
  for (const canonical of store.canonicalEntities) {
    const score = scoreEntity(entity, canonical);
    if (score > best) { best = score; match = canonical; }
  }
  if (!match || best < 0.84) {
    match = { id: uid("canonical"), name: entity.name, type: entity.type || "Unknown", aliases: [...new Set(entity.aliases || [])], description: entity.description || "", createdAt: now(), updatedAt: now() };
    store.canonicalEntities.push(match);
    best = 1;
  } else {
    match.aliases = [...new Set([...(match.aliases || []), entity.name, ...(entity.aliases || [])].filter((x) => normalize(x) !== normalize(match.name)))];
    match.updatedAt = now();
  }
  store.projectLinks.push({ id: uid("link"), projectId: project.id, projectName: project.name, projectPath: project.projectPath, entityId: entity.id, entityName: entity.name, canonicalId: match.id, score: best, status: best === 1 ? "Confirmed" : "Suggested", createdAt: now() });
  return match;
}
function buildComparison(projects, store) {
  const loaded = projects.map(projectGraph);
  for (const item of loaded) for (const entity of item.entities.filter((e) => e.status !== "Rejected")) ensureCanonical(store, entity, item.project);
  const canonicalByProjectEntity = new Map(store.projectLinks.filter((l) => l.status !== "Rejected").map((l) => [`${l.projectPath}::${l.entityId}`, l.canonicalId]));
  const relationshipGroups = new Map();
  for (const item of loaded) for (const rel of item.relationships.filter((r) => r.status !== "Rejected")) {
    const sourceCanonicalId = canonicalByProjectEntity.get(`${item.project.projectPath}::${rel.sourceId}`);
    const targetCanonicalId = canonicalByProjectEntity.get(`${item.project.projectPath}::${rel.targetId}`);
    if (!sourceCanonicalId || !targetCanonicalId) continue;
    const pair = [sourceCanonicalId, targetCanonicalId].sort().join("::");
    if (!relationshipGroups.has(pair)) relationshipGroups.set(pair, []);
    relationshipGroups.get(pair).push({ ...rel, projectId: item.project.id, projectName: item.project.name, projectPath: item.project.projectPath, sourceCanonicalId, targetCanonicalId });
  }
  const variants = [];
  for (const [pair, rels] of relationshipGroups) {
    const types = [...new Set(rels.map((r) => normalize(r.type)))];
    if (types.length > 1) variants.push({ id: uid("variant"), kind: "Relationship conflict", pair, status: "Pending", severity: "High", summary: `Different relationship types: ${[...new Set(rels.map((r) => r.type))].join(" vs ")}`, evidence: rels, createdAt: now() });
  }
  const projectSets = loaded.map((item) => ({ project: item.project, canonicalIds: new Set(item.entities.map((e) => canonicalByProjectEntity.get(`${item.project.projectPath}::${e.id}`)).filter(Boolean)) }));
  const allCanonicalIds = new Set(projectSets.flatMap((x) => [...x.canonicalIds]));
  for (const canonicalId of allCanonicalIds) {
    const present = projectSets.filter((x) => x.canonicalIds.has(canonicalId));
    if (present.length === 1 && projectSets.length > 1) {
      const canonical = store.canonicalEntities.find((c) => c.id === canonicalId);
      variants.push({ id: uid("variant"), kind: "Unique entity", canonicalId, status: "Pending", severity: "Info", summary: `${canonical?.name || "Entity"} appears only in ${present[0].project.name}`, evidence: present.map((x) => ({ projectName: x.project.name, projectPath: x.project.projectPath })), createdAt: now() });
    }
  }
  const comparison = { id: uid("comparison"), projectIds: projects.map((p) => p.id), projectNames: projects.map((p) => p.name), projectPaths: projects.map((p) => p.projectPath), createdAt: now(), summary: { projects: projects.length, canonicalEntities: allCanonicalIds.size, relationshipGroups: relationshipGroups.size, variants: variants.length }, relationshipGroups: [...relationshipGroups.entries()].map(([pair, evidence]) => ({ pair, evidence })) };
  store.variants = [...store.variants.filter((v) => v.status !== "Pending"), ...variants];
  store.comparisons.unshift(comparison); store.comparisons = store.comparisons.slice(0, 20);
  return comparison;
}
function workspacePayload(projects, store) {
  const linkedCounts = store.projectLinks.reduce((acc, l) => { acc[l.canonicalId] = (acc[l.canonicalId] || 0) + 1; return acc; }, {});
  return { projects: projects.map((p) => ({ id: p.id, name: p.name, projectPath: p.projectPath, language: p.language, graphExists: fs.existsSync(graphFile(p.projectPath)) })), store, analytics: { canonicalEntities: store.canonicalEntities.length, links: store.projectLinks.length, sharedEntities: Object.values(linkedCounts).filter((n) => n > 1).length, pendingVariants: store.variants.filter((v) => v.status === "Pending").length, comparisons: store.comparisons.length } };
}

export function registerCrossProjectGraphIpc({ ipcMain, dialog, shell, getProjects }) {
  ipcMain.handle("crossGraph:getWorkspace", async () => {
    const projects = (getProjects() || []).filter((p) => p.projectPath && fs.existsSync(p.projectPath)); const root = workspaceRoot(projects);
    if (!root) return { success: false, message: "No OCR Studio workspace projects found.", projects: [], store: emptyStore() };
    return { success: true, workspacePath: root, ...workspacePayload(projects, readStore(root)) };
  });
  ipcMain.handle("crossGraph:compare", async (_, data) => {
    const all = (getProjects() || []).filter((p) => p.projectPath && fs.existsSync(p.projectPath)); const selected = all.filter((p) => (data.projectIds || []).includes(p.id));
    if (selected.length < 2) return { success: false, message: "Select at least two projects." };
    const root = workspaceRoot(selected); const store = readStore(root); const comparison = buildComparison(selected, store); saveStore(root, store);
    return { success: true, message: `Compared ${selected.length} projects.`, comparison, workspacePath: root, ...workspacePayload(all, store) };
  });
  ipcMain.handle("crossGraph:decideLink", async (_, data) => {
    const all = getProjects() || []; const root = workspaceRoot(all); const store = readStore(root); const link = store.projectLinks.find((l) => l.id === data.linkId);
    if (!link) return { success: false, message: "Entity link not found." };
    link.status = data.decision; link.reviewedAt = now(); link.note = String(data.note || "").trim();
    saveStore(root, store); return { success: true, message: `Entity match ${String(data.decision).toLowerCase()}.`, ...workspacePayload(all, store) };
  });
  ipcMain.handle("crossGraph:reviewVariant", async (_, data) => {
    const all = getProjects() || []; const root = workspaceRoot(all); const store = readStore(root); const item = store.variants.find((v) => v.id === data.variantId);
    if (!item) return { success: false, message: "Variant not found." };
    item.status = data.decision; item.note = String(data.note || "").trim(); item.reviewedAt = now(); saveStore(root, store);
    return { success: true, message: "Comparison issue updated.", ...workspacePayload(all, store) };
  });
  ipcMain.handle("crossGraph:addNote", async (_, data) => {
    const all = getProjects() || []; const root = workspaceRoot(all); const store = readStore(root);
    store.notes.unshift({ id: uid("note"), title: String(data.title || "Comparison note").trim(), body: String(data.body || "").trim(), comparisonId: data.comparisonId || null, createdAt: now() }); saveStore(root, store);
    return { success: true, message: "Comparison note saved.", ...workspacePayload(all, store) };
  });
  ipcMain.handle("crossGraph:export", async (_, data) => {
    const all = getProjects() || []; const root = workspaceRoot(all); const store = readStore(root); const format = data.format || "json";
    const result = await dialog.showSaveDialog({ title: "Export Cross-Project Comparison", defaultPath: `cross-project-comparison.${format === "html" ? "html" : "json"}`, filters: [{ name: format === "html" ? "HTML" : "JSON", extensions: [format === "html" ? "html" : "json"] }] });
    if (result.canceled || !result.filePath) return { success: false, message: "Export cancelled." };
    if (format === "html") {
      const rows = store.variants.map((v) => `<tr><td>${v.kind}</td><td>${v.summary}</td><td>${v.status}</td><td>${v.note || ""}</td></tr>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cross-Project Comparison</title><style>body{font-family:Arial;padding:32px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4ead8}</style></head><body><h1>OCR Studio Cross-Project Comparison</h1><p>Generated ${now()}</p><h2>Canonical entities: ${store.canonicalEntities.length}</h2><table><thead><tr><th>Kind</th><th>Summary</th><th>Status</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      fs.writeFileSync(result.filePath, html, "utf8");
    } else fs.writeFileSync(result.filePath, JSON.stringify(store, null, 2), "utf8");
    return { success: true, message: "Comparison report exported.", filePath: result.filePath };
  });
  ipcMain.handle("crossGraph:openFile", async (_, filePath) => shell.openPath(filePath));
}
