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
  onOcrProgress: (callback) => {
    ipcRenderer.removeAllListeners("ocr:progress");
    ipcRenderer.on("ocr:progress", (_event, data) => callback(data));
  },
});