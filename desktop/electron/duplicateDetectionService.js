import fs from "fs";
import path from "path";
import crypto from "crypto";

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function safeReadJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : fallback; }
  catch { return fallback; }
}
function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");
}
function registryPath(workspacePath) {
  return path.join(workspacePath, ".ocr-studio", "duplicate-registry.json");
}
function readAssignments(workspacePath) {
  return safeReadJson(path.join(workspacePath, ".ocr-studio", "collection-assignments.json"), { assignments: {} });
}
function normalizeText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function sha256Buffer(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally { fs.closeSync(fd); }
  return hash.digest("hex");
}
function getDocumentPath(document) {
  for (const candidate of [document.outputPath, document.searchablePath, document.compressedPath, document.destinationPath, document.sourcePath]) {
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}
function readOcrText(projectPath, documentId) {
  const folder = path.join(projectPath, "ocr-word-index", String(documentId));
  if (!fs.existsSync(folder)) return { text: "", pageCount: 0, wordCount: 0 };
  const pageFiles = fs.readdirSync(folder).filter(name => /^page-\d{6}\.json$/i.test(name)).sort();
  const parts = [];
  let wordCount = 0;
  for (const pageFile of pageFiles) {
    const page = safeReadJson(path.join(folder, pageFile), null);
    const words = Array.isArray(page?.words) ? page.words : [];
    for (const word of words) {
      const text = word.correctedText || word.text || "";
      if (text) parts.push(text);
    }
    wordCount += words.length;
  }
  return { text: normalizeText(parts.join(" ")), pageCount: pageFiles.length, wordCount };
}
function tokenSet(text, limit = 50000) {
  const tokens = normalizeText(text).split(" ").filter(token => token.length > 1).slice(0, limit);
  return new Set(tokens);
}
function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const token of smaller) if (larger.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection || 1);
}
function filenameSimilarity(a, b) {
  const clean = value => normalizeText(path.parse(value || "").name).replace(/\b(copy|final|scan|scanned|ocr|version|rev|revised|\d+)\b/g, " ").replace(/\s+/g, " ").trim();
  const aa = tokenSet(clean(a));
  const bb = tokenSet(clean(b));
  if (!aa.size && !bb.size) return 0;
  return jaccard(aa, bb);
}
function pageCountSimilarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(a, b));
}
function buildFingerprint(project, document) {
  const filePath = getDocumentPath(document);
  const stats = filePath ? fs.statSync(filePath) : null;
  const ocr = readOcrText(project.projectPath, document.id);
  return {
    id: `${project.id}:${document.id}`,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.projectPath,
    documentId: document.id,
    fileName: document.fileName || path.basename(filePath || `Document ${document.id}`),
    filePath,
    fileSize: stats?.size || 0,
    modifiedAt: stats?.mtime?.toISOString?.() || null,
    fileHash: filePath ? sha256File(filePath) : null,
    ocrTextHash: ocr.text ? sha256Buffer(Buffer.from(ocr.text, "utf-8")) : null,
    ocrText: ocr.text,
    pageCount: ocr.pageCount,
    wordCount: ocr.wordCount,
  };
}
function compareFingerprints(a, b) {
  const exactFile = Boolean(a.fileHash && b.fileHash && a.fileHash === b.fileHash);
  const exactText = Boolean(a.ocrTextHash && b.ocrTextHash && a.ocrTextHash === b.ocrTextHash);
  const textScore = a.ocrText && b.ocrText ? jaccard(tokenSet(a.ocrText), tokenSet(b.ocrText)) : 0;
  const nameScore = filenameSimilarity(a.fileName, b.fileName);
  const pagesScore = pageCountSimilarity(a.pageCount, b.pageCount);
  const sizeScore = a.fileSize && b.fileSize ? Math.max(0, 1 - Math.abs(a.fileSize - b.fileSize) / Math.max(a.fileSize, b.fileSize)) : 0;
  let score = exactFile ? 1 : exactText ? 0.99 : (textScore * 0.7 + nameScore * 0.15 + pagesScore * 0.1 + sizeScore * 0.05);
  score = Math.min(1, Math.max(0, score));
  const type = exactFile ? "Exact file" : exactText ? "Exact OCR text" : score >= 0.9 ? "Highly similar" : score >= 0.75 ? "Similar" : "Possible match";
  return {
    id: [a.id, b.id].sort().join("::"),
    left: { ...a, ocrText: undefined },
    right: { ...b, ocrText: undefined },
    score: Number((score * 100).toFixed(1)),
    type,
    metrics: {
      fileHash: exactFile ? 100 : 0,
      ocrText: Number((textScore * 100).toFixed(1)),
      filename: Number((nameScore * 100).toFixed(1)),
      pageCount: Number((pagesScore * 100).toFixed(1)),
      fileSize: Number((sizeScore * 100).toFixed(1)),
    },
  };
}
function scanWorkspace(workspacePath, projects, collectionId, threshold) {
  const assignments = readAssignments(workspacePath);
  const scoped = collectionId ? projects.filter(project => assignments.assignments[String(project.id)] === collectionId) : projects;
  const fingerprints = [];
  for (const project of scoped) {
    const documents = safeReadJson(path.join(project.projectPath || "", "documents.json"), []);
    if (!Array.isArray(documents)) continue;
    for (const document of documents) {
      try { fingerprints.push(buildFingerprint(project, document)); }
      catch (error) { console.warn("Duplicate fingerprint failed:", project.name, document.fileName, error); }
    }
  }
  const matches = [];
  for (let i = 0; i < fingerprints.length; i += 1) {
    for (let j = i + 1; j < fingerprints.length; j += 1) {
      const result = compareFingerprints(fingerprints[i], fingerprints[j]);
      if (result.score >= threshold) matches.push(result);
    }
  }
  matches.sort((a, b) => b.score - a.score);
  const registry = {
    version: 1,
    workspacePath,
    collectionId: collectionId || null,
    threshold,
    scannedAt: new Date().toISOString(),
    summary: {
      projectCount: scoped.length,
      documentCount: fingerprints.length,
      matchCount: matches.length,
      exactCount: matches.filter(item => item.score >= 99).length,
      highlySimilarCount: matches.filter(item => item.score >= 90 && item.score < 99).length,
      possibleCount: matches.filter(item => item.score < 90).length,
    },
    matches,
  };
  writeJson(registryPath(workspacePath), registry);
  return registry;
}
function escapeCsv(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }

