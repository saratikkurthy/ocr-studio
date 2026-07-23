import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const graphDir = (projectPath) => path.join(projectPath, ".ocr-studio", "knowledge-graph");
const graphFile = (projectPath) => path.join(graphDir(projectPath), "graph.json");
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } };
const emptyGraph = () => ({ version: 2, entities: [], relationships: [], reviewQueue: [], extractionJobs: [], aiExtractions: [], graphLayout: {}, updatedAt: null });
function readGraph(projectPath) { const value = readJson(graphFile(projectPath), emptyGraph()); return { ...emptyGraph(), ...value, entities: value.entities || [], relationships: value.relationships || [], reviewQueue: value.reviewQueue || [], extractionJobs: value.extractionJobs || [], aiExtractions: value.aiExtractions || [], graphLayout: value.graphLayout || {} }; }
function saveGraph(projectPath, graph) { fs.mkdirSync(graphDir(projectPath), { recursive: true }); graph.version = 2; graph.updatedAt = now(); fs.writeFileSync(graphFile(projectPath), JSON.stringify(graph, null, 2), "utf8"); return graph; }
function normalize(value) { return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim(); }
function key(value) { return normalize(value).toLocaleLowerCase(); }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function pageFiles(projectPath) {
  const root = path.join(projectPath, "ocr-word-index"); const output = [];
  if (!fs.existsSync(root)) return output;
  for (const document of fs.readdirSync(root, { withFileTypes: true })) {
    if (!document.isDirectory()) continue;
    for (const name of fs.readdirSync(path.join(root, document.name)).filter((item) => /^page-\d+\.json$/i.test(item))) {
      const data = readJson(path.join(root, document.name, name), null); if (!data) continue;
      const words = (data.words || []).map((word) => normalize(word.correctedText || word.corrected || word.text || word.word)).filter(Boolean);
      output.push({ documentId: Number(document.name), documentName: data.sourceFile || data.fileName || `Document ${document.name}`, pageNumber: Number(data.pageNumber) || Number((name.match(/\d+/) || [1])[0]), words, text: words.join(" ") });
    }
  }
  return output;
}
function guessType(name) {
  if (/पुर|नगर|ग्राम|वन|पर्वत|क्षेत्र|देश|नदी|city|river|mount|forest/i.test(name)) return "Place";
  if (/धर्म|योग|भक्ति|कर्म|ज्ञान|मोक्ष|moksha|dharma|yoga|devotion|wisdom/i.test(name)) return "Concept";
  if (/युद्ध|विवाह|सभा|यज्ञ|war|battle|ceremony|journey/i.test(name)) return "Event";
  return "Person / Character";
}
function extractCandidates(page) {
  const counts = new Map();
  for (const token of page.words) {
    if (token.length < 3 || /^\d+$/.test(token)) continue;
    const candidate = /^[A-Z][\p{L}'’-]+$/u.test(token) || /[\u0900-\u097F\u0C00-\u0C7F]/u.test(token);
    if (!candidate) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
}
function mergeEntity(graph, name, type, evidence, source = "Automatic", confidence = null) {
  const cleanName = normalize(name); if (!cleanName) return null;
  let entity = graph.entities.find((item) => key(item.name) === key(cleanName) || (item.aliases || []).some((alias) => key(alias) === key(cleanName)));
  if (!entity) {
    entity = { id: uid("ent"), name: cleanName, type: type || guessType(cleanName), aliases: [], description: "", status: source === "Manual" ? "Verified" : "Suggested", confidence: confidence == null ? (source === "Manual" ? 1 : 0.72) : clamp(confidence), evidence: [], source, createdAt: now(), updatedAt: now() };
    graph.entities.push(entity);
    if (entity.status === "Suggested") graph.reviewQueue.push({ id: uid("review"), kind: "Entity", targetId: entity.id, status: "Pending", createdAt: now() });
  } else if (type && entity.type === "Person / Character" && type !== entity.type) {
    entity.type = type;
  }
  if (evidence && !entity.evidence.some((item) => item.documentId === evidence.documentId && item.pageNumber === evidence.pageNumber && key(item.excerpt) === key(evidence.excerpt))) entity.evidence.push(evidence);
  entity.confidence = Math.max(entity.confidence || 0, confidence == null ? 0 : clamp(confidence));
  entity.updatedAt = now(); return entity;
}
function addSuggestedRelationship(graph, source, target, type, evidence, confidence = 0.7, method = "Rule") {
  if (!source || !target || source.id === target.id) return null;
  const relationType = normalize(type) || "Related to";
  const duplicate = graph.relationships.find((item) => item.sourceId === source.id && item.targetId === target.id && key(item.type) === key(relationType) && item.evidence?.documentId === evidence?.documentId && item.evidence?.pageNumber === evidence?.pageNumber);
  if (duplicate) return null;
  const relationship = { id: uid("rel"), sourceId: source.id, targetId: target.id, type: relationType, status: "Suggested", confidence: clamp(confidence), extractionMethod: method, evidence, createdAt: now(), updatedAt: now() };
  graph.relationships.push(relationship);
  graph.reviewQueue.push({ id: uid("review"), kind: "Relationship", targetId: relationship.id, status: "Pending", createdAt: now() });
  return relationship;
}
function ruleRelationships(page, graph) {
  const patterns = [
    { regex: /([\p{L}'’-]{3,})\s+(?:is|was)\s+(?:the\s+)?son\s+of\s+([\p{L}'’-]{3,})/giu, type: "Son of" },
    { regex: /([\p{L}'’-]{3,})\s+(?:is|was)\s+(?:the\s+)?daughter\s+of\s+([\p{L}'’-]{3,})/giu, type: "Daughter of" },
    { regex: /([\p{L}'’-]{3,})\s+(?:is|was)\s+(?:a\s+)?(?:close\s+)?friend\s+of\s+([\p{L}'’-]{3,})/giu, type: "Friend of" },
    { regex: /([\p{L}'’-]{3,})\s+(?:is|was)\s+(?:the\s+)?teacher\s+of\s+([\p{L}'’-]{3,})/giu, type: "Teacher of" },
    { regex: /([\p{L}'’-]{3,})\s+(?:fought|defeated|met|visited|protected)\s+([\p{L}'’-]{3,})/giu, type: "Interacts with" },
  ];
  const evidence = { documentId: page.documentId, documentName: page.documentName, pageNumber: page.pageNumber, excerpt: page.text.slice(0, 500) };
  const added = [];
  for (const pattern of patterns) {
    for (const match of page.text.matchAll(pattern.regex)) {
      const source = mergeEntity(graph, match[1], guessType(match[1]), evidence, "Rule", 0.82);
      const target = mergeEntity(graph, match[2], guessType(match[2]), evidence, "Rule", 0.82);
      const relationship = addSuggestedRelationship(graph, source, target, pattern.type, evidence, 0.82, "Rule pattern");
      if (relationship) added.push(relationship);
    }
  }
  return added;
}
function parseJsonResponse(text) {
  const clean = String(text || "").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) { try { return JSON.parse(clean.slice(start, end + 1)); } catch {} }
  return null;
}
async function askOllama({ endpoint, model, text, knownEntities }) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120000);
  const prompt = `You extract scholarly knowledge graph facts from reviewed OCR text. Return JSON only in this exact shape:\n{"entities":[{"name":"","type":"Person / Character|Place|Concept|Event|Text","aliases":[],"confidence":0.0}],"relationships":[{"source":"","target":"","type":"","confidence":0.0,"evidenceQuote":""}]}\nRules: use only facts explicitly supported by the passage; do not invent; keep names in the source language; confidence 0-1; maximum 12 entities and 12 relationships. Known entities: ${knownEntities.slice(0, 80).join(", ") || "none"}.\nPASSAGE:\n${text.slice(0, 5500)}`;
  try {
    const response = await fetch(`${String(endpoint || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model || "llama3.2:3b", stream: false, keep_alive: "10m", options: { temperature: 0.1, num_ctx: 4096, num_predict: 1000 }, messages: [{ role: "user", content: prompt }] }), signal: controller.signal });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const payload = await response.json(); const parsed = parseJsonResponse(payload?.message?.content);
    if (!parsed) throw new Error("Ollama did not return valid relationship JSON.");
    return parsed;
  } finally { clearTimeout(timer); }
}
function analytics(graph) {
  const verifiedRelationships = graph.relationships.filter((item) => item.status !== "Rejected");
  const degrees = new Map();
  for (const relationship of verifiedRelationships) { degrees.set(relationship.sourceId, (degrees.get(relationship.sourceId) || 0) + 1); degrees.set(relationship.targetId, (degrees.get(relationship.targetId) || 0) + 1); }
  const connected = [...degrees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, count]) => ({ entity: graph.entities.find((item) => item.id === id), count }));
  const byType = Object.entries(graph.entities.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
  const relationTypes = Object.entries(verifiedRelationships.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
  return { connected, byType, relationTypes, isolated: graph.entities.filter((item) => !degrees.has(item.id)).length, verified: verifiedRelationships.filter((item) => item.status === "Verified").length, suggested: verifiedRelationships.filter((item) => item.status === "Suggested").length };
}

export function registerKnowledgeGraphIpc(ipcMain, dialog, shell, readRecentProjects) {
  ipcMain.handle("knowledgeGraph:getWorkspace", async () => {
    const projects = (await readRecentProjects()) || [];
    const summaries = projects.map((project) => { const graph = readGraph(project.projectPath); return { projectId: project.id, projectName: project.name, projectPath: project.projectPath, entities: graph.entities.length, relationships: graph.relationships.length, pending: graph.reviewQueue.filter((item) => item.status === "Pending").length, updatedAt: graph.updatedAt }; });
    return { success: true, projects: summaries, totals: summaries.reduce((total, project) => ({ entities: total.entities + project.entities, relationships: total.relationships + project.relationships, pending: total.pending + project.pending }), { entities: 0, relationships: 0, pending: 0 }) };
  });
  ipcMain.handle("knowledgeGraph:getProject", async (_, { projectPath }) => { const graph = readGraph(projectPath); return { success: true, graph, analytics: analytics(graph) }; });
  ipcMain.handle("knowledgeGraph:extract", async (_, { projectPath }) => {
    const graph = readGraph(projectPath); const pages = pageFiles(projectPath); const job = { id: uid("job"), kind: "Foundation", startedAt: now(), pages: pages.length, status: "Running" }; graph.extractionJobs.unshift(job);
    let addedEntities = 0; let addedRelationships = 0;
    for (const page of pages) {
      const evidenceBase = { documentId: page.documentId, documentName: page.documentName, pageNumber: page.pageNumber, excerpt: page.text.slice(0, 280) };
      const entities = extractCandidates(page).map(([name, count]) => { const before = graph.entities.length; const entity = mergeEntity(graph, name, guessType(name), { ...evidenceBase, count }); if (graph.entities.length > before) addedEntities += 1; return entity; }).filter(Boolean).slice(0, 12);
      addedRelationships += ruleRelationships(page, graph).length;
      for (let index = 0; index < entities.length; index += 1) for (let targetIndex = index + 1; targetIndex < Math.min(entities.length, index + 4); targetIndex += 1) if (addSuggestedRelationship(graph, entities[index], entities[targetIndex], "Co-occurs with", evidenceBase, 0.62, "Co-occurrence")) addedRelationships += 1;
    }
    job.status = "Completed"; job.completedAt = now(); job.addedEntities = addedEntities; job.addedRelationships = addedRelationships; saveGraph(projectPath, graph);
    return { success: true, message: `Extracted ${addedEntities} entities and ${addedRelationships} relationships from ${pages.length} pages.`, graph, analytics: analytics(graph) };
  });
  ipcMain.handle("knowledgeGraph:discoverAi", async (_, data) => {
    const graph = readGraph(data.projectPath); const pages = pageFiles(data.projectPath).filter((page) => !data.documentId || page.documentId === Number(data.documentId)).slice(0, Math.max(1, Math.min(Number(data.pageLimit) || 12, 40)));
    const job = { id: uid("job"), kind: "AI Relationship Discovery", model: data.model || "llama3.2:3b", startedAt: now(), pages: pages.length, status: "Running", errors: [] }; graph.extractionJobs.unshift(job);
    let addedEntities = 0; let addedRelationships = 0;
    for (const page of pages) {
      if (!page.text.trim()) continue;
      try {
        const result = await askOllama({ endpoint: data.endpoint, model: data.model, text: page.text, knownEntities: graph.entities.map((item) => item.name) });
        const evidenceBase = { documentId: page.documentId, documentName: page.documentName, pageNumber: page.pageNumber, excerpt: page.text.slice(0, 500) };
        const entityMap = new Map();
        for (const candidate of (result.entities || []).slice(0, 12)) {
          const before = graph.entities.length; const entity = mergeEntity(graph, candidate.name, candidate.type || guessType(candidate.name), evidenceBase, "Local AI", candidate.confidence);
          if (!entity) continue; if (graph.entities.length > before) addedEntities += 1;
          entity.aliases = [...new Set([...(entity.aliases || []), ...((candidate.aliases || []).map(normalize).filter(Boolean))])]; entityMap.set(key(candidate.name), entity);
        }
        for (const candidate of (result.relationships || []).slice(0, 12)) {
          const source = entityMap.get(key(candidate.source)) || mergeEntity(graph, candidate.source, guessType(candidate.source), evidenceBase, "Local AI", candidate.confidence);
          const target = entityMap.get(key(candidate.target)) || mergeEntity(graph, candidate.target, guessType(candidate.target), evidenceBase, "Local AI", candidate.confidence);
          const evidence = { ...evidenceBase, quote: normalize(candidate.evidenceQuote) };
          if (addSuggestedRelationship(graph, source, target, candidate.type, evidence, candidate.confidence || 0.75, `Ollama · ${data.model || "llama3.2:3b"}`)) addedRelationships += 1;
        }
        graph.aiExtractions.unshift({ id: uid("ai"), jobId: job.id, documentId: page.documentId, pageNumber: page.pageNumber, model: data.model || "llama3.2:3b", createdAt: now(), result });
      } catch (error) { job.errors.push({ documentId: page.documentId, pageNumber: page.pageNumber, message: error instanceof Error ? error.message : String(error) }); }
    }
    job.status = job.errors.length === pages.length && pages.length ? "Failed" : "Completed"; job.completedAt = now(); job.addedEntities = addedEntities; job.addedRelationships = addedRelationships; saveGraph(data.projectPath, graph);
    const errorNote = job.errors.length ? ` ${job.errors.length} page(s) could not be analyzed.` : "";
    return { success: job.status !== "Failed", message: `AI discovered ${addedEntities} new entities and ${addedRelationships} relationship suggestions from ${pages.length} page(s).${errorNote}`, graph, analytics: analytics(graph), errors: job.errors };
  });
  ipcMain.handle("knowledgeGraph:getAnalytics", async (_, { projectPath }) => ({ success: true, analytics: analytics(readGraph(projectPath)) }));
  ipcMain.handle("knowledgeGraph:addEntity", async (_, data) => { const graph = readGraph(data.projectPath); const entity = mergeEntity(graph, normalize(data.name), data.type || "Concept", null, "Manual"); entity.description = normalize(data.description); saveGraph(data.projectPath, graph); return { success: true, message: "Entity saved.", graph, analytics: analytics(graph) }; });
  ipcMain.handle("knowledgeGraph:addRelationship", async (_, data) => { const graph = readGraph(data.projectPath); const relationship = { id: uid("rel"), sourceId: data.sourceId, targetId: data.targetId, type: normalize(data.type) || "Related to", status: "Verified", confidence: 1, extractionMethod: "Manual", evidence: data.evidence || null, createdAt: now(), updatedAt: now() }; graph.relationships.push(relationship); saveGraph(data.projectPath, graph); return { success: true, message: "Relationship saved.", graph, analytics: analytics(graph) }; });
  ipcMain.handle("knowledgeGraph:review", async (_, data) => { const graph = readGraph(data.projectPath); const queueItem = graph.reviewQueue.find((item) => item.id === data.reviewId); if (!queueItem) return { success: false, message: "Review item not found." }; queueItem.status = data.decision; queueItem.reviewedAt = now(); queueItem.reviewerNote = normalize(data.note); const collection = queueItem.kind === "Entity" ? graph.entities : graph.relationships; const target = collection.find((item) => item.id === queueItem.targetId); if (target) { target.status = data.decision === "Approved" ? "Verified" : "Rejected"; target.reviewedAt = now(); target.reviewerNote = normalize(data.note); } saveGraph(data.projectPath, graph); return { success: true, message: `${queueItem.kind} ${data.decision.toLowerCase()}.`, graph, analytics: analytics(graph) }; });
  ipcMain.handle("knowledgeGraph:merge", async (_, data) => { const graph = readGraph(data.projectPath); const primary = graph.entities.find((item) => item.id === data.primaryId); const duplicate = graph.entities.find((item) => item.id === data.duplicateId); if (!primary || !duplicate) return { success: false, message: "Entities not found." }; primary.aliases = [...new Set([...(primary.aliases || []), duplicate.name, ...(duplicate.aliases || [])])]; primary.evidence = [...(primary.evidence || []), ...(duplicate.evidence || [])]; for (const relationship of graph.relationships) { if (relationship.sourceId === duplicate.id) relationship.sourceId = primary.id; if (relationship.targetId === duplicate.id) relationship.targetId = primary.id; } graph.entities = graph.entities.filter((item) => item.id !== duplicate.id); graph.reviewQueue = graph.reviewQueue.filter((item) => item.targetId !== duplicate.id); saveGraph(data.projectPath, graph); return { success: true, message: "Entities merged and aliases preserved.", graph, analytics: analytics(graph) }; });
  ipcMain.handle("knowledgeGraph:export", async (_, { projectPath }) => { const result = await dialog.showSaveDialog({ title: "Export Knowledge Graph", defaultPath: "knowledge-graph.json", filters: [{ name: "JSON", extensions: ["json"] }] }); if (result.canceled || !result.filePath) return { success: false, message: "Export cancelled." }; fs.writeFileSync(result.filePath, JSON.stringify(readGraph(projectPath), null, 2)); return { success: true, message: "Knowledge graph exported.", filePath: result.filePath }; });
  ipcMain.handle("knowledgeGraph:openFile", async (_, filePath) => shell.openPath(filePath));
}
