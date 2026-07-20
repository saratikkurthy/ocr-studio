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
  getPdfPreviewUrl: (data) => ipcRenderer.invoke("pdf:getPreviewUrl", data),
  getPdfInfo: (data) => ipcRenderer.invoke("pdf:getInfo", data),

  listWordIndexJobs: (data) =>
    ipcRenderer.invoke("wordIndexQueue:list", data),

  enqueueWordIndexJob: (data) =>
    ipcRenderer.invoke("wordIndexQueue:enqueue", data),

  cancelWordIndexJob: (data) =>
    ipcRenderer.invoke("wordIndexQueue:cancel", data),

  retryWordIndexJob: (data) =>
    ipcRenderer.invoke("wordIndexQueue:retry", data),

  removeWordIndexJob: (data) =>
    ipcRenderer.invoke("wordIndexQueue:remove", data),

  onWordIndexQueueUpdated: (callback) => {
    ipcRenderer.removeAllListeners("wordIndexQueue:updated");
    ipcRenderer.on("wordIndexQueue:updated", (_event, payload) =>
      callback(payload)
    );
  },

  getWordIndexManifest: (data) =>
    ipcRenderer.invoke("wordIndex:getManifest", data),

  getWordIndexPage: (data) =>
    ipcRenderer.invoke("wordIndex:getPage", data),

  updateWordIndexWord: (data) =>
    ipcRenderer.invoke("wordIndex:updateWord", data),

  getWordCorrectionHistory: (data) =>
    ipcRenderer.invoke("wordIndex:getCorrectionHistory", data),

  searchWordIndexDocument: (data) =>
    ipcRenderer.invoke("wordIndex:searchDocument", data),

  suggestWordCorrections: (data) =>
    ipcRenderer.invoke("wordIndex:suggestCorrections", data),

  getCorrectionMemory: (data) =>
    ipcRenderer.invoke("wordIndex:getCorrectionMemory", data),

  previewBatchCorrection: (data) =>
    ipcRenderer.invoke("wordIndex:previewBatchCorrection", data),

  applyBatchCorrection: (data) =>
    ipcRenderer.invoke("wordIndex:applyBatchCorrection", data),

  getPublicationSettings: (data) =>
    ipcRenderer.invoke("publish:getSettings", data),

  updatePublicationSettings: (data) =>
    ipcRenderer.invoke("publish:updateSettings", data),

  previewIncrementalPublication: (data) =>
    ipcRenderer.invoke("publish:previewIncremental", data),

  listPublicationProfiles: (data) =>
    ipcRenderer.invoke("publish:listProfiles", data),

  savePublicationProfile: (data) =>
    ipcRenderer.invoke("publish:saveProfile", data),

  deletePublicationProfile: (data) =>
    ipcRenderer.invoke("publish:deleteProfile", data),

  listPublicationQueue: (data) =>
    ipcRenderer.invoke("publish:listQueue", data),

  enqueuePublicationJobs: (data) =>
    ipcRenderer.invoke("publish:enqueue", data),

  retryPublicationJob: (data) =>
    ipcRenderer.invoke("publish:retryQueueJob", data),

  cancelPublicationJob: (data) =>
    ipcRenderer.invoke("publish:cancelQueueJob", data),

  removePublicationJob: (data) =>
    ipcRenderer.invoke("publish:removeQueueJob", data),

  resumePublicationQueue: (data) =>
    ipcRenderer.invoke("publish:resumeQueue", data),

  validatePublishedDocument: (data) =>
    ipcRenderer.invoke("publish:validateDocument", data),

  createPublishedBundle: (data) =>
    ipcRenderer.invoke("publish:createBundle", data),

  listPublishHistory: (data) =>
    ipcRenderer.invoke("publish:listHistory", data),

  createCorrectedSearchablePdf: (data) =>
    ipcRenderer.invoke("publish:createSearchablePdf", data),

  listBatchCorrectionTransactions: (data) =>
    ipcRenderer.invoke("wordIndex:listBatchTransactions", data),

  undoBatchCorrection: (data) =>
    ipcRenderer.invoke("wordIndex:undoBatchCorrection", data),

  listCorrectionRules: (data) =>
    ipcRenderer.invoke("wordIndex:listCorrectionRules", data),

  saveCorrectionRule: (data) =>
    ipcRenderer.invoke("wordIndex:saveCorrectionRule", data),

  toggleCorrectionRule: (data) =>
    ipcRenderer.invoke("wordIndex:toggleCorrectionRule", data),

  deleteCorrectionRule: (data) =>
    ipcRenderer.invoke("wordIndex:deleteCorrectionRule", data),

  getWordIndexReviewQueue: (data) =>
    ipcRenderer.invoke("wordIndex:getReviewQueue", data),

  buildWordIndex: (data) =>
    ipcRenderer.invoke("wordIndex:build", data),

  cancelWordIndex: (data) =>
    ipcRenderer.invoke("wordIndex:cancel", data),

  clearWordIndex: (data) =>
    ipcRenderer.invoke("wordIndex:clear", data),

  onWordIndexProgress: (callback) => {
    ipcRenderer.removeAllListeners("wordIndex:progress");
    ipcRenderer.on("wordIndex:progress", (_event, payload) =>
      callback(payload)
    );
  },

  listPageConfidence: (data) =>
    ipcRenderer.invoke("confidence:list", data),

  analyzePageConfidence: (data) =>
    ipcRenderer.invoke("confidence:analyze", data),

  cancelPageConfidence: (data) =>
    ipcRenderer.invoke("confidence:cancel", data),

  clearPageConfidence: (data) =>
    ipcRenderer.invoke("confidence:clear", data),

  onPageConfidenceProgress: (callback) => {
    ipcRenderer.removeAllListeners("confidence:progress");
    ipcRenderer.on("confidence:progress", (_event, payload) =>
      callback(payload)
    );
  },
  renderPdfPage: (data) => ipcRenderer.invoke("pdf:renderPage", data),
  readPdfFile: (data) => ipcRenderer.invoke("pdf:readFile", data),
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

  startOcrQueue: (data) =>
    ipcRenderer.invoke("queue:start", data),

  stopOcrQueue: (data) =>
    ipcRenderer.invoke("queue:stop", data),

  getOcrQueueStatus: (data) =>
    ipcRenderer.invoke("queue:status", data),

  onOcrQueueUpdated: (callback) => {
    ipcRenderer.removeAllListeners("queue:updated");
    ipcRenderer.on("queue:updated", (_event, data) => callback(data));
  },

  onOcrQueueWorkerStatus: (callback) => {
    ipcRenderer.removeAllListeners("queue:workerStatus");
    ipcRenderer.on("queue:workerStatus", (_event, data) => callback(data));
  },
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