export function registerDuplicateDetectionIpc(ipcMain, dialog, shell, readRecentProjects) {
  ipcMain.handle("duplicate:scan", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    if (!workspacePath) return { success: false, message: "Workspace path is required.", registry: null };
    const projects = readRecentProjects().filter(project => project.workspacePath === workspacePath && project.projectPath && fs.existsSync(project.projectPath));
    const threshold = Math.min(100, Math.max(1, Number(data?.threshold) || 75));
    const registry = scanWorkspace(workspacePath, projects, data?.collectionId ? String(data.collectionId) : null, threshold);
    return { success: true, message: `Scanned ${registry.summary.documentCount} documents and found ${registry.summary.matchCount} matches.`, registry };
  });

  ipcMain.handle("duplicate:getRegistry", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const registry = workspacePath ? safeReadJson(registryPath(workspacePath), null) : null;
    return { success: true, registry };
  });

  ipcMain.handle("duplicate:export", async (_event, data) => {
    const workspacePath = String(data?.workspacePath || "");
    const registry = safeReadJson(registryPath(workspacePath), null);
    if (!registry) return { success: false, message: "Run a duplicate scan first.", files: [] };
    const result = await dialog.showOpenDialog({ title: "Choose duplicate report folder", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return { success: false, message: "Export cancelled.", files: [] };
    const outputDir = result.filePaths[0];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = path.join(outputDir, `ocr-studio-duplicate-report-${stamp}`);
    const jsonPath = `${base}.json`; const csvPath = `${base}.csv`; const htmlPath = `${base}.html`;
    writeJson(jsonPath, registry);
    const headers = ["Score","Type","Project A","Document A","Project B","Document B","OCR Text %","Filename %","Page Count %","File Size %"];
    const rows = registry.matches.map(item => [item.score,item.type,item.left.projectName,item.left.fileName,item.right.projectName,item.right.fileName,item.metrics.ocrText,item.metrics.filename,item.metrics.pageCount,item.metrics.fileSize]);
    fs.writeFileSync(csvPath, [headers, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n"), "utf-8");
    const htmlRows = registry.matches.map(item => `<tr><td>${item.score}%</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.left.projectName)} / ${escapeHtml(item.left.fileName)}</td><td>${escapeHtml(item.right.projectName)} / ${escapeHtml(item.right.fileName)}</td><td>${item.metrics.ocrText}%</td><td>${item.metrics.filename}%</td><td>${item.metrics.pageCount}%</td></tr>`).join("");
    fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><title>OCR Studio Duplicate Report</title><style>body{font-family:Arial;padding:24px;color:#292524}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6d3d1;padding:8px;text-align:left}th{background:#fff7ed}h1{color:#9a3412}</style></head><body><h1>OCR Studio Duplicate Report</h1><p>Scanned ${registry.summary.documentCount} documents; found ${registry.summary.matchCount} matches.</p><table><thead><tr><th>Score</th><th>Type</th><th>Document A</th><th>Document B</th><th>OCR</th><th>Name</th><th>Pages</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`, "utf-8");
    return { success: true, message: "Duplicate reports exported.", files: [jsonPath, csvPath, htmlPath] };
  });

  ipcMain.handle("duplicate:openPath", async (_event, filePath) => shell.openPath(filePath));
}
