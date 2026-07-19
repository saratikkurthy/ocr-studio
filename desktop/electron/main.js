import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import http from "http";
import crypto from "crypto";
import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from "electron";
import { exec, spawn } from "child_process";
import { analyzePdf } from "./analysis/pdfAnalyzer.js";


protocol.registerSchemesAsPrivileged([
  {
    scheme: "ocr-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function createPdfPreviewUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const encodedPath = encodeURIComponent(path.resolve(filePath));
  return `ocr-file://pdf/${encodedPath}`;
}

async function registerPdfPreviewProtocol() {
  protocol.handle("ocr-file", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const encodedPath = requestUrl.pathname.replace(/^\//, "");
      const filePath = decodeURIComponent(encodedPath);

      if (!filePath || !fs.existsSync(filePath)) {
        return new Response("PDF file not found.", {
          status: 404,
          headers: { "content-type": "text/plain" },
        });
      }

      if (path.extname(filePath).toLowerCase() !== ".pdf") {
        return new Response("Only PDF preview is supported.", {
          status: 415,
          headers: { "content-type": "text/plain" },
        });
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.error("PDF preview protocol failed:", error);

      return new Response("Could not load PDF preview.", {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    }
  });
}


let pdfPreviewServer = null;
let pdfPreviewPort = null;
const pdfPreviewFiles = new Map();

function registerPdfForPreview(filePath) {
  const resolvedPath = path.resolve(filePath);

  for (const [token, existingPath] of pdfPreviewFiles.entries()) {
    if (existingPath === resolvedPath) {
      return token;
    }
  }

  const token = crypto.randomBytes(24).toString("hex");
  pdfPreviewFiles.set(token, resolvedPath);
  return token;
}

function sendPdfRange(req, res, filePath) {
  let stats;

  try {
    stats = fs.statSync(filePath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("PDF file not found.");
    return;
  }

  const fileSize = stats.size;
  const range = req.headers.range;

  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": "application/pdf",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };

  if (!range) {
    res.writeHead(200, {
      ...commonHeaders,
      "Content-Length": fileSize,
    });

    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match) {
    res.writeHead(416, {
      ...commonHeaders,
      "Content-Range": `bytes */${fileSize}`,
    });
    res.end();
    return;
  }

  const requestedStart = match[1] ? Number(match[1]) : 0;
  const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;

  const start = Math.max(0, requestedStart);
  const end = Math.min(requestedEnd, fileSize - 1);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start >= fileSize
  ) {
    res.writeHead(416, {
      ...commonHeaders,
      "Content-Range": `bytes */${fileSize}`,
    });
    res.end();
    return;
  }

  res.writeHead(206, {
    ...commonHeaders,
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Content-Length": end - start + 1,
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
}

async function ensurePdfPreviewServer() {
  if (pdfPreviewServer && pdfPreviewPort) {
    return pdfPreviewPort;
  }

  pdfPreviewServer = http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      const match = /^\/pdf\/([a-f0-9]+)$/.exec(requestUrl.pathname);

      if (!match) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found.");
        return;
      }

      const filePath = pdfPreviewFiles.get(match[1]);

      if (!filePath) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Unknown PDF preview.");
        return;
      }

      sendPdfRange(req, res, filePath);
    } catch (error) {
      console.error("PDF preview server request failed:", error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("PDF preview failed.");
    }
  });

  await new Promise((resolve, reject) => {
    pdfPreviewServer.once("error", reject);
    pdfPreviewServer.listen(0, "127.0.0.1", () => {
      pdfPreviewServer.off("error", reject);
      resolve();
    });
  });

  const address = pdfPreviewServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not determine the PDF preview server port.");
  }

  pdfPreviewPort = address.port;
  return pdfPreviewPort;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");

  console.log("Preload path:", preloadPath);
  console.log("Preload exists:", fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "OCR Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      plugins: true,
    },
  });

  win.loadURL("http://localhost:5173");
}

function getAppDataPath() {
  const appData = path.join(app.getPath("userData"), "OCR Studio");
  fs.mkdirSync(appData, { recursive: true });
  return appData;
}

function getRecentProjectsPath() {
  return path.join(getAppDataPath(), "recent-projects.json");
}

function readRecentProjects() {
  const filePath = getRecentProjectsPath();
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveRecentProjects(projects) {
  fs.writeFileSync(
    getRecentProjectsPath(),
    JSON.stringify(projects, null, 2),
    "utf-8"
  );
}

function windowsPathToWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath);
  const driveLetter = normalized[0].toLowerCase();
  const rest = normalized.slice(2).replace(/\\/g, "/");
  return `/mnt/${driveLetter}${rest}`;
}
function getProjectAnalysisPath(projectPath) {
  return path.join(projectPath, "analysis.json");
}

function readProjectAnalysis(projectPath) {
  const analysisPath = getProjectAnalysisPath(projectPath);

  if (!fs.existsSync(analysisPath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(analysisPath, "utf-8"));
  } catch (error) {
    console.error("Could not read analysis.json:", error);
    return [];
  }
}

function saveProjectAnalysis(projectPath, analyses) {
  fs.writeFileSync(
    getProjectAnalysisPath(projectPath),
    JSON.stringify(analyses, null, 2),
    "utf-8"
  );
}
function getOcrQueuePath(projectPath) {
  return path.join(projectPath, "Logs", "ocr-queue.json");
}

function readOcrQueue(projectPath) {
  const queuePath = getOcrQueuePath(projectPath);

  if (!fs.existsSync(queuePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(queuePath, "utf-8"));
  } catch (error) {
    console.error("Could not read OCR queue:", error);
    return [];
  }
}

function saveOcrQueue(projectPath, queue) {
  const logsFolder = path.join(projectPath, "Logs");
  fs.mkdirSync(logsFolder, { recursive: true });

  fs.writeFileSync(
    getOcrQueuePath(projectPath),
    JSON.stringify(queue, null, 2),
    "utf-8"
  );
}
function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({
          installed: false,
          output: stderr || error.message,
        });
        return;
      }

      resolve({
        installed: true,
        output: stdout,
      });
    });
  });
}
let activeOcrProcess = null;

// One worker is allowed per project. The worker survives tab changes because it
// runs in Electron's main process rather than in React.
const activeQueueWorkers = new Map();
const queueStopRequests = new Set();

