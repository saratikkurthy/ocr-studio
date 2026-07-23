import fs from "fs";
import path from "path";
import crypto from "crypto";

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const rootDir = (workspacePath) => path.join(workspacePath, ".ocr-studio", "research-canvases");
const storeFile = (workspacePath) => path.join(rootDir(workspacePath), "canvases.json");
const emptyStore = () => ({ version: 1, canvases: [], updatedAt: null });

function requireWorkspace(workspacePath) {
  if (!workspacePath || typeof workspacePath !== "string") throw new Error("Workspace path is required.");
}

function readStore(workspacePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile(workspacePath), "utf8"));
    return { ...emptyStore(), ...raw, canvases: Array.isArray(raw.canvases) ? raw.canvases : [] };
  } catch {
    return emptyStore();
  }
}

function writeStore(workspacePath, store) {
  fs.mkdirSync(rootDir(workspacePath), { recursive: true });
  store.updatedAt = now();
  fs.writeFileSync(storeFile(workspacePath), JSON.stringify(store, null, 2), "utf8");
  return store;
}

function normalizeCanvas(input = {}, existing = {}) {
  const timestamp = now();
  return {
    id: existing.id || uid("canvas"),
    title: String(input.title ?? existing.title ?? "Untitled research canvas").trim() || "Untitled research canvas",
    description: String(input.description ?? existing.description ?? ""),
    cards: Array.isArray(input.cards) ? input.cards : (existing.cards || []),
    connections: Array.isArray(input.connections) ? input.connections : (existing.connections || []),
    viewport: input.viewport && typeof input.viewport === "object" ? input.viewport : (existing.viewport || { x: 0, y: 0, zoom: 1 }),
    gridSize: Number(input.gridSize ?? existing.gridSize ?? 20),
    snapToGrid: input.snapToGrid ?? existing.snapToGrid ?? true,
    createdAt: existing.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function safeName(value) {
  return String(value || "research-canvas").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "research-canvas";
}

function svgForCanvas(canvas) {
  const cards = canvas.cards || [];
  const edges = canvas.connections || [];
  const minX = Math.min(0, ...cards.map((c) => Number(c.x) || 0)) - 80;
  const minY = Math.min(0, ...cards.map((c) => Number(c.y) || 0)) - 80;
  const maxX = Math.max(1200, ...cards.map((c) => (Number(c.x) || 0) + (Number(c.width) || 260))) + 80;
  const maxY = Math.max(800, ...cards.map((c) => (Number(c.y) || 0) + (Number(c.height) || 160))) + 80;
  const esc = (v) => String(v || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const byId = new Map(cards.map((card) => [card.id, card]));
  const edgeSvg = edges.map((edge) => {
    const a = byId.get(edge.fromId); const b = byId.get(edge.toId); if (!a || !b) return "";
    const x1 = (Number(a.x)||0)+(Number(a.width)||260)/2; const y1=(Number(a.y)||0)+(Number(a.height)||160)/2;
    const x2 = (Number(b.x)||0)+(Number(b.width)||260)/2; const y2=(Number(b.y)||0)+(Number(b.height)||160)/2;
    return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8a5b2b" stroke-width="2" marker-end="url(#arrow)"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-6}" text-anchor="middle" font-size="13" fill="#5e3c1f">${esc(edge.label)}</text></g>`;
  }).join("\n");
  const cardSvg = cards.map((card) => `<g transform="translate(${Number(card.x)||0},${Number(card.y)||0})"><rect width="${Number(card.width)||260}" height="${Number(card.height)||160}" rx="14" fill="#fffaf0" stroke="#d49a45" stroke-width="2"/><text x="16" y="28" font-size="12" font-weight="700" fill="#a25c16">${esc(card.type)}</text><text x="16" y="54" font-size="18" font-weight="700" fill="#302012">${esc(card.title)}</text><foreignObject x="16" y="66" width="${(Number(card.width)||260)-32}" height="${(Number(card.height)||160)-78}"><div xmlns="http://www.w3.org/1999/xhtml" style="font:14px sans-serif;color:#5b4a3a;white-space:pre-wrap;overflow:hidden">${esc(card.content)}</div></foreignObject></g>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${maxX-minX}" height="${maxY-minY}" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#8a5b2b"/></marker></defs><rect x="${minX}" y="${minY}" width="${maxX-minX}" height="${maxY-minY}" fill="#f8f1e5"/>${edgeSvg}${cardSvg}</svg>`;
}

export function registerResearchCanvasIpc({ ipcMain, dialog, shell }) {
  ipcMain.handle("researchCanvas:list", async (_event, { workspacePath }) => {
    requireWorkspace(workspacePath);
    return readStore(workspacePath);
  });

  ipcMain.handle("researchCanvas:create", async (_event, { workspacePath, canvas }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    const created = normalizeCanvas(canvas);
    store.canvases.unshift(created);
    writeStore(workspacePath, store);
    return created;
  });

  ipcMain.handle("researchCanvas:update", async (_event, { workspacePath, canvas }) => {
    requireWorkspace(workspacePath);
    if (!canvas?.id) throw new Error("Canvas id is required.");
    const store = readStore(workspacePath);
    const index = store.canvases.findIndex((item) => item.id === canvas.id);
    if (index < 0) throw new Error("Canvas not found.");
    store.canvases[index] = normalizeCanvas(canvas, store.canvases[index]);
    writeStore(workspacePath, store);
    return store.canvases[index];
  });

  ipcMain.handle("researchCanvas:delete", async (_event, { workspacePath, canvasId }) => {
    requireWorkspace(workspacePath);
    const store = readStore(workspacePath);
    store.canvases = store.canvases.filter((item) => item.id !== canvasId);
    writeStore(workspacePath, store);
    return { success: true };
  });

  ipcMain.handle("researchCanvas:export", async (_event, { workspacePath, canvasId, format = "json" }) => {
    requireWorkspace(workspacePath);
    const canvas = readStore(workspacePath).canvases.find((item) => item.id === canvasId);
    if (!canvas) throw new Error("Canvas not found.");
    const ext = format === "html" ? "html" : format === "svg" ? "svg" : "json";
    const result = await dialog.showSaveDialog({ title: "Export research canvas", defaultPath: `${safeName(canvas.title)}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    let content = JSON.stringify(canvas, null, 2);
    if (format === "svg") content = svgForCanvas(canvas);
    if (format === "html") {
      const svg = svgForCanvas(canvas);
      content = `<!doctype html><html><head><meta charset="utf-8"><title>${canvas.title}</title><style>body{margin:0;background:#f8f1e5;font-family:system-ui,sans-serif}header{padding:20px 28px;background:#351f12;color:#fff}main{padding:24px;overflow:auto}svg{max-width:none;border:1px solid #d7bd95;box-shadow:0 8px 30px #0002}</style></head><body><header><h1>${canvas.title}</h1><p>${canvas.description || ""}</p></header><main>${svg.replace(/^<\?xml[^>]*>/, "")}</main></body></html>`;
    }
    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("researchCanvas:openSource", async (_event, filePath) => filePath ? shell.openPath(filePath) : "");
}
