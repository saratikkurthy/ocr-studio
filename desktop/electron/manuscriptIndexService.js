import fs from "fs";
import path from "path";

const INDEX_VERSION = 2;
const DEFAULT_CHUNK_WORDS = 120;
const DEFAULT_OVERLAP = 25;

function safeReadJson(filePath, fallback) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : fallback; }
  catch { return fallback; }
}
function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function normalizeText(value) { return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim(); }
function tokenize(value) { return normalizeText(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []; }
function getStudioDir(workspacePath) { return path.join(workspacePath, ".ocr-studio"); }
function getIndexPath(workspacePath) { return path.join(getStudioDir(workspacePath), "manuscript-index.json"); }
function getDiagnosticsPath(workspacePath) { return path.join(getStudioDir(workspacePath), "manuscript-index-diagnostics.json"); }
function getCollectionAssignments(workspacePath) {
  return safeReadJson(path.join(getStudioDir(workspacePath), "collection-assignments.json"), { assignments: {} });
}
function pathKey(value) {
  try { return path.resolve(String(value || "")).replace(/[\\/]+$/, "").toLocaleLowerCase(); }
  catch { return String(value || "").toLocaleLowerCase(); }
}
function isInsideWorkspace(projectPath, workspacePath) {
  const project = pathKey(projectPath); const workspace = pathKey(workspacePath);
  return project === workspace || project.startsWith(`${workspace}${path.sep.toLocaleLowerCase()}`);
}
function discoverProjects(workspacePath, recentProjects) {
  const found = new Map();
  for (const project of Array.isArray(recentProjects) ? recentProjects : []) {
    if (!project?.projectPath || !fs.existsSync(project.projectPath)) continue;
    if (!isInsideWorkspace(project.projectPath, workspacePath) && pathKey(project.workspacePath) !== pathKey(workspacePath)) continue;
    found.set(pathKey(project.projectPath), project);
  }
  if (fs.existsSync(workspacePath)) {
    for (const entry of fs.readdirSync(workspacePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === ".ocr-studio") continue;
      const projectPath = path.join(workspacePath, entry.name);
      const projectFile = path.join(projectPath, "project.json");
      if (!fs.existsSync(projectFile)) continue;
      const parsed = safeReadJson(projectFile, {});
      found.set(pathKey(projectPath), {
        id: Number(parsed.id) || Math.abs(hashString(projectPath)),
        name: parsed.name || entry.name,
        language: parsed.language || "unknown",
        workspacePath,
        projectPath,
        ...parsed,
      });
    }
  }
  return [...found.values()];
}
function hashString(value) { let h = 0; for (const c of String(value)) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return h; }
function makeChunks(words, chunkWords, overlap) {
  if (!words.length) return [];
  const chunks = []; const stride = Math.max(1, chunkWords - overlap);
  for (let start = 0; start < words.length; start += stride) {
    const slice = words.slice(start, start + chunkWords); if (!slice.length) break;
    chunks.push({ start, words: slice }); if (start + chunkWords >= words.length) break;
  }
  return chunks;
}
function wordObjectsFromPage(page) {
  const raw = Array.isArray(page?.words) ? page.words : [];
  return raw.map((word) => ({
    text: normalizeText(word?.correctedText || word?.corrected || word?.text || word?.word || ""),
    confidence: Number(word?.confidence ?? word?.conf ?? 0),
    status: word?.status || (word?.correctedText ? "Corrected" : "Unreviewed"),
  })).filter((word) => word.text);
}
function wordsFromPlainText(text) {
  return tokenize(text).map((token) => ({ text: token, confidence: 0, status: "Imported" }));
}
function pageNumberFromName(name, fallback = 1) {
  const match = String(name).match(/(?:page[-_ ]?)?(\d{1,7})/i); return match ? Number(match[1]) : fallback;
}
function getDocuments(projectPath) {
  const docs = safeReadJson(path.join(projectPath, "documents.json"), []);
  return Array.isArray(docs) ? docs : [];
}
function addPageChunks(target, context, words, chunkWords, overlap) {
  for (const item of makeChunks(words, chunkWords, overlap)) {
    const text = item.words.map((word) => word.text).join(" ");
    const tokens = tokenize(text); if (!tokens.length) continue;
    const termFrequencies = {}; for (const token of tokens) termFrequencies[token] = (termFrequencies[token] || 0) + 1;
    const confidenceValues = item.words.map((word) => Number(word.confidence)).filter((n) => Number.isFinite(n) && n > 0);
    const averageConfidence = confidenceValues.length ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length : 0;
    target.push({
      id: `${context.projectId}:${context.documentId}:${context.pageNumber}:${item.start}`,
      ...context,
      text, tokenCount: tokens.length, termFrequencies,
      averageConfidence: Number(averageConfidence.toFixed(2)),
      correctedWords: item.words.filter((word) => word.status === "Corrected").length,
    });
  }
}
function collectWordIndex(project, collectionIds, chunkWords, overlap, warnings) {
  const root = path.join(project.projectPath, "ocr-word-index");
  const output = { chunks: [], pages: 0, words: 0, documents: new Set(), source: "ocr-word-index" };
  if (!fs.existsSync(root)) return output;
  const docs = getDocuments(project.projectPath); const docById = new Map(docs.map((d) => [Number(d.id), d]));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const documentId = Number(entry.name); if (!Number.isFinite(documentId)) continue;
    const folder = path.join(root, entry.name);
    const files = fs.readdirSync(folder).filter((name) => /^page-\d+\.json$/i.test(name)).sort();
    for (const file of files) {
      const filePath = path.join(folder, file); const page = safeReadJson(filePath, null);
      if (!page) { warnings.push({ project: project.name, file: filePath, reason: "Invalid page JSON" }); continue; }
      const words = wordObjectsFromPage(page); if (!words.length) { warnings.push({ project: project.name, file: filePath, reason: "No OCR words" }); continue; }
      const pageNumber = Number(page.pageNumber) || pageNumberFromName(file);
      const document = docById.get(documentId);
      addPageChunks(output.chunks, {
        projectId: Number(project.id), projectName: project.name, projectPath: project.projectPath,
        documentId, documentName: document?.fileName || page.sourceFile || page.fileName || `Document ${documentId}`,
        pageNumber, language: page.language || project.language || "unknown", collectionIds,
      }, words, chunkWords, overlap);
      output.pages++; output.words += words.length; output.documents.add(documentId);
    }
  }
  return output;
}
function collectTextFallback(project, collectionIds, chunkWords, overlap, warnings) {
  const output = { chunks: [], pages: 0, words: 0, documents: new Set(), source: "text-fallback" };
  const roots = ["OCR", "Processed", "Export"].map((name) => path.join(project.projectPath, name)).filter(fs.existsSync);
  let documentId = 100000;
  for (const root of roots) {
    const files = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.(txt|md)$/i.test(entry.name));
    for (const entry of files) {
      const filePath = path.join(root, entry.name); let text = "";
      try { text = fs.readFileSync(filePath, "utf-8"); } catch { warnings.push({ project: project.name, file: filePath, reason: "Unreadable text file" }); continue; }
      const words = wordsFromPlainText(text); if (!words.length) continue;
      documentId++;
      addPageChunks(output.chunks, {
        projectId: Number(project.id), projectName: project.name, projectPath: project.projectPath,
        documentId, documentName: entry.name, pageNumber: pageNumberFromName(entry.name),
        language: project.language || "unknown", collectionIds,
      }, words, chunkWords, overlap);
      output.pages++; output.words += words.length; output.documents.add(documentId);
    }
  }
  return output;
}
function buildDocumentFrequency(chunks) { const df = {}; for (const chunk of chunks) for (const term of Object.keys(chunk.termFrequencies)) df[term] = (df[term] || 0) + 1; return df; }
function bm25Score(chunk, queryTokens, df, total, averageLength) {
  const k1 = 1.4, b = .72; let score = 0;
  for (const term of queryTokens) { const tf = chunk.termFrequencies[term] || 0; if (!tf) continue; const freq = df[term] || 0; const idf = Math.log(1 + (total - freq + .5) / (freq + .5)); score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunk.tokenCount / Math.max(averageLength, 1))))); }
  return score;
}
function makeSnippet(text, queryTokens, maxLength = 420) {
  if (text.length <= maxLength) return text; const lower = text.toLocaleLowerCase();
  const positions = queryTokens.map((token) => lower.indexOf(token)).filter((pos) => pos >= 0); const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - Math.floor(maxLength / 3)); const end = Math.min(text.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
export function searchManuscriptPassages(data) {
  const workspacePath = String(data?.workspacePath || ""); const query = normalizeText(data?.query || "");
  const limit = Math.min(Math.max(Number(data?.limit) || 20, 1), 100); const collectionId = data?.collectionId ? String(data.collectionId) : null;
  if (!workspacePath || !query) return { success: false, message: "Workspace and question are required.", results: [] };
  const index = safeReadJson(getIndexPath(workspacePath), null);
  if (!index?.chunks?.length) return { success: false, message: "The manuscript index is missing or empty. Build the index first.", results: [] };
  const queryTokens = [...new Set(tokenize(query))]; const phrase = query.toLocaleLowerCase();
  const results = index.chunks.filter((chunk) => !collectionId || (chunk.collectionIds || []).includes(collectionId)).map((chunk) => {
    let score = bm25Score(chunk, queryTokens, index.documentFrequency || {}, index.chunks.length, index.metadata?.averageChunkLength || 1);
    const normalized = chunk.text.toLocaleLowerCase(); if (normalized.includes(phrase)) score += 6;
    const coverage = queryTokens.length ? queryTokens.filter((token) => chunk.termFrequencies[token]).length / queryTokens.length : 0; score += coverage * 2;
    return { ...chunk, score, coverage, snippet: makeSnippet(chunk.text, queryTokens) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((item, rank) => ({ ...item, rank: rank + 1, score: Number(item.score.toFixed(4)), coverage: Number((item.coverage * 100).toFixed(1)) }));
  return { success: true, message: results.length ? `Found ${results.length} relevant passages.` : "No relevant passages were found.", results, query, metadata: index.metadata };
}
export function registerManuscriptIndexIpc(ipcMain, shell, readRecentProjects) {
  ipcMain.handle("manuscriptIndex:getStatus", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || ""); const indexPath = getIndexPath(workspacePath); const index = workspacePath ? safeReadJson(indexPath, null) : null;
    return index?.chunks?.length ? { success: true, message: "Local manuscript index is ready.", metadata: index.metadata, indexPath }
      : { success: true, message: index ? "The manuscript index exists but contains no passages. Rebuild it." : "No manuscript index has been built yet.", metadata: index?.metadata || null, indexPath };
  });
  ipcMain.handle("manuscriptIndex:build", async (_event, data) => {
    const workspacePath = path.resolve(String(data?.workspacePath || ""));
    if (!workspacePath || !fs.existsSync(workspacePath)) return { success: false, message: "Select an existing workspace folder.", metadata: null };
    const chunkWords = Math.min(Math.max(Number(data?.chunkWords) || DEFAULT_CHUNK_WORDS, 40), 400);
    const overlap = Math.min(Math.max(Number(data?.overlap) || DEFAULT_OVERLAP, 0), chunkWords - 1);
    ensureDir(getStudioDir(workspacePath));
    const assignments = getCollectionAssignments(workspacePath).assignments || {};
    const projects = discoverProjects(workspacePath, readRecentProjects()); const warnings = []; const chunks = []; const projectReports = [];
    let pages = 0, words = 0, documents = 0;
    for (const project of projects) {
      const collectionIds = Object.entries(assignments).filter(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(Number(project.id))).map(([id]) => id);
      let result = collectWordIndex(project, collectionIds, chunkWords, overlap, warnings);
      if (!result.chunks.length) result = collectTextFallback(project, collectionIds, chunkWords, overlap, warnings);
      chunks.push(...result.chunks); pages += result.pages; words += result.words; documents += result.documents.size;
      projectReports.push({ projectId: project.id, projectName: project.name, projectPath: project.projectPath, source: result.source, documents: result.documents.size, pages: result.pages, words: result.words, passages: result.chunks.length });
    }
    const documentFrequency = buildDocumentFrequency(chunks);
    const averageChunkLength = chunks.length ? chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length : 0;
    const metadata = { version: INDEX_VERSION, builtAt: new Date().toISOString(), workspacePath, indexPath: getIndexPath(workspacePath), projects: projects.length, documents, pages, words, chunks: chunks.length, vocabulary: Object.keys(documentFrequency).length, chunkWords, overlap, averageChunkLength: Number(averageChunkLength.toFixed(2)), warnings: warnings.length };
    const diagnostics = { ...metadata, projectReports, warnings };
    fs.writeFileSync(getIndexPath(workspacePath), JSON.stringify({ version: INDEX_VERSION, metadata, documentFrequency, chunks }, null, 2), "utf-8");
    fs.writeFileSync(getDiagnosticsPath(workspacePath), JSON.stringify(diagnostics, null, 2), "utf-8");
    const message = chunks.length ? `Indexed ${chunks.length} passages from ${pages} OCR pages across ${projects.length} projects.` : `Index created, but no OCR passages were found. ${projects.length} projects were scanned; build the Word Index for a project first.`;
    return { success: chunks.length > 0, message, metadata, diagnostics, indexPath: getIndexPath(workspacePath) };
  });
  ipcMain.handle("manuscriptIndex:search", async (_event, data) => searchManuscriptPassages(data));
  ipcMain.handle("manuscriptIndex:open", async (_event, filePath) => {
    if (!filePath) return { success: false, message: "Path is required." }; const error = await shell.openPath(filePath); return { success: !error, message: error || "Opened." };
  });
}
