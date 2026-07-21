import fs from "fs";
import path from "path";

const INDEX_VERSION = 1;
const DEFAULT_CHUNK_WORDS = 120;
const DEFAULT_OVERLAP = 25;

function safeReadJson(filePath, fallback) {
  try {
    return fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
      : fallback;
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function getIndexPath(workspacePath) {
  return path.join(workspacePath, ".ocr-studio", "manuscript-index.json");
}

function getProjectDocuments(projectPath) {
  const documents = safeReadJson(path.join(projectPath, "documents.json"), []);
  return Array.isArray(documents) ? documents : [];
}

function getCollectionAssignments(workspacePath) {
  return safeReadJson(
    path.join(workspacePath, ".ocr-studio", "collection-assignments.json"),
    { assignments: {} }
  );
}

function effectiveWords(page) {
  return (Array.isArray(page?.words) ? page.words : [])
    .map((word) => ({
      text: normalizeText(word.correctedText || word.text || ""),
      confidence: Number(word.confidence || 0),
      status: word.status || "Unreviewed",
    }))
    .filter((word) => word.text);
}

function makeChunks(words, chunkWords, overlap) {
  if (!words.length) return [];
  const chunks = [];
  const stride = Math.max(1, chunkWords - overlap);
  for (let start = 0; start < words.length; start += stride) {
    const slice = words.slice(start, start + chunkWords);
    if (!slice.length) break;
    chunks.push({ start, words: slice });
    if (start + chunkWords >= words.length) break;
  }
  return chunks;
}

function collectProjectChunks(project, chunkWords, overlap, collectionIds) {
  const root = path.join(project.projectPath || "", "ocr-word-index");
  if (!fs.existsSync(root)) return { chunks: [], pages: 0, words: 0, documents: 0 };

  const documents = getProjectDocuments(project.projectPath || "");
  const documentById = new Map(documents.map((doc) => [Number(doc.id), doc]));
  const chunks = [];
  let pages = 0;
  let wordCount = 0;
  const seenDocuments = new Set();

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const documentId = Number(entry.name);
    if (!Number.isFinite(documentId)) continue;
    const folder = path.join(root, entry.name);
    const pageFiles = fs.readdirSync(folder)
      .filter((name) => /^page-\d{6}\.json$/i.test(name))
      .sort();

    for (const pageFile of pageFiles) {
      const page = safeReadJson(path.join(folder, pageFile), null);
      if (!page) continue;
      const words = effectiveWords(page);
      if (!words.length) continue;
      pages += 1;
      wordCount += words.length;
      seenDocuments.add(documentId);
      const document = documentById.get(documentId);
      const pageNumber = Number(page.pageNumber || 0);

      for (const item of makeChunks(words, chunkWords, overlap)) {
        const text = item.words.map((word) => word.text).join(" ");
        const tokens = tokenize(text);
        const termFrequencies = {};
        for (const token of tokens) termFrequencies[token] = (termFrequencies[token] || 0) + 1;
        const avgConfidence = item.words.reduce((sum, word) => sum + word.confidence, 0) / item.words.length;
        const correctedWords = item.words.filter((word) => word.status === "Corrected").length;

        chunks.push({
          id: `${project.id}:${documentId}:${pageNumber}:${item.start}`,
          projectId: Number(project.id),
          projectName: project.name,
          projectPath: project.projectPath,
          documentId,
          documentName: document?.fileName || page.sourceFile || `Document ${documentId}`,
          pageNumber,
          language: page.language || project.language || "unknown",
          collectionIds,
          text,
          tokenCount: tokens.length,
          termFrequencies,
          averageConfidence: Number(avgConfidence.toFixed(2)),
          correctedWords,
        });
      }
    }
  }

  return { chunks, pages, words: wordCount, documents: seenDocuments.size };
}

function buildDocumentFrequency(chunks) {
  const df = {};
  for (const chunk of chunks) {
    for (const term of Object.keys(chunk.termFrequencies)) df[term] = (df[term] || 0) + 1;
  }
  return df;
}

function bm25Score(chunk, queryTokens, documentFrequency, totalChunks, averageLength) {
  const k1 = 1.4;
  const b = 0.72;
  let score = 0;
  for (const term of queryTokens) {
    const tf = chunk.termFrequencies[term] || 0;
    if (!tf) continue;
    const df = documentFrequency[term] || 0;
    const idf = Math.log(1 + (totalChunks - df + 0.5) / (df + 0.5));
    const denominator = tf + k1 * (1 - b + b * (chunk.tokenCount / Math.max(averageLength, 1)));
    score += idf * ((tf * (k1 + 1)) / denominator);
  }
  return score;
}

function makeSnippet(text, queryTokens, maxLength = 420) {
  if (text.length <= maxLength) return text;
  const lower = text.toLocaleLowerCase();
  const positions = queryTokens.map((token) => lower.indexOf(token)).filter((pos) => pos >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - Math.floor(maxLength / 3));
  const end = Math.min(text.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function searchManuscriptPassages(data) {
  const workspacePath = String(data?.workspacePath || "");
  const query = normalizeText(data?.query || "");
  const limit = Math.min(Math.max(Number(data?.limit) || 20, 1), 100);
  const collectionId = data?.collectionId ? String(data.collectionId) : null;
  if (!workspacePath || !query) return { success: false, message: "Workspace and question are required.", results: [] };
  const index = safeReadJson(getIndexPath(workspacePath), null);
  if (!index) return { success: false, message: "Build the local manuscript index first.", results: [] };

  const queryTokens = [...new Set(tokenize(query))];
  const phrase = query.toLocaleLowerCase();
  const candidates = (index.chunks || [])
    .filter((chunk) => !collectionId || (chunk.collectionIds || []).includes(collectionId))
    .map((chunk) => {
      let score = bm25Score(chunk, queryTokens, index.documentFrequency || {}, index.chunks.length, index.metadata?.averageChunkLength || 1);
      const normalizedChunk = chunk.text.toLocaleLowerCase();
      if (normalizedChunk.includes(phrase)) score += 6;
      const coverage = queryTokens.length ? queryTokens.filter((token) => chunk.termFrequencies[token]).length / queryTokens.length : 0;
      score += coverage * 2;
      return { ...chunk, score, coverage, snippet: makeSnippet(chunk.text, queryTokens) };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result, rank) => ({
      id: result.id, rank: rank + 1, score: Number(result.score.toFixed(4)), coverage: Number((result.coverage * 100).toFixed(1)),
      projectId: result.projectId, projectName: result.projectName, projectPath: result.projectPath,
      documentId: result.documentId, documentName: result.documentName, pageNumber: result.pageNumber,
      language: result.language, averageConfidence: result.averageConfidence, correctedWords: result.correctedWords, snippet: result.snippet,
    }));
  return { success: true, message: candidates.length ? `Found ${candidates.length} relevant passages.` : "No relevant passages were found.", results: candidates, query, metadata: index.metadata };
}

export function registerManuscriptIndexIpc(ipcMain, shell, readRecentProjects) {
  ipcMain.handle("manuscriptIndex:getStatus", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const index = workspacePath ? safeReadJson(getIndexPath(workspacePath), null) : null;
    return index
      ? { success: true, message: "Local manuscript index is ready.", metadata: index.metadata }
      : { success: true, message: "No manuscript index has been built yet.", metadata: null };
  });

  ipcMain.handle("manuscriptIndex:build", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    if (!workspacePath) return { success: false, message: "Workspace path is required.", metadata: null };

    const chunkWords = Math.min(Math.max(Number(data?.chunkWords) || DEFAULT_CHUNK_WORDS, 40), 400);
    const overlap = Math.min(Math.max(Number(data?.overlap) || DEFAULT_OVERLAP, 0), chunkWords - 1);
    const assignments = getCollectionAssignments(workspacePath).assignments || {};
    const projects = readRecentProjects().filter((project) => project.workspacePath === workspacePath && fs.existsSync(project.projectPath || ""));

    const chunks = [];
    let pages = 0;
    let words = 0;
    let documents = 0;
    for (const project of projects) {
      const collectionIds = Object.entries(assignments)
        .filter(([, projectIds]) => Array.isArray(projectIds) && projectIds.map(Number).includes(Number(project.id)))
        .map(([collectionId]) => collectionId);
      const result = collectProjectChunks(project, chunkWords, overlap, collectionIds);
      chunks.push(...result.chunks);
      pages += result.pages;
      words += result.words;
      documents += result.documents;
    }

    const documentFrequency = buildDocumentFrequency(chunks);
    const averageChunkLength = chunks.length
      ? chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length
      : 0;
    const metadata = {
      version: INDEX_VERSION,
      builtAt: new Date().toISOString(),
      workspacePath,
      projects: projects.length,
      documents,
      pages,
      words,
      chunks: chunks.length,
      vocabulary: Object.keys(documentFrequency).length,
      chunkWords,
      overlap,
      averageChunkLength: Number(averageChunkLength.toFixed(2)),
    };
    const target = getIndexPath(workspacePath);
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, JSON.stringify({ version: INDEX_VERSION, metadata, documentFrequency, chunks }, null, 2), "utf-8");
    return { success: true, message: `Indexed ${chunks.length} passages from ${pages} OCR pages.`, metadata };
  });

  ipcMain.handle("manuscriptIndex:search", async (_event, data) => searchManuscriptPassages(data));

  ipcMain.handle("manuscriptIndex:open", async (_event, filePath) => {
    if (!filePath) return { success: false, message: "Path is required." };
    const error = await shell.openPath(filePath);
    return { success: !error, message: error || "Opened." };
  });
}
