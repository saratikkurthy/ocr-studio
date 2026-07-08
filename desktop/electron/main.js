import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { exec, spawn } from "child_process";

/**process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});**/

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
  win.webContents.openDevTools();

  win.webContents.on("render-process-gone", (_, details) => {
    console.error("Renderer process gone:", details);
  });
}

function getAppDataPath() {
  const appData = path.join(app.getPath("userData"), "OCR Studio");
  if (!fs.existsSync(appData)) {
    fs.mkdirSync(appData, { recursive: true });
  }
  return appData;
}

function getRecentProjectsPath() {
  return path.join(getAppDataPath(), "recent-projects.json");
}

function readRecentProjects() {
  const filePath = getRecentProjectsPath();

  if (!fs.existsSync(filePath)) {
    return [];
  }

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

ipcMain.handle("workspace:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select OCR Studio Workspace",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    compression: data.compression || "medium",
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

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const inputFolder = path.join(data.projectPath, "Input");

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

  if (!fs.existsSync(documentsPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(documentsPath, "utf-8"));
});


ipcMain.handle("project:listExports", async (_, data) => {
  const exportFolder = path.join(data.projectPath, "Export");

  if (!fs.existsSync(exportFolder)) {
    return [];
  }

  return fs
    .readdirSync(exportFolder)
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
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

  if (!fs.existsSync(inputFolder)) {
    fs.mkdirSync(inputFolder, { recursive: true });
  }

  return await shell.openPath(inputFolder);
});

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

ipcMain.handle("ocr:runProject", async (_, data) => {
  const documentsPath = path.join(data.projectPath, "documents.json");

  if (!fs.existsSync(documentsPath)) {
    return { success: false, message: "No imported documents found." };
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, "utf-8"));

  const firstPdf = documents.find((doc) =>
    doc.fileName.toLowerCase().endsWith(".pdf")
  );

  if (!firstPdf) {
    return {
      success: false,
      message: "Please import a PDF file first.",
    };
  }

  const inputPath = firstPdf.destinationPath;
  const outputPath = path.join(
    data.projectPath,
    "Export",
    firstPdf.fileName.replace(/\.pdf$/i, "_searchable.pdf")
  );

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const inputWsl = windowsPathToWslPath(inputPath);
  const outputWsl = windowsPathToWslPath(outputPath);

  const logPath = path.join(data.projectPath, "Logs", "ocr-run.log");
  const compression = data.compression || "medium";

  const compressionArgs = {
    low: [
      "--optimize", "1",
      "--jpeg-quality", "95",
      "--png-quality", "95",
    ],

    medium: [
      "--optimize", "2",
      "--jpeg-quality", "85",
      "--png-quality", "85",
      "--tesseract-downsample-large-images",
      "--tesseract-downsample-above", "300",
    ],

    high: [
      "--optimize", "3",
      "--jpeg-quality", "65",
      "--png-quality", "65",
      "--tesseract-downsample-large-images",
      "--tesseract-downsample-above", "220",
    ],

    maximum: [
      "--optimize", "3",
      "--jpeg-quality", "45",
      "--png-quality", "45",
      "--tesseract-downsample-large-images",
      "--tesseract-downsample-above", "150",
    ],
  }[compression] || [
      "--optimize", "2",
      "--jpeg-quality", "85",
      "--png-quality", "85",
    ];
  const args = [
    "-d",
    "Ubuntu-24.04",
    "--",
    "ocrmypdf",
    "--skip-text",
    "--deskew",
    ...compressionArgs,
    "--output-type",
    "pdf",
    "-l",
    data.language,
    inputWsl,
    outputWsl,
  ];

  fs.writeFileSync(
    logPath,
    `COMMAND:\nwsl.exe ${args.join(" ")}\n\n`,
    "utf-8"
  );

  return new Promise((resolve) => {
    const child = spawn("wsl.exe", args, {
      windowsHide: true,
    });

    child.stdout.on("data", (chunk) => {
      fs.appendFileSync(logPath, chunk.toString(), "utf-8");
    });

    child.stderr.on("data", (chunk) => {
      fs.appendFileSync(logPath, chunk.toString(), "utf-8");
    });

    child.on("error", (error) => {
      fs.appendFileSync(logPath, `\nPROCESS ERROR:\n${error.message}`, "utf-8");

      resolve({
        success: false,
        message: error.message,
      });
    });

    child.on("close", (code) => {
      fs.appendFileSync(logPath, `\n\nPROCESS EXIT CODE: ${code}\n`, "utf-8");

      if (code !== 0) {
        const inputSize = fs.statSync(inputPath).size;
        const outputSize = fs.statSync(outputPath).size;
        const reductionPercent = ((inputSize - outputSize) / inputSize) * 100;
        resolve({
          success: false,
          message: `OCR process failed with exit code ${code}. Check Logs/ocr-run.log`,
        });
        return;
      }

      if (!fs.existsSync(outputPath)) {
        resolve({
          success: false,
          message:
            "OCR process completed, but output PDF was not found:\n" +
            outputPath,
        });
        return;
      }

      if (!fs.existsSync(outputPath)) {
        resolve({
          success: false,
          message:
            "OCR process completed, but output PDF was not found:\n" +
            outputPath,
        });
        return;
      }

      const finalOutputPath = path.join(
        data.projectPath,
        "Export",
        firstPdf.fileName.replace(/\.pdf$/i, "_searchable_compressed.pdf")
      );

      if (fs.existsSync(finalOutputPath)) {
        fs.unlinkSync(finalOutputPath);
      }

      const gsProfiles = {
        low: "/prepress",
        medium: "/ebook",
        high: "/screen",
        maximum: "/screen",
      };

      const gsProfile = gsProfiles[data.compression || "medium"] || "/ebook";

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
        `-sOutputFile=${windowsPathToWslPath(finalOutputPath)}`,
        windowsPathToWslPath(outputPath),
      ];

      fs.appendFileSync(
        logPath,
        `\n\nGHOSTSCRIPT COMMAND:\nwsl.exe ${gsArgs.join(" ")}\n`,
        "utf-8"
      );

      const gs = spawn("wsl.exe", gsArgs, {
        windowsHide: true,
      });

      gs.stdout.on("data", (chunk) => {
        fs.appendFileSync(logPath, chunk.toString(), "utf-8");
      });

      gs.stderr.on("data", (chunk) => {
        fs.appendFileSync(logPath, chunk.toString(), "utf-8");
      });

      gs.on("error", (error) => {
        fs.appendFileSync(logPath, `\nGHOSTSCRIPT ERROR:\n${error.message}`, "utf-8");

        resolve({
          success: false,
          message: "Ghostscript compression failed: " + error.message,
        });
      });

      gs.on("close", (gsCode) => {
        fs.appendFileSync(logPath, `\nGHOSTSCRIPT EXIT CODE: ${gsCode}\n`, "utf-8");

        if (gsCode !== 0 || !fs.existsSync(finalOutputPath)) {
          resolve({
            success: true,
            message:
              "OCR completed, but Ghostscript compression failed. Returning OCR PDF.",
            outputPath,
          });
          return;
        }

        const inputSize = fs.statSync(inputPath).size;
        const ocrSize = fs.statSync(outputPath).size;
        const outputSize = fs.statSync(finalOutputPath).size;

        const reductionPercent = ((inputSize - outputSize) / inputSize) * 100;

        resolve({
          success: true,
          message: "OCR and compression completed successfully.",
          outputPath: finalOutputPath,
          inputSize,
          ocrSize,
          outputSize,
          reductionPercent,
        });
      });
      resolve({
        success: true,
        message: "OCR completed successfully.",
        outputPath,
        inputSize,
        outputSize,
        reductionPercent,
      });
    });
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});