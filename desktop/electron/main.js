import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { exec, spawn } from "child_process";
import { analyzePdf } from "./analysis/pdfAnalyzer.js";

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
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});