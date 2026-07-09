import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { exec, spawn } from "child_process";

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

ipcMain.handle("ocr:runProject", async (event, data) => {
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

  for (const pdf of selectedDocuments) {
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
      results.push({
        fileName: pdf.fileName,
        success: false,
        message: `OCR failed for ${pdf.fileName}`,
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

    results.push({
      fileName: pdf.fileName,
      success: true,
      outputPath: finalPath,
      searchablePath,
      compressedPath: fs.existsSync(compressedPath) ? compressedPath : undefined,
      sidecarTxtPath: fs.existsSync(sidecarTxtPath) ? sidecarTxtPath : undefined,
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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});