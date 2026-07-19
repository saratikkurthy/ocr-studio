const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ocrStudio", {
  selectWorkspaceFolder: () => ipcRenderer.invoke("workspace:selectFolder"),
  createProject: (data) => ipcRenderer.invoke("project:create", data),
  listRecentProjects: () => ipcRenderer.invoke("project:listRecent"),
  importFilesToProject: (data) => ipcRenderer.invoke("project:importFiles", data),
  listProjectDocuments: (data) => ipcRenderer.invoke("project:listDocuments", data),
  openPath: (filePath) => ipcRenderer.invoke("shell:openPath", filePath),
  openInputFolder: (projectPath) => ipcRenderer.invoke("shell:openInputFolder", projectPath),
  checkOcrTools: () => ipcRenderer.invoke("ocr:checkTools"),
  runOcrForProject: (data) => ipcRenderer.invoke("ocr:runProject", data),
  listProjectExports: (data) => ipcRenderer.invoke("project:listExports", data),
  deleteProject: (data) => ipcRenderer.invoke("project:delete", data),
  deleteProjectDocument: (data) => ipcRenderer.invoke("project:deleteDocument", data),
  deleteProjectExport: (data) => ipcRenderer.invoke("project:deleteExport", data),
  verifyPdfTextLayer: (data) => ipcRenderer.invoke("pdf:verifyTextLayer", data),
  cancelOcr: () => ipcRenderer.invoke("ocr:cancel"),
  listOcrJobs: (data) => ipcRenderer.invoke("project:listOcrJobs", data),
  listOcrQueue: (data) =>
    ipcRenderer.invoke("queue:list", data),

  addToOcrQueue: (data) =>
    ipcRenderer.invoke("queue:add", data),

  removeFromOcrQueue: (data) =>
    ipcRenderer.invoke("queue:remove", data),

  clearCompletedQueueItems: (data) =>
    ipcRenderer.invoke("queue:clearCompleted", data),
  analyzeProject: (data) =>
    ipcRenderer.invoke("analysis:analyzeProject", data),

  listProjectAnalysis: (data) =>
    ipcRenderer.invoke("analysis:listProject", data),

  onAnalysisProgress: (callback) => {
    ipcRenderer.removeAllListeners("analysis:progress");

    ipcRenderer.on(
      "analysis:progress",
      (_event, progress) => callback(progress)
    );
  },
  onOcrProgress: (callback) => {
    ipcRenderer.removeAllListeners("ocr:progress");
    ipcRenderer.on("ocr:progress", (_event, data) => callback(data));

  },
  onOcrDocumentStatus: (callback) => {
    ipcRenderer.removeAllListeners("ocr:documentStatus");

    ipcRenderer.on(
      "ocr:documentStatus",
      (_event, data) => callback(data)
    );
  },
});