function broadcastToWindows(channel, payload) {
  if (channel === "wordIndex:progress") {
    notifyWordIndexQueueProgress(payload);
  }
for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

function normalizeQueuePositions(queue) {
  return queue.map((item, index) => ({
    ...item,
    position: index + 1,
  }));
}

function updateQueueItem(projectPath, queueItemId, updates) {
  const queue = readOcrQueue(projectPath);
  const updatedQueue = normalizeQueuePositions(
    queue.map((item) =>
      item.id === queueItemId
        ? { ...item, ...updates }
        : item
    )
  );

  saveOcrQueue(projectPath, updatedQueue);
  broadcastToWindows("queue:updated", {
    projectPath,
    queue: updatedQueue,
  });

  return updatedQueue;
}

function broadcastQueueWorkerStatus(projectPath, status, message, queueItemId) {
  broadcastToWindows("queue:workerStatus", {
    projectPath,
    status,
    message,
    queueItemId,
  });
}
ipcMain.handle("workspace:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select OCR Studio Workspace",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("project:create", async (_, data) => {
  const safeName = data.name.replace(/[<>:"/\\|?*]/g, "").trim();
  const projectPath = path.join(data.workspacePath, safeName);

  fs.mkdirSync(projectPath, { recursive: true });

  const folders = ["Input", "Processed", "OCR", "Export", "Cache", "Logs"];

  for (const folder of folders) {
    fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
  }

  const project = {
    id: Date.now(),
    name: data.name,
    description: data.description,
    language: data.language,
    workflow: data.workflow,
    status: "Draft",
    workspacePath: data.workspacePath,
    projectPath,
    compression: data.compression || "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(projectPath, "project.json"),
    JSON.stringify(project, null, 2),
    "utf-8"
  );

  fs.writeFileSync(path.join(projectPath, "project.db"), "", "utf-8");

  const recent = readRecentProjects();
  const updated = [
    project,
    ...recent.filter((p) => p.projectPath !== projectPath),
  ];

  saveRecentProjects(updated);

  return project;
});

ipcMain.handle("project:listRecent", async () => {
  return readRecentProjects();
});

ipcMain.handle("project:importFiles", async (_, data) => {
  const result = await dialog.showOpenDialog({
    title: "Import PDF or Image Files",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Documents",
        extensions: ["pdf", "jpg", "jpeg", "png", "tif", "tiff"],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const inputFolder = path.join(data.projectPath, "Input");
  fs.mkdirSync(inputFolder, { recursive: true });

  const importedFiles = result.filePaths.map((sourcePath) => {
    const fileName = path.basename(sourcePath);
    const destinationPath = path.join(inputFolder, fileName);

    fs.copyFileSync(sourcePath, destinationPath);

    return {
      id: Date.now() + Math.floor(Math.random() * 10000),
      fileName,
      sourcePath,
      destinationPath,
      status: "Imported",
      importedAt: new Date().toISOString(),
    };
  });

  const documentsPath = path.join(data.projectPath, "documents.json");

  let existing = [];
  if (fs.existsSync(documentsPath)) {
    existing = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
  }

  const updated = [...importedFiles, ...existing];

  fs.writeFileSync(documentsPath, JSON.stringify(updated, null, 2), "utf-8");

  return updated;
});

ipcMain.handle("project:listDocuments", async (_, data) => {
  const documentsPath = path.join(data.projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) return [];

  return JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
});

ipcMain.handle("project:listExports", async (_, data) => {
  const exportFolder = path.join(data.projectPath, "Export");

  if (!fs.existsSync(exportFolder)) return [];

  return fs
    .readdirSync(exportFolder)
    .filter(
      (file) =>
        file.toLowerCase().endsWith(".pdf") ||
        file.toLowerCase().endsWith(".txt")
    )
    .map((file) => {
      const fullPath = path.join(exportFolder, file);
      const stat = fs.statSync(fullPath);

      return {
        fileName: file,
        filePath: fullPath,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      };
    });
});

ipcMain.handle("shell:openPath", async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return "Path does not exist";
  }

  return await shell.openPath(filePath);
});

ipcMain.handle("shell:openInputFolder", async (_, projectPath) => {
  const inputFolder = path.join(projectPath, "Input");

  fs.mkdirSync(inputFolder, { recursive: true });

  return await shell.openPath(inputFolder);
});

ipcMain.handle("ocr:checkTools", async () => {
  const tesseract = await runCommand(
    "wsl.exe -d Ubuntu-24.04 -- tesseract --list-langs"
  );

  const ocrmypdf = await runCommand(
    "wsl.exe -d Ubuntu-24.04 -- ocrmypdf --version"
  );

  return {
    tesseract,
    ocrmypdf,
  };
});
async function getPdfPageCount(inputWslPath) {
  return new Promise((resolve) => {
    const args = ["-d", "Ubuntu-24.04", "--", "pdfinfo", inputWslPath];
    const child = spawn("wsl.exe", args, { windowsHide: true });

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("close", () => {
      const match = output.match(/Pages:\s+(\d+)/);
      resolve(match ? Number(match[1]) : undefined);
    });

    child.on("error", () => {
      resolve(undefined);
    });
  });
}

function getOcrJobsPath(projectPath) {
  return path.join(projectPath, "Logs", "ocr-jobs.json");
}

function readOcrJobs(projectPath) {
  const jobsPath = getOcrJobsPath(projectPath);

  if (!fs.existsSync(jobsPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(jobsPath, "utf-8"));
}

function saveOcrJobs(projectPath, jobs) {
  const logsFolder = path.join(projectPath, "Logs");
  fs.mkdirSync(logsFolder, { recursive: true });

  fs.writeFileSync(
    getOcrJobsPath(projectPath),
    JSON.stringify(jobs, null, 2),
    "utf-8"
  );
}

function addOcrJob(projectPath, job) {
  const jobs = readOcrJobs(projectPath);
  const updated = [job, ...jobs];

  saveOcrJobs(projectPath, updated);

  return updated;
}
function updateDocumentStatus(
  projectPath,
  documentId,
  status,
  extraData = {}
) {
  const documentsPath = path.join(projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return [];
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );

  const updated = documents.map((doc) =>
    doc.id === documentId
      ? {
        ...doc,
        status,
        ...extraData,
      }
      : doc
  );

  fs.writeFileSync(
    documentsPath,
    JSON.stringify(updated, null, 2),
    "utf-8"
  );

  return updated;
}

ipcMain.handle("ocr:runProject", async (event, data) => {
  const jobStartedAt = new Date();
  const documentsPath = path.join(data.projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return { success: false, message: "No imported documents found." };
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
  const selectedDocumentIds = data.documentIds || [];

  const selectedDocuments = documents.filter(
    (doc) =>
      selectedDocumentIds.includes(doc.id) &&
      doc.fileName.toLowerCase().endsWith(".pdf")
  );

  if (selectedDocuments.length === 0) {
    return {
      success: false,
      message: "Please select at least one PDF file first.",
    };
  }
  const documentsToProcess = selectedDocuments.filter((doc) => {
    if (doc.status === "Processing") return false;

    if (doc.status === "Converted" && !data.allowReprocess) {
      return false;
    }

    return true;
  });

  if (documentsToProcess.length === 0) {
    return {
      success: false,
      message:
        "All selected PDFs are already converted or currently processing.",
    };
  }
  const exportFolder = path.join(data.projectPath, "Export");
  const logsFolder = path.join(data.projectPath, "Logs");

  fs.mkdirSync(exportFolder, { recursive: true });
  fs.mkdirSync(logsFolder, { recursive: true });

  const logPath = path.join(logsFolder, "ocr-run.log");
  fs.writeFileSync(logPath, "", "utf-8");

  const compression = data.compression || "medium";
  const outputType = data.outputType || "searchable_pdf";

  const compressionArgs =
    {
      low: ["--optimize", "1", "--jpeg-quality", "95", "--png-quality", "95"],
      medium: [
        "--optimize",
        "2",
        "--jpeg-quality",
        "85",
        "--png-quality",
        "85",
      ],
      high: [
        "--optimize",
        "3",
        "--jpeg-quality",
        "65",
        "--png-quality",
        "65",
      ],
      maximum: [
        "--optimize",
        "3",
        "--jpeg-quality",
        "45",
        "--png-quality",
        "45",
      ],
    }[compression] || ["--optimize", "2", "--jpeg-quality", "85", "--png-quality", "85"];

  const runSpawn = (command, args, logLabel, progressFileName = "", totalPages) => {
    return new Promise((resolve) => {
      fs.appendFileSync(
        logPath,
        `\n\n${logLabel}:\n${command} ${args.join(" ")}\n\n`,
        "utf-8"
      );

      const child = spawn(command, args, { windowsHide: true });
      activeOcrProcess = child;

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        fs.appendFileSync(logPath, text, "utf-8");
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        fs.appendFileSync(logPath, text, "utf-8");

        const pageMatch = text.match(/^\s*(\d+)\s+\[tesseract\]/m);

        if (pageMatch) {
          const currentPage = Number(pageMatch[1]);
          const percent =
            totalPages && currentPage
              ? Math.min(100, Math.round((currentPage / totalPages) * 100))
              : undefined;

          event.sender.send("ocr:progress", {
            fileName: progressFileName,
            currentPage,
            totalPages,
            percent,
            message: totalPages
              ? `Processing page ${currentPage} of ${totalPages} — ${percent}%`
              : `Processing page ${currentPage}`,
          });
        } else if (text.includes("Postprocessing")) {
          event.sender.send("ocr:progress", {
            fileName: progressFileName,
            message: "Postprocessing PDF...",
          });
        }
      });

      child.on("error", (error) => {
        fs.appendFileSync(logPath, `\nPROCESS ERROR: ${error.message}\n`, "utf-8");

        event.sender.send("ocr:progress", {
          fileName: progressFileName,
          message: "OCR process error.",
        });

        resolve({ code: -1, error: error.message });
      });

      child.on("close", (code) => {
        fs.appendFileSync(logPath, `\nPROCESS EXIT CODE: ${code}\n`, "utf-8");

        event.sender.send("ocr:progress", {
          fileName: progressFileName,
          message: code === 0 ? "OCR step completed." : `OCR failed with code ${code}.`,
        });
        activeOcrProcess = null;
        resolve({ code });
      });
    });
  };

  const results = [];

  for (const pdf of documentsToProcess) {
    updateDocumentStatus(
      data.projectPath,
      pdf.id,
      "Processing",
      {
        processingStartedAt: new Date().toISOString(),
      }
    );

    event.sender.send("ocr:documentStatus", {
      documentId: pdf.id,
      status: "Processing",
    });
    const inputPath = pdf.destinationPath;
    const baseName = pdf.fileName.replace(/\.pdf$/i, "");

    const searchablePath = path.join(exportFolder, `${baseName}_searchable.pdf`);
    const compressedPath = path.join(exportFolder, `${baseName}_searchable_compressed.pdf`);
    const sidecarTxtPath = path.join(exportFolder, `${baseName}_ocr_text.txt`);

    for (const filePath of [searchablePath, compressedPath, sidecarTxtPath]) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const inputWsl = windowsPathToWslPath(inputPath);
    const totalPages = await getPdfPageCount(inputWsl);

    event.sender.send("ocr:progress", {
      fileName: pdf.fileName,
      totalPages,
      currentPage: 0,
      percent: 0,
      message: totalPages
        ? `Starting OCR: 0 of ${totalPages} pages`
        : "Starting OCR...",
    });

    const searchableWsl = windowsPathToWslPath(searchablePath);
    const sidecarWsl = windowsPathToWslPath(sidecarTxtPath);

    const ocrArgs = [
      "-d",
      "Ubuntu-24.04",
      "--",
      "ocrmypdf",
      "--force-ocr",
      "--deskew",
      "--oversample",
      "300",
      ...compressionArgs,
      "--output-type",
      "pdf",
      "-l",
      data.language || "tel",
    ];

    if (outputType === "searchable_pdf_txt") {
      ocrArgs.push("--sidecar", sidecarWsl);
    }

    ocrArgs.push(inputWsl);
    ocrArgs.push(searchableWsl);

    const ocrResult = await runSpawn(
      "wsl.exe",
      ocrArgs,
      `OCR COMMAND for ${pdf.fileName}`,
      pdf.fileName,
      totalPages
    );

    if (ocrResult.code !== 0 || !fs.existsSync(searchablePath)) {
      const failedAt = new Date().toISOString();

      updateDocumentStatus(
        data.projectPath,
        pdf.id,
        "Failed",
        {
          failedAt,
          lastError: `OCR failed for ${pdf.fileName}`,
        }
      );

      event.sender.send("ocr:documentStatus", {
        documentId: pdf.id,
        status: "Failed",
      });

      const jobEndedAt = new Date();

      const failedJob = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        documentId: pdf.id,
        fileName: pdf.fileName,
        status: "Failed",
        startedAt: jobStartedAt.toISOString(),
        endedAt: jobEndedAt.toISOString(),
        durationMs: jobEndedAt.getTime() - jobStartedAt.getTime(),
        message: `OCR failed for ${pdf.fileName}`,
      };

      addOcrJob(data.projectPath, failedJob);

      results.push({
        documentId: pdf.id,
        fileName: pdf.fileName,
        success: false,
        message: failedJob.message,
      });

      continue;
    }

    const gsProfiles = {
      low: "/prepress",
      medium: "/ebook",
      high: "/screen",
      maximum: "/screen",
    };

    const gsProfile = gsProfiles[compression] || "/ebook";

    const gsArgs = [
      "-d",
      "Ubuntu-24.04",
      "--",
      "gs",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${gsProfile}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${windowsPathToWslPath(compressedPath)}`,
      windowsPathToWslPath(searchablePath),
    ];

    const gsResult = await runSpawn(
      "wsl.exe",
      gsArgs,
      `GHOSTSCRIPT COMMAND for ${pdf.fileName}`,
      pdf.fileName,
      totalPages
    );

    const finalPath =
      gsResult.code === 0 && fs.existsSync(compressedPath)
        ? compressedPath
        : searchablePath;

    const inputSize = fs.statSync(inputPath).size;
    const ocrSize = fs.statSync(searchablePath).size;
    const outputSize = fs.statSync(finalPath).size;
    const reductionPercent = ((inputSize - outputSize) / inputSize) * 100;
    const jobEndedAt = new Date();
    const completedAt = new Date().toISOString();

    updateDocumentStatus(
      data.projectPath,
      pdf.id,
      "Converted",
      {
        completedAt,
        outputPath: finalPath,
        searchablePath,
        compressedPath: fs.existsSync(compressedPath)
          ? compressedPath
          : undefined,
        sidecarTxtPath: fs.existsSync(sidecarTxtPath)
          ? sidecarTxtPath
          : undefined,
        inputSize,
        outputSize,
        reductionPercent,
        lastError: undefined,
      }
    );

    event.sender.send("ocr:documentStatus", {
      documentId: pdf.id,
      status: "Converted",
    });

    const completedJob = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      fileName: pdf.fileName,
      status: "Completed",
      startedAt: jobStartedAt.toISOString(),
      endedAt: jobEndedAt.toISOString(),
      durationMs: jobEndedAt.getTime() - jobStartedAt.getTime(),
      outputPath: finalPath,
      inputSize,
      ocrSize,
      outputSize,
      reductionPercent,
      sidecarTxtPath: fs.existsSync(sidecarTxtPath) ? sidecarTxtPath : undefined,
    };

    addOcrJob(data.projectPath, completedJob);

    results.push({
      documentId: pdf.id,
      fileName: pdf.fileName,
      success: true,
      outputPath: finalPath,
      searchablePath,
      compressedPath: fs.existsSync(compressedPath)
        ? compressedPath
        : undefined,
      sidecarTxtPath: fs.existsSync(sidecarTxtPath)
        ? sidecarTxtPath
        : undefined,
      inputSize,
      ocrSize,
      outputSize,
      reductionPercent,
    });
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length === 0) {
    return {
      success: false,
      message: "OCR failed for all selected PDFs. Check Logs/ocr-run.log",
      results,
    };
  }

  return {
    success: true,
    message:
      failed.length === 0
        ? `OCR completed for ${successful.length} PDF(s).`
        : `OCR completed for ${successful.length} PDF(s), failed for ${failed.length}.`,
    outputPath: successful[0].outputPath,
    inputSize: successful[0].inputSize,
    ocrSize: successful[0].ocrSize,
    outputSize: successful[0].outputSize,
    reductionPercent: successful[0].reductionPercent,
    results,
  };
});
ipcMain.handle("project:delete", async (_, data) => {
  const recent = readRecentProjects();
  const updated = recent.filter((p) => p.id !== data.projectId);
  saveRecentProjects(updated);

  if (data.deleteFiles && data.projectPath && fs.existsSync(data.projectPath)) {
    fs.rmSync(data.projectPath, { recursive: true, force: true });
  }

  return updated;
});

ipcMain.handle("project:deleteDocument", async (_, data) => {
  const documentsPath = path.join(data.projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) return [];

  const documents = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
  const target = documents.find((doc) => doc.id === data.documentId);

  if (target?.destinationPath && fs.existsSync(target.destinationPath)) {
    fs.unlinkSync(target.destinationPath);
  }

  const updated = documents.filter((doc) => doc.id !== data.documentId);
  fs.writeFileSync(documentsPath, JSON.stringify(updated, null, 2), "utf-8");

  return updated;
});

ipcMain.handle("project:deleteExport", async (_, data) => {
  if (data.filePath && fs.existsSync(data.filePath)) {
    fs.unlinkSync(data.filePath);
  }

  const exportFolder = path.join(data.projectPath, "Export");

  if (!fs.existsSync(exportFolder)) return [];

  return fs
    .readdirSync(exportFolder)
    .filter(
      (file) =>
        file.toLowerCase().endsWith(".pdf") ||
        file.toLowerCase().endsWith(".txt")
    )
    .map((file) => {
      const fullPath = path.join(exportFolder, file);
      const stat = fs.statSync(fullPath);

      return {
        fileName: file,
        filePath: fullPath,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      };
    });
});
ipcMain.handle("pdf:verifyTextLayer", async (_, data) => {
  const pdfPath = data.filePath;

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    return {
      success: false,
      message: "PDF file not found.",
      characterCount: 0,
      sampleText: "",
    };
  }

  const pdfWslPath = windowsPathToWslPath(pdfPath);

  const args = [
    "-d",
    "Ubuntu-24.04",
    "--",
    "pdftotext",
    pdfWslPath,
    "-",
  ];

  return new Promise((resolve) => {
    const child = spawn("wsl.exe", args, {
      windowsHide: true,
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        message: error.message,
        characterCount: 0,
        sampleText: "",
      });
    });

    child.on("close", (code) => {
      const cleaned = output.trim();
      const characterCount = cleaned.length;

      if (code !== 0) {
        resolve({
          success: false,
          message: errorOutput || `pdftotext failed with exit code ${code}`,
          characterCount: 0,
          sampleText: "",
        });
        return;
      }

      resolve({
        success: true,
        message:
          characterCount > 0
            ? "Text layer found."
            : "No usable text layer found.",
        characterCount,
        sampleText: cleaned.slice(0, 500),
      });
    });
  });
});
ipcMain.handle("ocr:cancel", async () => {
  if (!activeOcrProcess) {
    return {
      success: false,
      message: "No OCR job is currently running.",
    };
  }

  activeOcrProcess.kill("SIGTERM");
  activeOcrProcess = null;

  return {
    success: true,
    message: "OCR job cancellation requested.",
  };
});

ipcMain.handle("project:listOcrJobs", async (_, data) => {
  return readOcrJobs(data.projectPath);
});

ipcMain.handle("analysis:listProject", async (_, data) => {
  return readProjectAnalysis(data.projectPath);
});

ipcMain.handle("analysis:analyzeProject", async (event, data) => {
  const documentsPath = path.join(
    data.projectPath,
    "documents.json"
  );

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "No imported documents found.",
      analyses: [],
    };
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );

  const requestedDocumentIds = Array.isArray(data.documentIds)
    ? data.documentIds
    : [];

  const pdfDocuments = documents.filter((document) => {
    const isPdf = document.fileName
      .toLowerCase()
      .endsWith(".pdf");

    if (!isPdf) return false;

    if (requestedDocumentIds.length === 0) {
      return true;
    }

    return requestedDocumentIds.includes(document.id);
  });

  if (pdfDocuments.length === 0) {
    return {
      success: false,
      message: "No PDF documents were selected for analysis.",
      analyses: readProjectAnalysis(data.projectPath),
    };
  }

  const existingAnalyses = readProjectAnalysis(
    data.projectPath
  );

  const analysisMap = new Map(
    existingAnalyses.map((analysis) => [
      analysis.documentId,
      analysis,
    ])
  );

  const completedAnalyses = [];
  const failedAnalyses = [];

  for (let index = 0; index < pdfDocuments.length; index += 1) {
    const document = pdfDocuments[index];

    event.sender.send("analysis:progress", {
      documentId: document.id,
      fileName: document.fileName,
      current: index + 1,
      total: pdfDocuments.length,
      percent: Math.round(
        ((index + 1) / pdfDocuments.length) * 100
      ),
      message: `Analyzing ${document.fileName}`,
    });

    try {
      const analysis = await analyzePdf(
        document.destinationPath
      );

      const storedAnalysis = {
        documentId: document.id,
        ...analysis,
      };

      analysisMap.set(document.id, storedAnalysis);
      completedAnalyses.push(storedAnalysis);
    } catch (error) {
      const failedAnalysis = {
        documentId: document.id,
        fileName: document.fileName,
        filePath: document.destinationPath,
        analysisStatus: "Failed",
        analyzedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : String(error),
      };

      analysisMap.set(document.id, failedAnalysis);
      failedAnalyses.push(failedAnalysis);
    }

    saveProjectAnalysis(
      data.projectPath,
      Array.from(analysisMap.values())
    );
  }

  const analyses = Array.from(analysisMap.values());

  return {
    success: completedAnalyses.length > 0,
    message:
      failedAnalyses.length === 0
        ? `Analysis completed for ${completedAnalyses.length} PDF(s).`
        : `Analysis completed for ${completedAnalyses.length} PDF(s); ${failedAnalyses.length} failed.`,
    analyses,
    completedCount: completedAnalyses.length,
    failedCount: failedAnalyses.length,
  };
});

async function runQueuedDocument(projectPath, queueItem) {
  const documentsPath = path.join(projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      cancelled: false,
      message: "documents.json was not found.",
    };
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
  const document = documents.find((item) => item.id === queueItem.documentId);

  if (!document) {
    return {
      success: false,
      cancelled: false,
      message: "The imported document was not found.",
    };
  }

  if (!document.fileName.toLowerCase().endsWith(".pdf")) {
    return {
      success: false,
      cancelled: false,
      message: "Only PDF documents can be processed by the queue worker.",
    };
  }

  const exportFolder = path.join(projectPath, "Export");
  const logsFolder = path.join(projectPath, "Logs");
  fs.mkdirSync(exportFolder, { recursive: true });
  fs.mkdirSync(logsFolder, { recursive: true });

  const logPath = path.join(logsFolder, "ocr-run.log");
  const compression = queueItem.compression || "medium";
  const outputType = queueItem.outputType || "searchable_pdf";

  const compressionArgs =
    {
      low: ["--optimize", "1", "--jpeg-quality", "95", "--png-quality", "95"],
      medium: ["--optimize", "2", "--jpeg-quality", "85", "--png-quality", "85"],
      high: ["--optimize", "3", "--jpeg-quality", "65", "--png-quality", "65"],
      maximum: ["--optimize", "3", "--jpeg-quality", "45", "--png-quality", "45"],
    }[compression] ||
    ["--optimize", "2", "--jpeg-quality", "85", "--png-quality", "85"];

  const startedAt = new Date();
  const inputPath = document.destinationPath;
  const baseName = document.fileName.replace(/\.pdf$/i, "");
  const searchablePath = path.join(exportFolder, `${baseName}_searchable.pdf`);
  const compressedPath = path.join(
    exportFolder,
    `${baseName}_searchable_compressed.pdf`
  );
  const sidecarTxtPath = path.join(exportFolder, `${baseName}_ocr_text.txt`);

  for (const outputPath of [searchablePath, compressedPath, sidecarTxtPath]) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }

  updateDocumentStatus(projectPath, document.id, "Processing", {
    processingStartedAt: startedAt.toISOString(),
    failedAt: undefined,
    lastError: undefined,
  });

  broadcastToWindows("ocr:documentStatus", {
    documentId: document.id,
    status: "Processing",
  });

  const inputWslPath = windowsPathToWslPath(inputPath);
  const totalPages = await getPdfPageCount(inputWslPath);

  const runQueueSpawn = (command, args, label) =>
    new Promise((resolve) => {
      fs.appendFileSync(
        logPath,
        `\n\n${label}:\n${command} ${args.join(" ")}\n\n`,
        "utf-8"
      );

      const child = spawn(command, args, { windowsHide: true });
      activeOcrProcess = child;

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (activeOcrProcess === child) {
          activeOcrProcess = null;
        }
        resolve(result);
      };

      child.stdout.on("data", (chunk) => {
        fs.appendFileSync(logPath, chunk.toString(), "utf-8");
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        fs.appendFileSync(logPath, text, "utf-8");

        const pageMatch = text.match(/^\s*(\d+)\s+\[tesseract\]/m);

        if (pageMatch) {
          const currentPage = Number(pageMatch[1]);
          const percent =
            totalPages && currentPage
              ? Math.min(100, Math.round((currentPage / totalPages) * 100))
              : undefined;

          broadcastToWindows("ocr:progress", {
            fileName: document.fileName,
            currentPage,
            totalPages,
            percent,
            message: totalPages
              ? `Processing page ${currentPage} of ${totalPages} — ${percent}%`
              : `Processing page ${currentPage}`,
          });
        } else if (text.includes("Postprocessing")) {
          broadcastToWindows("ocr:progress", {
            fileName: document.fileName,
            message: "Postprocessing PDF...",
          });
        }
      });

      child.on("error", (error) => {
        fs.appendFileSync(
          logPath,
          `\nPROCESS ERROR: ${error.message}\n`,
          "utf-8"
        );
        finish({ code: -1, error: error.message });
      });

      child.on("close", (code) => {
        fs.appendFileSync(
          logPath,
          `\nPROCESS EXIT CODE: ${code}\n`,
          "utf-8"
        );
        finish({ code });
      });
    });

  broadcastToWindows("ocr:progress", {
    fileName: document.fileName,
    currentPage: 0,
    totalPages,
    percent: 0,
    message: totalPages
      ? `Starting queued OCR: 0 of ${totalPages} pages`
      : "Starting queued OCR...",
  });

  const ocrArgs = [
    "-d",
    "Ubuntu-24.04",
    "--",
    "ocrmypdf",
    "--force-ocr",
    "--deskew",
    "--oversample",
    "300",
    ...compressionArgs,
    "--output-type",
    "pdf",
    "-l",
    queueItem.language || "tel",
  ];

  if (outputType === "searchable_pdf_txt") {
    ocrArgs.push("--sidecar", windowsPathToWslPath(sidecarTxtPath));
  }

  ocrArgs.push(inputWslPath, windowsPathToWslPath(searchablePath));

  const ocrResult = await runQueueSpawn(
    "wsl.exe",
    ocrArgs,
    `QUEUED OCR COMMAND for ${document.fileName}`
  );

  if (queueStopRequests.has(projectPath)) {
    const endedAt = new Date();

    updateDocumentStatus(projectPath, document.id, "Cancelled", {
      lastError: "Queue processing was stopped.",
    });

    broadcastToWindows("ocr:documentStatus", {
      documentId: document.id,
      status: "Cancelled",
    });

    addOcrJob(projectPath, {
      id: Date.now() + Math.floor(Math.random() * 10000),
      documentId: document.id,
      fileName: document.fileName,
      status: "Cancelled",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      message: "Queue processing was stopped.",
    });

    return {
      success: false,
      cancelled: true,
      message: "Queue processing was stopped.",
    };
  }

  if (ocrResult.code !== 0 || !fs.existsSync(searchablePath)) {
    const endedAt = new Date();
    const message =
      ocrResult.error ||
      `OCR failed with exit code ${ocrResult.code} for ${document.fileName}.`;

    updateDocumentStatus(projectPath, document.id, "Failed", {
      failedAt: endedAt.toISOString(),
      lastError: message,
    });

    broadcastToWindows("ocr:documentStatus", {
      documentId: document.id,
      status: "Failed",
    });

    addOcrJob(projectPath, {
      id: Date.now() + Math.floor(Math.random() * 10000),
      documentId: document.id,
      fileName: document.fileName,
      status: "Failed",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      message,
    });

    return { success: false, cancelled: false, message };
  }

  const gsProfiles = {
    low: "/prepress",
    medium: "/ebook",
    high: "/screen",
    maximum: "/screen",
  };

  const gsArgs = [
    "-d",
    "Ubuntu-24.04",
    "--",
    "gs",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${gsProfiles[compression] || "/ebook"}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${windowsPathToWslPath(compressedPath)}`,
    windowsPathToWslPath(searchablePath),
  ];

  const gsResult = await runQueueSpawn(
    "wsl.exe",
    gsArgs,
    `QUEUED GHOSTSCRIPT COMMAND for ${document.fileName}`
  );

  if (queueStopRequests.has(projectPath)) {
    const endedAt = new Date();

    updateDocumentStatus(projectPath, document.id, "Cancelled", {
      lastError: "Queue processing was stopped.",
    });

    broadcastToWindows("ocr:documentStatus", {
      documentId: document.id,
      status: "Cancelled",
    });

    addOcrJob(projectPath, {
      id: Date.now() + Math.floor(Math.random() * 10000),
      documentId: document.id,
      fileName: document.fileName,
      status: "Cancelled",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      message: "Queue processing was stopped.",
    });

    return {
      success: false,
      cancelled: true,
      message: "Queue processing was stopped.",
    };
  }

  const finalPath =
    gsResult.code === 0 && fs.existsSync(compressedPath)
      ? compressedPath
      : searchablePath;

  const inputSize = fs.statSync(inputPath).size;
  const ocrSize = fs.statSync(searchablePath).size;
  const outputSize = fs.statSync(finalPath).size;
  const reductionPercent = ((inputSize - outputSize) / inputSize) * 100;
  const endedAt = new Date();

  updateDocumentStatus(projectPath, document.id, "Converted", {
    completedAt: endedAt.toISOString(),
    outputPath: finalPath,
    searchablePath,
    compressedPath: fs.existsSync(compressedPath)
      ? compressedPath
      : undefined,
    sidecarTxtPath: fs.existsSync(sidecarTxtPath)
      ? sidecarTxtPath
      : undefined,
    inputSize,
    outputSize,
    reductionPercent,
    lastError: undefined,
  });

  broadcastToWindows("ocr:documentStatus", {
    documentId: document.id,
    status: "Converted",
  });

  addOcrJob(projectPath, {
    id: Date.now() + Math.floor(Math.random() * 10000),
    documentId: document.id,
    fileName: document.fileName,
    status: "Completed",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    outputPath: finalPath,
    inputSize,
    ocrSize,
    outputSize,
    reductionPercent,
    sidecarTxtPath: fs.existsSync(sidecarTxtPath)
      ? sidecarTxtPath
      : undefined,
  });

  return {
    success: true,
    cancelled: false,
    message: `OCR completed for ${document.fileName}.`,
    outputPath: finalPath,
  };
}

async function runQueueWorker(projectPath) {
  if (activeQueueWorkers.has(projectPath)) {
    return activeQueueWorkers.get(projectPath);
  }

  queueStopRequests.delete(projectPath);

  const workerPromise = (async () => {
    broadcastQueueWorkerStatus(
      projectPath,
      "Running",
      "OCR queue worker started."
    );

    try {
      while (!queueStopRequests.has(projectPath)) {
        const queue = readOcrQueue(projectPath);
        const nextItem = [...queue]
          .filter((item) => item.status === "Waiting")
          .sort((a, b) => a.position - b.position)[0];

        if (!nextItem) {
          broadcastQueueWorkerStatus(
            projectPath,
            "Idle",
            "The OCR queue is complete."
          );
          break;
        }

        updateQueueItem(projectPath, nextItem.id, {
          status: "Processing",
          startedAt: new Date().toISOString(),
          completedAt: undefined,
          error: undefined,
          outputPath: undefined,
        });

        broadcastQueueWorkerStatus(
          projectPath,
          "Running",
          `Processing ${nextItem.fileName}`,
          nextItem.id
        );

        let result;

        try {
          result = await runQueuedDocument(projectPath, nextItem);
        } catch (error) {
          result = {
            success: false,
            cancelled: false,
            message:
              error instanceof Error ? error.message : String(error),
          };
        }

        if (result.cancelled || queueStopRequests.has(projectPath)) {
          updateQueueItem(projectPath, nextItem.id, {
            status: "Cancelled",
            completedAt: new Date().toISOString(),
            error: result.message,
          });
          break;
        }

        updateQueueItem(projectPath, nextItem.id, {
          status: result.success ? "Completed" : "Failed",
          completedAt: new Date().toISOString(),
          error: result.success ? undefined : result.message,
          outputPath: result.outputPath,
        });
      }
    } finally {
      const stopped = queueStopRequests.has(projectPath);
      activeQueueWorkers.delete(projectPath);
      queueStopRequests.delete(projectPath);

      broadcastQueueWorkerStatus(
        projectPath,
        stopped ? "Stopped" : "Idle",
        stopped
          ? "OCR queue worker stopped."
          : "OCR queue worker is idle."
      );
    }
  })();

  activeQueueWorkers.set(projectPath, workerPromise);
  return workerPromise;
}

ipcMain.handle("queue:start", async (_, data) => {
  const projectPath = data?.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: "Project path is required.",
      status: "Idle",
      queue: [],
    };
  }

  if (activeQueueWorkers.has(projectPath)) {
    return {
      success: false,
      message: "The OCR queue worker is already running.",
      status: "Running",
      queue: readOcrQueue(projectPath),
    };
  }

  const waitingCount = readOcrQueue(projectPath).filter(
    (item) => item.status === "Waiting"
  ).length;

  if (waitingCount === 0) {
    return {
      success: false,
      message: "There are no waiting queue items.",
      status: "Idle",
      queue: readOcrQueue(projectPath),
    };
  }

  // Do not await: the IPC call returns immediately while the worker continues.
  void runQueueWorker(projectPath);

  return {
    success: true,
    message: `Queue worker started for ${waitingCount} PDF(s).`,
    status: "Running",
    queue: readOcrQueue(projectPath),
  };
});

ipcMain.handle("queue:stop", async (_, data) => {
  const projectPath = data?.projectPath;

  if (!projectPath || !activeQueueWorkers.has(projectPath)) {
    return {
      success: false,
      message: "The OCR queue worker is not running.",
      status: "Idle",
      queue: projectPath ? readOcrQueue(projectPath) : [],
    };
  }

  queueStopRequests.add(projectPath);

  if (activeOcrProcess) {
    activeOcrProcess.kill("SIGTERM");
  }

  broadcastQueueWorkerStatus(
    projectPath,
    "Stopping",
    "Stopping the OCR queue after the active process exits."
  );

  return {
    success: true,
    message: "Queue stop requested.",
    status: "Stopping",
    queue: readOcrQueue(projectPath),
  };
});

ipcMain.handle("queue:status", async (_, data) => {
  const projectPath = data?.projectPath;
  const isRunning = Boolean(
    projectPath && activeQueueWorkers.has(projectPath)
  );

  return {
    status: isRunning ? "Running" : "Idle",
    running: isRunning,
    queue: projectPath ? readOcrQueue(projectPath) : [],
  };
});


ipcMain.handle("queue:list", async (_, data) => {
  return readOcrQueue(data.projectPath);
});

ipcMain.handle("queue:add", async (_, data) => {
  const documentsPath = path.join(data.projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "No imported documents found.",
      queue: [],
    };
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );

  const documentIds = Array.isArray(data.documentIds)
    ? data.documentIds
    : [];

  const selectedDocuments = documents.filter(
    (document) =>
      documentIds.includes(document.id) &&
      document.fileName.toLowerCase().endsWith(".pdf")
  );

  if (selectedDocuments.length === 0) {
    return {
      success: false,
      message: "No PDF documents were selected.",
      queue: readOcrQueue(data.projectPath),
    };
  }

  const currentQueue = readOcrQueue(data.projectPath);

  const queuedDocumentIds = new Set(
    currentQueue
      .filter((item) =>
        ["Waiting", "Processing"].includes(item.status)
      )
      .map((item) => item.documentId)
  );

  const newItems = selectedDocuments
    .filter((document) => !queuedDocumentIds.has(document.id))
    .map((document, index) => ({
      id:
        Date.now() +
        index +
        Math.floor(Math.random() * 1000),

      documentId: document.id,
      fileName: document.fileName,
      inputPath: document.destinationPath,

      status: "Waiting",
      position: currentQueue.length + index + 1,

      language: data.language || "tel",
      compression: data.compression || "medium",
      outputType: data.outputType || "searchable_pdf",

      addedAt: new Date().toISOString(),
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
      outputPath: undefined,
    }));

  const updatedQueue = [...currentQueue, ...newItems];

  saveOcrQueue(data.projectPath, updatedQueue);

  return {
    success: true,
    message: `${newItems.length} PDF(s) added to the OCR queue.`,
    queue: updatedQueue,
  };
});

ipcMain.handle("queue:remove", async (_, data) => {
  const currentQueue = readOcrQueue(data.projectPath);

  const target = currentQueue.find(
    (item) => item.id === data.queueItemId
  );

  if (target?.status === "Processing") {
    return {
      success: false,
      message: "A processing queue item cannot be removed.",
      queue: currentQueue,
    };
  }

  const updatedQueue = currentQueue
    .filter((item) => item.id !== data.queueItemId)
    .map((item, index) => ({
      ...item,
      position: index + 1,
    }));

  saveOcrQueue(data.projectPath, updatedQueue);

  return {
    success: true,
    message: "Queue item removed.",
    queue: updatedQueue,
  };
});

ipcMain.handle("queue:clearCompleted", async (_, data) => {
  const updatedQueue = readOcrQueue(data.projectPath)
    .filter(
      (item) =>
        !["Completed", "Failed", "Cancelled"].includes(
          item.status
        )
    )
    .map((item, index) => ({
      ...item,
      position: index + 1,
    }));

  saveOcrQueue(data.projectPath, updatedQueue);

  return updatedQueue;
});


ipcMain.handle("pdf:readFile", async (_, data) => {
  const filePath = data?.filePath;

  if (!filePath) {
    return {
      success: false,
      message: "PDF file path is required.",
      data: null,
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      message: "The PDF file does not exist.",
      data: null,
    };
  }

  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    return {
      success: false,
      message: "Only PDF files can be previewed.",
      data: null,
    };
  }

  try {
    const bytes = await fs.promises.readFile(filePath);

    return {
      success: true,
      message: "PDF loaded.",
      data: bytes,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Could not read the PDF file.",
      data: null,
    };
  }
});


function runPreviewCommand(command, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The process may already have exited.
      }

      finish({
        code: -2,
        stdout,
        stderr:
          `PDF preview command timed out after ${Math.round(
            timeoutMs / 1000
          )} seconds.\n` + stderr,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      finish({
        code: -1,
        stdout,
        stderr: error.message,
      });
    });

    child.on("close", (code) => {
      finish({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

async function getPdfPreviewInfo(filePath) {
  const wslPath = windowsPathToWslPath(filePath);

  const result = await runPreviewCommand(
    "wsl.exe",
    [
      "-d",
      "Ubuntu-24.04",
      "--",
      "pdfinfo",
      wslPath,
    ],
    15000
  );

  if (result.code !== 0) {
    throw new Error(
      result.stderr || `pdfinfo failed with exit code ${result.code}.`
    );
  }

  const pageMatch = result.stdout.match(/^Pages:\s+(\d+)/mi);
  const sizeMatch = result.stdout.match(
    /^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/mi
  );

  return {
    pageCount: pageMatch ? Number(pageMatch[1]) : 0,
    pageWidth: sizeMatch ? Number(sizeMatch[1]) : undefined,
    pageHeight: sizeMatch ? Number(sizeMatch[2]) : undefined,
  };
}

async function renderPdfPreviewPage(filePath, pageNumber, scalePercent = 100) {
  const safePageNumber = Math.max(1, Number(pageNumber) || 1);
  const safeScale = Math.min(200, Math.max(50, Number(scalePercent) || 100));
  const dpi = Math.round(110 * (safeScale / 100));

  const cacheRoot = path.join(app.getPath("temp"), "ocr-studio-pdf-preview");
  const cacheKey = crypto
    .createHash("sha1")
    .update(`${path.resolve(filePath)}|${safePageNumber}|${dpi}`)
    .digest("hex");

  const cacheFolder = path.join(cacheRoot, cacheKey);
  const outputPrefix = path.join(cacheFolder, "page");
  const outputPng = `${outputPrefix}.png`;

  fs.mkdirSync(cacheFolder, { recursive: true });

  if (!fs.existsSync(outputPng)) {
    const result = await runPreviewCommand("wsl.exe", [
      "-d",
      "Ubuntu-24.04",
      "--",
      "pdftoppm",
      "-f",
      String(safePageNumber),
      "-l",
      String(safePageNumber),
      "-singlefile",
      "-png",
      "-r",
      String(dpi),
      windowsPathToWslPath(filePath),
      windowsPathToWslPath(outputPrefix),
    ], 60000);

    if (result.code !== 0 || !fs.existsSync(outputPng)) {
      throw new Error(
        result.stderr ||
          `pdftoppm failed with exit code ${result.code}.`
      );
    }
  }

  const image = await fs.promises.readFile(outputPng);

  return {
    dataUrl: `data:image/png;base64,${image.toString("base64")}`,
    pageNumber: safePageNumber,
    scalePercent: safeScale,
  };
}


const activeConfidenceScans = new Map();
const confidenceScanCancelRequests = new Set();

function getPageConfidencePath(projectPath) {
  return path.join(projectPath, "ocr-page-confidence.json");
}

function readPageConfidence(projectPath) {
  const confidencePath = getPageConfidencePath(projectPath);

  if (!fs.existsSync(confidencePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(confidencePath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePageConfidence(projectPath, records) {
  fs.writeFileSync(
    getPageConfidencePath(projectPath),
    JSON.stringify(records, null, 2),
    "utf-8"
  );
}

function upsertPageConfidence(projectPath, record) {
  const records = readPageConfidence(projectPath);
  const next = [
    ...records.filter(
      (item) =>
        !(
          item.documentId === record.documentId &&
          item.pageNumber === record.pageNumber
        )
    ),
    record,
  ].sort(
    (a, b) =>
      a.documentId - b.documentId ||
      a.pageNumber - b.pageNumber
  );

  savePageConfidence(projectPath, next);
  return next;
}

function parseTesseractTsv(tsvText) {
  const lines = String(tsvText || "").split(/\r?\n/);
  const words = [];

  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split("\t");

    if (columns.length < 12) continue;

    const confidence = Number(columns[10]);
    const text = columns.slice(11).join("\t").trim();

    if (!text || !Number.isFinite(confidence) || confidence < 0) {
      continue;
    }

    words.push({
      text,
      confidence,
    });
  }

  const validConfidences = words.map((word) => word.confidence);
  const averageConfidence =
    validConfidences.length > 0
      ? validConfidences.reduce((sum, value) => sum + value, 0) /
        validConfidences.length
      : 0;

  const lowConfidenceWords = words.filter(
    (word) => word.confidence < 60
  );

  const veryLowConfidenceWords = words.filter(
    (word) => word.confidence < 35
  );

  return {
    wordCount: words.length,
    averageConfidence: Number(averageConfidence.toFixed(1)),
    lowConfidenceWordCount: lowConfidenceWords.length,
    veryLowConfidenceWordCount: veryLowConfidenceWords.length,
    suspiciousWords: lowConfidenceWords
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 25),
  };
}

function getConfidenceLabel(confidence) {
  if (confidence >= 85) return "Excellent";
  if (confidence >= 75) return "Good";
  if (confidence >= 60) return "Review";
  return "Poor";
}

function buildQuickScanPages(pageCount, maximumPages = 20) {
  if (pageCount <= maximumPages) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount]);

  for (let index = 0; index < maximumPages; index += 1) {
    const ratio = index / Math.max(1, maximumPages - 1);
    pages.add(Math.max(1, Math.round(1 + ratio * (pageCount - 1))));
  }

  return [...pages].sort((a, b) => a - b);
}

async function analyzeConfidencePage({
  projectPath,
  documentId,
  filePath,
  fileName,
  pageNumber,
  language,
}) {
  const cacheRoot = path.join(
    app.getPath("temp"),
    "ocr-studio-confidence"
  );
  const documentFolder = path.join(
    cacheRoot,
    String(documentId)
  );

  fs.mkdirSync(documentFolder, { recursive: true });

  const outputPrefix = path.join(
    documentFolder,
    `page-${pageNumber}`
  );
  const imagePath = `${outputPrefix}.png`;

  try {
    if (!fs.existsSync(imagePath)) {
      const renderResult = await runPreviewCommand(
        "wsl.exe",
        [
          "-d",
          "Ubuntu-24.04",
          "--",
          "pdftoppm",
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          "-singlefile",
          "-png",
          "-r",
          "180",
          windowsPathToWslPath(filePath),
          windowsPathToWslPath(outputPrefix),
        ],
        90000
      );

      if (renderResult.code !== 0 || !fs.existsSync(imagePath)) {
        throw new Error(
          renderResult.stderr ||
            `Could not render page ${pageNumber}.`
        );
      }
    }

    const tesseractResult = await runPreviewCommand(
      "wsl.exe",
      [
        "-d",
        "Ubuntu-24.04",
        "--",
        "tesseract",
        windowsPathToWslPath(imagePath),
        "stdout",
        "-l",
        language || "tel",
        "--psm",
        "6",
        "tsv",
      ],
      120000
    );

    if (tesseractResult.code !== 0) {
      throw new Error(
        tesseractResult.stderr ||
          `Tesseract failed on page ${pageNumber}.`
      );
    }

    const metrics = parseTesseractTsv(tesseractResult.stdout);
    const record = {
      documentId,
      fileName,
      pageNumber,
      language: language || "tel",
      confidence: metrics.averageConfidence,
      confidenceLabel: getConfidenceLabel(
        metrics.averageConfidence
      ),
      wordCount: metrics.wordCount,
      lowConfidenceWordCount:
        metrics.lowConfidenceWordCount,
      veryLowConfidenceWordCount:
        metrics.veryLowConfidenceWordCount,
      suspiciousWords: metrics.suspiciousWords,
      status: "Completed",
      analyzedAt: new Date().toISOString(),
    };

    upsertPageConfidence(projectPath, record);
    return record;
  } finally {
    try {
      fs.rmSync(imagePath, { force: true });
    } catch {
      // Temporary image cleanup is best effort.
    }
  }
}


const activeWordIndexJobs = new Map();
const wordIndexCancelRequests = new Set();

function getWordIndexRoot(projectPath) {
  return path.join(projectPath, "ocr-word-index");
}

function getWordIndexManifestPath(projectPath) {
  return path.join(getWordIndexRoot(projectPath), "manifest.json");
}

function getWordIndexDocumentFolder(projectPath, documentId) {
  return path.join(getWordIndexRoot(projectPath), String(documentId));
}

function getWordIndexPagePath(projectPath, documentId, pageNumber) {
  return path.join(
    getWordIndexDocumentFolder(projectPath, documentId),
    `page-${String(pageNumber).padStart(6, "0")}.json`
  );
}

function readWordIndexManifest(projectPath) {
  const manifestPath = getWordIndexManifestPath(projectPath);

  if (!fs.existsSync(manifestPath)) {
    return {
      version: 1,
      documents: [],
      updatedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    return {
      version: 1,
      documents: Array.isArray(parsed?.documents)
        ? parsed.documents
        : [],
      updatedAt: parsed?.updatedAt || null,
    };
  } catch {
    return {
      version: 1,
      documents: [],
      updatedAt: null,
    };
  }
}

function saveWordIndexManifest(projectPath, manifest) {
  const root = getWordIndexRoot(projectPath);
  fs.mkdirSync(root, { recursive: true });

  fs.writeFileSync(
    getWordIndexManifestPath(projectPath),
    JSON.stringify(
      {
        version: 1,
        documents: manifest.documents || [],
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

function upsertWordIndexManifestDocument(projectPath, documentRecord) {
  const manifest = readWordIndexManifest(projectPath);
  const documents = [
    ...manifest.documents.filter(
      (item) => item.documentId !== documentRecord.documentId
    ),
    documentRecord,
  ].sort((a, b) => a.documentId - b.documentId);

  saveWordIndexManifest(projectPath, {
    ...manifest,
    documents,
  });

  return readWordIndexManifest(projectPath);
}

function parseTesseractWordRows(tsvText, pageNumber) {
  const lines = String(tsvText || "").split(/\r?\n/);
  const words = [];

  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split("\t");

    if (columns.length < 12) continue;

    const level = Number(columns[0]);
    const confidence = Number(columns[10]);
    const text = columns.slice(11).join("\t").trim();

    if (
      level !== 5 ||
      !text ||
      !Number.isFinite(confidence) ||
      confidence < 0
    ) {
      continue;
    }

    const left = Number(columns[6]);
    const top = Number(columns[7]);
    const width = Number(columns[8]);
    const height = Number(columns[9]);

    words.push({
      id: `${pageNumber}-${columns[2]}-${columns[3]}-${columns[4]}-${columns[5]}-${index}`,
      pageNumber,
      blockNumber: Number(columns[2]) || 0,
      paragraphNumber: Number(columns[3]) || 0,
      lineNumber: Number(columns[4]) || 0,
      wordNumber: Number(columns[5]) || 0,
      text,
      confidence: Number(confidence.toFixed(1)),
      box: {
        left: Number.isFinite(left) ? left : 0,
        top: Number.isFinite(top) ? top : 0,
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
      },
      status: "Unreviewed",
      correctedText: null,
      verifiedAt: null,
    });
  }

  return words;
}

function summarizeWordIndexPage(words) {
  const totalWords = words.length;
  const lowConfidenceWords = words.filter(
    (word) => word.confidence < 60
  ).length;
  const veryLowConfidenceWords = words.filter(
    (word) => word.confidence < 35
  ).length;
  const averageConfidence =
    totalWords > 0
      ? words.reduce(
          (sum, word) => sum + word.confidence,
          0
        ) / totalWords
      : 0;

  return {
    totalWords,
    lowConfidenceWords,
    veryLowConfidenceWords,
    averageConfidence: Number(averageConfidence.toFixed(1)),
  };
}

function writeWordIndexPage({
  projectPath,
  documentId,
  pageNumber,
  sourceFile,
  language,
  imageWidth,
  imageHeight,
  words,
}) {
  const folder = getWordIndexDocumentFolder(
    projectPath,
    documentId
  );
  fs.mkdirSync(folder, { recursive: true });

  const payload = {
    version: 1,
    documentId,
    pageNumber,
    sourceFile,
    language,
    imageWidth,
    imageHeight,
    indexedAt: new Date().toISOString(),
    summary: summarizeWordIndexPage(words),
    words,
  };

  fs.writeFileSync(
    getWordIndexPagePath(
      projectPath,
      documentId,
      pageNumber
    ),
    JSON.stringify(payload),
    "utf-8"
  );

  return payload;
}

function readWordIndexPage(
  projectPath,
  documentId,
  pageNumber
) {
  const pagePath = getWordIndexPagePath(
    projectPath,
    documentId,
    pageNumber
  );

  if (!fs.existsSync(pagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(pagePath, "utf-8"));
  } catch {
    return null;
  }
}

function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG"
  ) {
    return {
      width: 0,
      height: 0,
    };
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function indexWordsForPage({
  projectPath,
  documentId,
  filePath,
  fileName,
  pageNumber,
  language,
}) {
  const cacheRoot = path.join(
    app.getPath("temp"),
    "ocr-studio-word-index"
  );
  const documentFolder = path.join(
    cacheRoot,
    String(documentId)
  );

  fs.mkdirSync(documentFolder, { recursive: true });

  const outputPrefix = path.join(
    documentFolder,
    `page-${pageNumber}`
  );
  const imagePath = `${outputPrefix}.png`;

  try {
    const renderResult = await runPreviewCommand(
      "wsl.exe",
      [
        "-d",
        "Ubuntu-24.04",
        "--",
        "pdftoppm",
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-png",
        "-r",
        "180",
        windowsPathToWslPath(filePath),
        windowsPathToWslPath(outputPrefix),
      ],
      90000
    );

    if (renderResult.code !== 0 || !fs.existsSync(imagePath)) {
      throw new Error(
        renderResult.stderr ||
          `Could not render page ${pageNumber}.`
      );
    }

    const dimensions = getPngDimensions(imagePath);

    const tesseractResult = await runPreviewCommand(
      "wsl.exe",
      [
        "-d",
        "Ubuntu-24.04",
        "--",
        "tesseract",
        windowsPathToWslPath(imagePath),
        "stdout",
        "-l",
        language || "tel",
        "--psm",
        "6",
        "tsv",
      ],
      120000
    );

    if (tesseractResult.code !== 0) {
      throw new Error(
        tesseractResult.stderr ||
          `Tesseract failed on page ${pageNumber}.`
      );
    }

    const words = parseTesseractWordRows(
      tesseractResult.stdout,
      pageNumber
    );

    return writeWordIndexPage({
      projectPath,
      documentId,
      pageNumber,
      sourceFile: fileName,
      language: language || "tel",
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
      words,
    });
  } finally {
    try {
      fs.rmSync(imagePath, { force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
}

ipcMain.handle("wordIndex:getManifest", async (_, data) => {
  return readWordIndexManifest(data?.projectPath);
});

ipcMain.handle("wordIndex:getPage", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);
  const pageNumber = Number(data?.pageNumber);

  if (
    !projectPath ||
    !Number.isFinite(documentId) ||
    !Number.isFinite(pageNumber)
  ) {
    return null;
  }

  return readWordIndexPage(
    projectPath,
    documentId,
    pageNumber
  );
});

ipcMain.handle("wordIndex:clear", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);

  if (!projectPath || !Number.isFinite(documentId)) {
    return readWordIndexManifest(projectPath);
  }

  const folder = getWordIndexDocumentFolder(
    projectPath,
    documentId
  );

  try {
    fs.rmSync(folder, {
      recursive: true,
      force: true,
    });
  } catch {
    // Best-effort cleanup.
  }

  const manifest = readWordIndexManifest(projectPath);
  const documents = manifest.documents.filter(
    (item) => item.documentId !== documentId
  );

  saveWordIndexManifest(projectPath, {
    ...manifest,
    documents,
  });

  return readWordIndexManifest(projectPath);
});

ipcMain.handle("wordIndex:cancel", async (_, data) => {
  const projectPath = data?.projectPath;

  if (!projectPath || !activeWordIndexJobs.has(projectPath)) {
    return {
      success: false,
      message: "No word-index job is running.",
    };
  }

  wordIndexCancelRequests.add(projectPath);

  return {
    success: true,
    message: "Word-index cancellation requested.",
  };
});

async function runWordIndexBuildDirect(data) {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);
  const mode = data?.mode === "full" ? "full" : "quick";
  const language = data?.language || "tel";

  if (!projectPath || !Number.isFinite(documentId)) {
    return {
      success: false,
      message: "Project path and document are required.",
      manifest: readWordIndexManifest(projectPath),
    };
  }

  if (activeWordIndexJobs.has(projectPath)) {
    return {
      success: false,
      message: "A word-index job is already running.",
      manifest: readWordIndexManifest(projectPath),
    };
  }

  const documentsPath = path.join(projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "documents.json was not found.",
      manifest: readWordIndexManifest(projectPath),
    };
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );
  const document = documents.find(
    (item) => item.id === documentId
  );

  if (!document) {
    return {
      success: false,
      message: "The selected document was not found.",
      manifest: readWordIndexManifest(projectPath),
    };
  }

  const filePath =
    document.outputPath ||
    document.compressedPath ||
    document.searchablePath ||
    document.destinationPath;

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: false,
      message: "The selected PDF file was not found.",
      manifest: readWordIndexManifest(projectPath),
    };
  }

  wordIndexCancelRequests.delete(projectPath);

  const jobPromise = (async () => {
    const startedAt = new Date().toISOString();
    const completedPages = [];
    const failedPages = [];

    try {
      const info = await getPdfPreviewInfo(filePath);

      if (!info.pageCount) {
        throw new Error("Could not determine the PDF page count.");
      }

      const pages =
        mode === "full"
          ? Array.from(
              { length: info.pageCount },
              (_, index) => index + 1
            )
          : buildQuickScanPages(info.pageCount, 20);

      for (let index = 0; index < pages.length; index += 1) {
        if (wordIndexCancelRequests.has(projectPath)) {
          break;
        }

        const pageNumber = pages[index];

        broadcastToWindows("wordIndex:progress", {
          projectPath,
          documentId,
          fileName: document.fileName,
          pageNumber,
          current: index + 1,
          total: pages.length,
          percent: Math.round(
            (index / Math.max(1, pages.length)) * 100
          ),
          message:
            `Building word database for page ${pageNumber} ` +
            `(${index + 1} of ${pages.length})`,
        });

        try {
          const pageData = await indexWordsForPage({
            projectPath,
            documentId,
            filePath,
            fileName: document.fileName,
            pageNumber,
            language,
          });

          completedPages.push({
            pageNumber,
            ...pageData.summary,
          });
        } catch (error) {
          failedPages.push({
            pageNumber,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          });
        }
      }

      const cancelled =
        wordIndexCancelRequests.has(projectPath);

      const totalWords = completedPages.reduce(
        (sum, page) => sum + page.totalWords,
        0
      );
      const lowConfidenceWords = completedPages.reduce(
        (sum, page) => sum + page.lowConfidenceWords,
        0
      );
      const veryLowConfidenceWords = completedPages.reduce(
        (sum, page) => sum + page.veryLowConfidenceWords,
        0
      );
      const weightedConfidence =
        totalWords > 0
          ? completedPages.reduce(
              (sum, page) =>
                sum +
                page.averageConfidence * page.totalWords,
              0
            ) / totalWords
          : 0;

      const documentRecord = {
        documentId,
        fileName: document.fileName,
        language,
        mode,
        pageCount: info.pageCount,
        indexedPageCount: completedPages.length,
        failedPageCount: failedPages.length,
        indexedPages: completedPages.map(
          (page) => page.pageNumber
        ),
        failedPages,
        totalWords,
        lowConfidenceWords,
        veryLowConfidenceWords,
        averageConfidence: Number(
          weightedConfidence.toFixed(1)
        ),
        startedAt,
        completedAt: new Date().toISOString(),
        status: cancelled
          ? "Cancelled"
          : failedPages.length > 0
            ? "CompletedWithErrors"
            : "Completed",
      };

      const manifest =
        upsertWordIndexManifestDocument(
          projectPath,
          documentRecord
        );

      broadcastToWindows("wordIndex:progress", {
        projectPath,
        documentId,
        fileName: document.fileName,
        pageNumber:
          completedPages.at(-1)?.pageNumber || 1,
        current:
          completedPages.length + failedPages.length,
        total: pages.length,
        percent: cancelled ? undefined : 100,
        message: cancelled
          ? "Word database build cancelled."
          : `Word database ready: ${totalWords.toLocaleString()} words indexed.`,
      });

      return {
        success: !cancelled,
        cancelled,
        message: cancelled
          ? "Word database build cancelled."
          : `Indexed ${totalWords.toLocaleString()} words across ${completedPages.length} page(s).`,
        manifest,
      };
    } finally {
      activeWordIndexJobs.delete(projectPath);
      wordIndexCancelRequests.delete(projectPath);
    }
  })();

  activeWordIndexJobs.set(projectPath, jobPromise);
  return jobPromise;
}


const wordIndexQueueWorkers = new Map();
const wordIndexQueueCancelRequests = new Set();
const recoveredWordIndexQueues = new Set();

function getWordIndexQueuePath(projectPath) {
  return path.join(projectPath, "word-index-jobs.json");
}

function readWordIndexQueue(projectPath) {
  if (!projectPath) return [];

  const queuePath = getWordIndexQueuePath(projectPath);

  if (!fs.existsSync(queuePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    const jobs = Array.isArray(parsed) ? parsed : [];

    // Recover interrupted jobs only once per project during this Electron
    // process. Normal queue reads must preserve the active Running state.
    if (!recoveredWordIndexQueues.has(projectPath)) {
      recoveredWordIndexQueues.add(projectPath);

      let changed = false;
      const recovered = jobs.map((job) => {
        if (job.status === "Running") {
          changed = true;
          return {
            ...job,
            status: "Queued",
            message: "Recovered after OCR Studio restart.",
            startedAt: null,
            updatedAt: new Date().toISOString(),
          };
        }
        return job;
      });

      if (changed) {
        saveWordIndexQueue(projectPath, recovered);
      }

      return recovered;
    }

    return jobs;
  } catch {
    return [];
  }
}

function saveWordIndexQueue(projectPath, jobs) {
  if (!projectPath) return;

  fs.writeFileSync(
    getWordIndexQueuePath(projectPath),
    JSON.stringify(jobs, null, 2),
    "utf-8"
  );
}

function updateWordIndexQueueJob(projectPath, jobId, patch) {
  const jobs = readWordIndexQueue(projectPath);
  const updated = jobs.map((job) =>
    job.id === jobId
      ? {
          ...job,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
      : job
  );

  saveWordIndexQueue(projectPath, updated);
  broadcastToWindows("wordIndexQueue:updated", {
    projectPath,
    jobs: updated,
  });

  return updated.find((job) => job.id === jobId) || null;
}

function emitWordIndexQueue(projectPath) {
  const jobs = readWordIndexQueue(projectPath);
  broadcastToWindows("wordIndexQueue:updated", {
    projectPath,
    jobs,
  });
  return jobs;
}

function createWordIndexJobId() {
  return `word-index-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

async function runNextWordIndexQueueJob(projectPath) {
  if (!projectPath || wordIndexQueueWorkers.has(projectPath)) {
    return;
  }

  const workerPromise = (async () => {
    try {
      while (true) {
        const jobs = readWordIndexQueue(projectPath);
        const nextJob = jobs.find((job) => job.status === "Queued");

        if (!nextJob) break;

        wordIndexQueueCancelRequests.delete(nextJob.id);

        updateWordIndexQueueJob(projectPath, nextJob.id, {
          status: "Running",
          progress: 0,
          currentPage: 0,
          totalPages: 0,
          message: "Preparing word-index job...",
          startedAt: new Date().toISOString(),
          completedAt: null,
          error: null,
        });

        const progressListener = (_event, payload) => {
          if (
            payload?.projectPath !== projectPath ||
            payload?.documentId !== nextJob.documentId
          ) {
            return;
          }

          updateWordIndexQueueJob(projectPath, nextJob.id, {
            progress:
              typeof payload.percent === "number"
                ? payload.percent
                : undefined,
            currentPage: payload.current || 0,
            totalPages: payload.total || 0,
            pageNumber: payload.pageNumber || 0,
            message: payload.message || "Indexing...",
          });
        };

        // The direct worker already broadcasts progress. Queue updates are
        // mirrored by temporarily observing BrowserWindow messages through
        // a lightweight callback registered below.
        wordIndexQueueProgressObservers.set(
          `${projectPath}:${nextJob.documentId}`,
          progressListener
        );

        try {
          const result = await runWordIndexBuildDirect({
            projectPath,
            documentId: nextJob.documentId,
            language: nextJob.language,
            mode: nextJob.mode,
          });

          const cancelled =
            result?.cancelled ||
            wordIndexQueueCancelRequests.has(nextJob.id);

          updateWordIndexQueueJob(projectPath, nextJob.id, {
            status: cancelled
              ? "Cancelled"
              : result?.success
                ? "Completed"
                : "Failed",
            progress: cancelled ? nextJob.progress || 0 : 100,
            message:
              result?.message ||
              (cancelled
                ? "Word-index job cancelled."
                : "Word-index job finished."),
            completedAt: new Date().toISOString(),
            error:
              !cancelled && !result?.success
                ? result?.message || "Word-index job failed."
                : null,
          });
        } catch (error) {
          updateWordIndexQueueJob(projectPath, nextJob.id, {
            status: wordIndexQueueCancelRequests.has(nextJob.id)
              ? "Cancelled"
              : "Failed",
            message: wordIndexQueueCancelRequests.has(nextJob.id)
              ? "Word-index job cancelled."
              : "Word-index job failed.",
            completedAt: new Date().toISOString(),
            error:
              error instanceof Error
                ? error.message
                : String(error),
          });
        } finally {
          wordIndexQueueProgressObservers.delete(
            `${projectPath}:${nextJob.documentId}`
          );
          wordIndexQueueCancelRequests.delete(nextJob.id);
        }
      }
    } finally {
      wordIndexQueueWorkers.delete(projectPath);
      emitWordIndexQueue(projectPath);
    }
  })();

  wordIndexQueueWorkers.set(projectPath, workerPromise);
}

const wordIndexQueueProgressObservers = new Map();

function notifyWordIndexQueueProgress(payload) {
  const observer = wordIndexQueueProgressObservers.get(
    `${payload?.projectPath}:${payload?.documentId}`
  );

  if (observer) {
    observer(null, payload);
  }
}

ipcMain.handle("wordIndexQueue:list", async (_, data) => {
  const projectPath = data?.projectPath;
  const jobs = readWordIndexQueue(projectPath);
  void runNextWordIndexQueueJob(projectPath);
  return jobs;
});

ipcMain.handle("wordIndexQueue:enqueue", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);
  const mode = data?.mode === "full" ? "full" : "quick";
  const language = data?.language || "tel";

  if (!projectPath || !Number.isFinite(documentId)) {
    return {
      success: false,
      message: "Project path and document are required.",
      jobs: readWordIndexQueue(projectPath),
    };
  }

  const documentsPath = path.join(projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "documents.json was not found.",
      jobs: readWordIndexQueue(projectPath),
    };
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );
  const document = documents.find(
    (item) => item.id === documentId
  );

  if (!document) {
    return {
      success: false,
      message: "The selected document was not found.",
      jobs: readWordIndexQueue(projectPath),
    };
  }

  const jobs = readWordIndexQueue(projectPath);
  const duplicate = jobs.find(
    (job) =>
      job.documentId === documentId &&
      job.mode === mode &&
      (job.status === "Queued" || job.status === "Running")
  );

  if (duplicate) {
    return {
      success: false,
      message: "This word-index job is already queued or running.",
      jobs,
    };
  }

  const now = new Date().toISOString();
  const job = {
    id: createWordIndexJobId(),
    type: "WordIndex",
    documentId,
    fileName: document.fileName,
    mode,
    language,
    status: "Queued",
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    pageNumber: 0,
    message: "Waiting for background worker.",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
    attempt: 1,
  };

  const updated = [...jobs, job];
  saveWordIndexQueue(projectPath, updated);
  emitWordIndexQueue(projectPath);
  void runNextWordIndexQueueJob(projectPath);

  return {
    success: true,
    message: "Word-index job added to the background queue.",
    job,
    jobs: updated,
  };
});

ipcMain.handle("wordIndexQueue:cancel", async (_, data) => {
  const projectPath = data?.projectPath;
  const jobId = data?.jobId;
  const jobs = readWordIndexQueue(projectPath);
  const job = jobs.find((item) => item.id === jobId);

  if (!job) {
    return {
      success: false,
      message: "The background job was not found.",
      jobs,
    };
  }

  if (job.status === "Queued") {
    updateWordIndexQueueJob(projectPath, jobId, {
      status: "Cancelled",
      message: "Cancelled before starting.",
      completedAt: new Date().toISOString(),
    });
  } else if (job.status === "Running") {
    wordIndexQueueCancelRequests.add(jobId);
    wordIndexCancelRequests.add(projectPath);
    updateWordIndexQueueJob(projectPath, jobId, {
      message: "Cancellation requested...",
    });
  }

  return {
    success: true,
    message: "Cancellation requested.",
    jobs: readWordIndexQueue(projectPath),
  };
});

ipcMain.handle("wordIndexQueue:retry", async (_, data) => {
  const projectPath = data?.projectPath;
  const jobId = data?.jobId;
  const jobs = readWordIndexQueue(projectPath);
  const job = jobs.find((item) => item.id === jobId);

  if (!job || !["Failed", "Cancelled"].includes(job.status)) {
    return {
      success: false,
      message: "Only failed or cancelled jobs can be retried.",
      jobs,
    };
  }

  updateWordIndexQueueJob(projectPath, jobId, {
    status: "Queued",
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    pageNumber: 0,
    message: "Waiting to retry.",
    startedAt: null,
    completedAt: null,
    error: null,
    attempt: (job.attempt || 1) + 1,
  });

  void runNextWordIndexQueueJob(projectPath);

  return {
    success: true,
    message: "Job queued for retry.",
    jobs: readWordIndexQueue(projectPath),
  };
});

ipcMain.handle("wordIndexQueue:remove", async (_, data) => {
  const projectPath = data?.projectPath;
  const jobId = data?.jobId;
  const jobs = readWordIndexQueue(projectPath);
  const job = jobs.find((item) => item.id === jobId);

  if (job?.status === "Running") {
    return {
      success: false,
      message: "Cancel a running job before removing it.",
      jobs,
    };
  }

  const updated = jobs.filter((item) => item.id !== jobId);
  saveWordIndexQueue(projectPath, updated);
  emitWordIndexQueue(projectPath);

  return {
    success: true,
    message: "Job removed.",
    jobs: updated,
  };
});

// Keep the existing Review action compatible, but enqueue instead of waiting
// for the entire PDF to finish.
ipcMain.handle("wordIndex:build", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);
  const mode = data?.mode === "full" ? "full" : "quick";
  const language = data?.language || "tel";

  const documentsPath = path.join(projectPath, "documents.json");
  if (!projectPath || !Number.isFinite(documentId) || !fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "Project path and document are required.",
      manifest: readWordIndexManifest(projectPath),
      queued: false,
    };
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
  const document = documents.find((item) => item.id === documentId);
  if (!document) {
    return {
      success: false,
      message: "The selected document was not found.",
      manifest: readWordIndexManifest(projectPath),
      queued: false,
    };
  }

  const jobs = readWordIndexQueue(projectPath);
  const duplicate = jobs.find(
    (job) =>
      job.documentId === documentId &&
      job.mode === mode &&
      (job.status === "Queued" || job.status === "Running")
  );

  if (!duplicate) {
    const now = new Date().toISOString();
    jobs.push({
      id: createWordIndexJobId(),
      type: "WordIndex",
      documentId,
      fileName: document.fileName,
      mode,
      language,
      status: "Queued",
      progress: 0,
      currentPage: 0,
      totalPages: 0,
      pageNumber: 0,
      message: "Waiting for background worker.",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      attempt: 1,
    });
    saveWordIndexQueue(projectPath, jobs);
    emitWordIndexQueue(projectPath);
  }

  void runNextWordIndexQueueJob(projectPath);

  return {
    success: true,
    message: duplicate
      ? "This word-index job is already queued or running."
      : "Word-index job added to the background queue.",
    manifest: readWordIndexManifest(projectPath),
    queued: true,
  };
});


ipcMain.handle("confidence:list", async (_, data) => {
  return readPageConfidence(data?.projectPath);
});

ipcMain.handle("confidence:clear", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);

  if (!projectPath) {
    return [];
  }

  const remaining = readPageConfidence(projectPath).filter(
    (item) =>
      !Number.isFinite(documentId) ||
      item.documentId !== documentId
  );

  savePageConfidence(projectPath, remaining);
  return remaining;
});

ipcMain.handle("confidence:cancel", async (_, data) => {
  const projectPath = data?.projectPath;

  if (!projectPath || !activeConfidenceScans.has(projectPath)) {
    return {
      success: false,
      message: "No confidence scan is running.",
    };
  }

  confidenceScanCancelRequests.add(projectPath);

  return {
    success: true,
    message: "Confidence scan cancellation requested.",
  };
});

ipcMain.handle("confidence:analyze", async (_, data) => {
  const projectPath = data?.projectPath;
  const documentId = Number(data?.documentId);
  const mode = data?.mode === "full" ? "full" : "quick";
  const language = data?.language || "tel";

  if (!projectPath || !Number.isFinite(documentId)) {
    return {
      success: false,
      message: "Project path and document are required.",
      records: [],
    };
  }

  if (activeConfidenceScans.has(projectPath)) {
    return {
      success: false,
      message: "A confidence scan is already running.",
      records: readPageConfidence(projectPath),
    };
  }

  const documentsPath = path.join(projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return {
      success: false,
      message: "documents.json was not found.",
      records: [],
    };
  }

  const documents = JSON.parse(
    fs.readFileSync(documentsPath, "utf-8")
  );
  const document = documents.find(
    (item) => item.id === documentId
  );

  if (!document) {
    return {
      success: false,
      message: "The selected document was not found.",
      records: [],
    };
  }

  const filePath =
    document.outputPath ||
    document.compressedPath ||
    document.searchablePath ||
    document.destinationPath;

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: false,
      message: "The PDF file was not found.",
      records: readPageConfidence(projectPath),
    };
  }

  confidenceScanCancelRequests.delete(projectPath);

  const scanPromise = (async () => {
    try {
      const info = await getPdfPreviewInfo(filePath);

      if (!info.pageCount) {
        throw new Error("Could not determine the PDF page count.");
      }

      const pages =
        mode === "full"
          ? Array.from(
              { length: info.pageCount },
              (_, index) => index + 1
            )
          : buildQuickScanPages(info.pageCount, 20);

      const completed = [];
      const failed = [];

      for (let index = 0; index < pages.length; index += 1) {
        if (confidenceScanCancelRequests.has(projectPath)) {
          break;
        }

        const pageNumber = pages[index];
        const percent = Math.round(
          (index / Math.max(1, pages.length)) * 100
        );

        broadcastToWindows("confidence:progress", {
          projectPath,
          documentId,
          fileName: document.fileName,
          pageNumber,
          current: index + 1,
          total: pages.length,
          percent,
          message:
            `Analyzing OCR confidence for page ${pageNumber} ` +
            `(${index + 1} of ${pages.length})`,
        });

        try {
          const record = await analyzeConfidencePage({
            projectPath,
            documentId,
            filePath,
            fileName: document.fileName,
            pageNumber,
            language,
          });

          completed.push(record);
        } catch (error) {
          const failedRecord = {
            documentId,
            fileName: document.fileName,
            pageNumber,
            language,
            confidence: 0,
            confidenceLabel: "Failed",
            wordCount: 0,
            lowConfidenceWordCount: 0,
            veryLowConfidenceWordCount: 0,
            suspiciousWords: [],
            status: "Failed",
            analyzedAt: new Date().toISOString(),
            error:
              error instanceof Error
                ? error.message
                : String(error),
          };

          upsertPageConfidence(projectPath, failedRecord);
          failed.push(failedRecord);
        }
      }

      const cancelled =
        confidenceScanCancelRequests.has(projectPath);

      broadcastToWindows("confidence:progress", {
        projectPath,
        documentId,
        fileName: document.fileName,
        pageNumber: pages.at(-1) || 1,
        current: completed.length + failed.length,
        total: pages.length,
        percent: cancelled ? undefined : 100,
        message: cancelled
          ? "Confidence scan cancelled."
          : `Confidence scan completed: ${completed.length} pages analyzed.`,
      });

      return {
        success: !cancelled,
        cancelled,
        message: cancelled
          ? "Confidence scan cancelled."
          : `Analyzed ${completed.length} page(s); ${failed.length} failed.`,
        records: readPageConfidence(projectPath),
      };
    } finally {
      activeConfidenceScans.delete(projectPath);
      confidenceScanCancelRequests.delete(projectPath);
    }
  })();

  activeConfidenceScans.set(projectPath, scanPromise);
  return scanPromise;
});

ipcMain.handle("pdf:getInfo", async (_, data) => {
  const filePath = data?.filePath;

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: false,
      message: "PDF file was not found.",
      pageCount: 0,
    };
  }

  try {
    const info = await getPdfPreviewInfo(filePath);

    return {
      success: true,
      message: "PDF information loaded.",
      ...info,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not inspect the PDF.",
      pageCount: 0,
    };
  }
});

ipcMain.handle("pdf:renderPage", async (_, data) => {
  const filePath = data?.filePath;

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      success: false,
      message: "PDF file was not found.",
      dataUrl: null,
      pageNumber: Number(data?.pageNumber) || 1,
      scalePercent: Number(data?.scalePercent) || 100,
    };
  }

  try {
    const result = await renderPdfPreviewPage(
      filePath,
      data?.pageNumber,
      data?.scalePercent
    );

    return {
      success: true,
      message: "PDF page rendered.",
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not render the PDF page.",
      dataUrl: null,
      pageNumber: Number(data?.pageNumber) || 1,
      scalePercent: Number(data?.scalePercent) || 100,
    };
  }
});

ipcMain.handle("pdf:getPreviewUrl", async (_, data) => {
  const filePath = data?.filePath;

  if (!filePath) {
    return {
      success: false,
      message: "PDF file path is required.",
      url: null,
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      message: "The PDF file does not exist.",
      url: null,
    };
  }

  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    return {
      success: false,
      message: "Only PDF files can be previewed.",
      url: null,
    };
  }

  try {
    const port = await ensurePdfPreviewServer();
    const token = registerPdfForPreview(filePath);

    return {
      success: true,
      message: "PDF preview is ready.",
      url: `http://127.0.0.1:${port}/pdf/${token}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not start the PDF preview service.",
      url: null,
    };
  }
});

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  try {
    fs.rmSync(
      path.join(app.getPath("temp"), "ocr-studio-pdf-preview"),
      { recursive: true, force: true }
    );
  } catch (error) {
    console.warn("Could not clear PDF preview cache:", error);
  }

  pdfPreviewFiles.clear();

  if (pdfPreviewServer) {
    pdfPreviewServer.close();
    pdfPreviewServer = null;
    pdfPreviewPort = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});