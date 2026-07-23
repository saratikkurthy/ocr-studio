const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ocrStudio", {
  getRepositoryWorkspace: () => ipcRenderer.invoke("repo:getWorkspace"),
  getRepositoryProject: (data) => ipcRenderer.invoke("repo:getProject", data),
  saveRepositoryPublication: (data) => ipcRenderer.invoke("repo:savePublication", data),
  deleteRepositoryPublication: (data) => ipcRenderer.invoke("repo:deletePublication", data),
  validateRepositoryPublication: (data) => ipcRenderer.invoke("repo:validatePublication", data),
  saveRepositoryDeposit: (data) => ipcRenderer.invoke("repo:saveDeposit", data),
  deleteRepositoryDeposit: (data) => ipcRenderer.invoke("repo:deleteDeposit", data),
  saveRepositoryIdentifier: (data) => ipcRenderer.invoke("repo:saveIdentifier", data),
  exportRepositoryMetadata: (data) => ipcRenderer.invoke("repo:exportMetadata", data),
  createRepositoryBag: (data) => ipcRenderer.invoke("repo:createBag", data),
  openRepositoryFile: (filePath) => ipcRenderer.invoke("repo:openFile", filePath),
  getPublicPortalWorkspace: () => ipcRenderer.invoke("portal:getWorkspace"),
  getPublicPortalProject: (data) => ipcRenderer.invoke("portal:getProject", data),
  savePublicPortalSite: (data) => ipcRenderer.invoke("portal:saveSite", data),
  deletePublicPortalSite: (data) => ipcRenderer.invoke("portal:deleteSite", data),
  savePublicPortalPage: (data) => ipcRenderer.invoke("portal:savePage", data),
  deletePublicPortalPage: (data) => ipcRenderer.invoke("portal:deletePage", data),
  generatePublicPortal: (data) => ipcRenderer.invoke("portal:generate", data),
  openPublicPortalFile: (filePath) => ipcRenderer.invoke("portal:openFile", filePath),

  getCollaborationWorkspace: () => ipcRenderer.invoke("collab:getWorkspace"),
  getCollaborationProject: (data) => ipcRenderer.invoke("collab:getProject", data),
  saveCollaborationContributor: (data) => ipcRenderer.invoke("collab:saveContributor", data),
  deleteCollaborationContributor: (data) => ipcRenderer.invoke("collab:deleteContributor", data),
  saveCollaborationAssignment: (data) => ipcRenderer.invoke("collab:saveAssignment", data),
  deleteCollaborationAssignment: (data) => ipcRenderer.invoke("collab:deleteAssignment", data),
  addCollaborationComment: (data) => ipcRenderer.invoke("collab:addComment", data),
  resolveCollaborationComment: (data) => ipcRenderer.invoke("collab:resolveComment", data),
  saveCollaborationSettings: (data) => ipcRenderer.invoke("collab:saveSettings", data),
  exportCollaborationReport: (data) => ipcRenderer.invoke("collab:export", data),
  openCollaborationFile: (filePath) => ipcRenderer.invoke("collab:openFile", filePath),
  getIiifWorkspace: () => ipcRenderer.invoke("iiif:getWorkspace"),
  getIiifProject: (data) => ipcRenderer.invoke("iiif:getProject", data),
  saveIiifManifest: (data) => ipcRenderer.invoke("iiif:saveManifest", data),
  deleteIiifManifest: (data) => ipcRenderer.invoke("iiif:deleteManifest", data),
  saveIiifCanvas: (data) => ipcRenderer.invoke("iiif:saveCanvas", data),
  deleteIiifCanvas: (data) => ipcRenderer.invoke("iiif:deleteCanvas", data),
  saveIiifAnnotation: (data) => ipcRenderer.invoke("iiif:saveAnnotation", data),
  deleteIiifAnnotation: (data) => ipcRenderer.invoke("iiif:deleteAnnotation", data),
  saveIiifSettings: (data) => ipcRenderer.invoke("iiif:saveSettings", data),
  exportIiifManifest: (data) => ipcRenderer.invoke("iiif:exportManifest", data),
  exportIiifAnnotations: (data) => ipcRenderer.invoke("iiif:exportAnnotations", data),
  openIiifFile: (filePath) => ipcRenderer.invoke("iiif:openFile", filePath),
  getScholarlyAssistantWorkspace: (data) => ipcRenderer.invoke("scholarlyAssistant:workspace", data),
  rebuildScholarlySemanticIndex: (data) => ipcRenderer.invoke("scholarlyAssistant:reindex", data),
  askScholarlyAssistant: (data) => ipcRenderer.invoke("scholarlyAssistant:ask", data),
  deleteScholarlyConversation: (data) => ipcRenderer.invoke("scholarlyAssistant:deleteConversation", data),
  saveScholarlyNotebook: (data) => ipcRenderer.invoke("scholarlyAssistant:saveNotebook", data),
  deleteScholarlyNotebook: (data) => ipcRenderer.invoke("scholarlyAssistant:deleteNotebook", data),
  saveScholarlyPrompt: (data) => ipcRenderer.invoke("scholarlyAssistant:savePrompt", data),
  saveScholarlyBookmark: (data) => ipcRenderer.invoke("scholarlyAssistant:saveBookmark", data),
  deleteScholarlyBookmark: (data) => ipcRenderer.invoke("scholarlyAssistant:deleteBookmark", data),
  generateScholarlyCitation: (data) => ipcRenderer.invoke("scholarlyAssistant:citation", data),
  exportScholarlyConversation: (data) => ipcRenderer.invoke("scholarlyAssistant:export", data),
  openScholarlyAssistantFile: (filePath) => ipcRenderer.invoke("scholarlyAssistant:open", { filePath }),
  getParallelCorpusWorkspace: (data) => ipcRenderer.invoke("parallelCorpus:get", data),
  saveParallelCorpus: (data) => ipcRenderer.invoke("parallelCorpus:saveCorpus", data),
  deleteParallelCorpus: (data) => ipcRenderer.invoke("parallelCorpus:deleteCorpus", data),
  saveParallelAlignment: (data) => ipcRenderer.invoke("parallelCorpus:saveAlignment", data),
  deleteParallelAlignment: (data) => ipcRenderer.invoke("parallelCorpus:deleteAlignment", data),
  saveTranslationMemory: (data) => ipcRenderer.invoke("parallelCorpus:saveMemory", data),
  saveCorpusTerm: (data) => ipcRenderer.invoke("parallelCorpus:saveTerm", data),
  deleteCorpusTerm: (data) => ipcRenderer.invoke("parallelCorpus:deleteTerm", data),
  suggestParallelTranslation: (data) => ipcRenderer.invoke("parallelCorpus:suggest", data),
  getParallelCorpusQuality: (data) => ipcRenderer.invoke("parallelCorpus:quality", data),
  exportParallelCorpus: (data) => ipcRenderer.invoke("parallelCorpus:export", data),
  openParallelCorpusExport: (filePath) => ipcRenderer.invoke("parallelCorpus:open", { filePath }),
  getCriticalApparatus: (data) => ipcRenderer.invoke("apparatus:get", data),
  saveCriticalApparatusEntry: (data) => ipcRenderer.invoke("apparatus:saveEntry", data),
  saveCriticalApparatusSettings: (data) => ipcRenderer.invoke("apparatus:saveSettings", data),
  exportCriticalApparatus: (data) => ipcRenderer.invoke("apparatus:export", data),
  openCriticalApparatusExport: (filePath) => ipcRenderer.invoke("apparatus:open", { filePath }),
  getStemmaAnalysis: (data) => ipcRenderer.invoke("stemma:get", data),
  analyzeStemma: (data) => ipcRenderer.invoke("stemma:analyze", data),
  saveStemmaRelationship: (data) => ipcRenderer.invoke("stemma:saveRelationship", data),
  deleteStemmaRelationship: (data) => ipcRenderer.invoke("stemma:deleteRelationship", data),
  exportStemmaAnalysis: (data) => ipcRenderer.invoke("stemma:export", data),
  openStemmaExport: (filePath) => ipcRenderer.invoke("stemma:open", { filePath }),
  getManuscriptWorkspace: (data) => ipcRenderer.invoke("manuscripts:get", data),
  saveManuscriptWitness: (data) => ipcRenderer.invoke("manuscripts:saveWitness", data),
  deleteManuscriptWitness: (data) => ipcRenderer.invoke("manuscripts:deleteWitness", data),
  saveWitnessGroup: (data) => ipcRenderer.invoke("manuscripts:saveGroup", data),
  deleteWitnessGroup: (data) => ipcRenderer.invoke("manuscripts:deleteGroup", data),
  buildWitnessCollation: (data) => ipcRenderer.invoke("manuscripts:buildCollation", data),
  saveWitnessCollation: (data) => ipcRenderer.invoke("manuscripts:saveCollation", data),
  deleteWitnessCollation: (data) => ipcRenderer.invoke("manuscripts:deleteCollation", data),
  exportWitnessCollation: (data) => ipcRenderer.invoke("manuscripts:export", data),
  openWitnessExport: (filePath) => ipcRenderer.invoke("manuscripts:open", { filePath }),
  getScholarlyLibrary: (data) => ipcRenderer.invoke("scholarlyLibrary:get", data),
  createLibraryCollection: (data) => ipcRenderer.invoke("scholarlyLibrary:createCollection", data),
  updateLibraryCollection: (data) => ipcRenderer.invoke("scholarlyLibrary:updateCollection", data),
  deleteLibraryCollection: (data) => ipcRenderer.invoke("scholarlyLibrary:deleteCollection", data),
  searchScholarlyLibrary: (data) => ipcRenderer.invoke("scholarlyLibrary:search", data),
  openLibraryEdition: (data) => ipcRenderer.invoke("scholarlyLibrary:openEdition", data),
  getEditionComparisonCatalog: (data) => ipcRenderer.invoke("editionComparison:catalog", data),
  compareScholarlyEditions: (data) => ipcRenderer.invoke("editionComparison:compare", data),
  saveEditionComparison: (data) => ipcRenderer.invoke("editionComparison:save", data),
  listEditionComparisons: (data) => ipcRenderer.invoke("editionComparison:history", data),
  getSavedEditionComparison: (data) => ipcRenderer.invoke("editionComparison:getSaved", data),
  deleteEditionComparison: (data) => ipcRenderer.invoke("editionComparison:delete", data),
  exportEditionComparison: (data) => ipcRenderer.invoke("editionComparison:export", data),
  openEditionComparison: (filePath) => ipcRenderer.invoke("editionComparison:open", { filePath }),

  getCriticalTextWorkspace: (data) => ipcRenderer.invoke("criticalText:get", data),
  addEditionBook: (data) => ipcRenderer.invoke("criticalText:addBook", data),
  addEditionChapter: (data) => ipcRenderer.invoke("criticalText:addChapter", data),
  saveEditionVerse: (data) => ipcRenderer.invoke("criticalText:saveVerse", data),
  deleteEditionVerse: (data) => ipcRenderer.invoke("criticalText:deleteVerse", data),
  saveEditionApparatus: (data) => ipcRenderer.invoke("criticalText:save:apparatus", data),
  deleteEditionApparatus: (data) => ipcRenderer.invoke("criticalText:delete:apparatus", data),
  saveEditionCommentary: (data) => ipcRenderer.invoke("criticalText:save:commentary", data),
  deleteEditionCommentary: (data) => ipcRenderer.invoke("criticalText:delete:commentary", data),
  saveEditionFootnote: (data) => ipcRenderer.invoke("criticalText:save:footnotes", data),
  deleteEditionFootnote: (data) => ipcRenderer.invoke("criticalText:delete:footnotes", data),
  saveEditorialDecision: (data) => ipcRenderer.invoke("criticalText:save:decisions", data),
  deleteEditorialDecision: (data) => ipcRenderer.invoke("criticalText:delete:decisions", data),
  getEditorialDecisionWorkspace: (data) => ipcRenderer.invoke("editorialDecision:get", data),
  transitionEditorialDecision: (data) => ipcRenderer.invoke("editorialDecision:transition", data),
  addEditorialDecisionEvidence: (data) => ipcRenderer.invoke("editorialDecision:addEvidence", data),
  deleteEditorialDecisionEvidence: (data) => ipcRenderer.invoke("editorialDecision:deleteEvidence", data),
  restoreEditorialDecisionRevision: (data) => ipcRenderer.invoke("editorialDecision:restore", data),
  compareEditorialDecisions: (data) => ipcRenderer.invoke("editorialDecision:compare", data),
  listEditorialAiSuggestions: (data) => ipcRenderer.invoke("editorialAi:list", data),
  generateEditorialAiSuggestions: (data) => ipcRenderer.invoke("editorialAi:generate", data),
  updateEditorialAiSuggestion: (data) => ipcRenderer.invoke("editorialAi:update", data),
  getEditionValidation: (data) => ipcRenderer.invoke("editionValidator:get", data),
  runEditionValidation: (data) => ipcRenderer.invoke("editionValidator:run", data),
  exportEditionValidation: (data) => ipcRenderer.invoke("editionValidator:export", data),
  openEditionValidation: (filePath) => ipcRenderer.invoke("editionValidator:open", { filePath }),
  getEditionPublicationCenter: (data) => ipcRenderer.invoke("editionExporter:get", data),
  saveEditionPublicationMetadata: (data) => ipcRenderer.invoke("editionExporter:saveMetadata", data),
  generateEditionPublication: (data) => ipcRenderer.invoke("editionExporter:generate", data),
  openEditionPublication: (filePath) => ipcRenderer.invoke("editionExporter:open", { filePath }),
  listEditions: (data) => ipcRenderer.invoke("edition:list", data),
  createEdition: (data) => ipcRenderer.invoke("edition:create", data),
  updateEdition: (data) => ipcRenderer.invoke("edition:update", data),
  deleteEdition: (data) => ipcRenderer.invoke("edition:delete", data),
  duplicateEdition: (data) => ipcRenderer.invoke("edition:duplicate", data),
  openEditionFolder: (data) => ipcRenderer.invoke("edition:openFolder", data),
  getResearchDiscovery: (data) => ipcRenderer.invoke("researchDiscovery:get", data),
  analyzeResearchDiscovery: (data) => ipcRenderer.invoke("researchDiscovery:analyze", data),
  openResearchDiscoverySource: (filePath) => ipcRenderer.invoke("researchDiscovery:open", filePath),
  getCorpusIntelligence: (data) => ipcRenderer.invoke("corpusIntelligence:get", data),
  analyzeCorpusIntelligence: (data) => ipcRenderer.invoke("corpusIntelligence:analyze", data),
  searchCorpusIntelligence: (data) => ipcRenderer.invoke("corpusIntelligence:search", data),
  getConceptEvolution: (data) => ipcRenderer.invoke("corpusIntelligence:evolution", data),
  openCorpusSource: (filePath) => ipcRenderer.invoke("corpusIntelligence:openSource", filePath),

  listEvidenceResearchSessions: (data) => ipcRenderer.invoke("evidenceAssistant:listSessions", data),
  getEvidenceResearchSession: (data) => ipcRenderer.invoke("evidenceAssistant:getSession", data),
  deleteEvidenceResearchSession: (data) => ipcRenderer.invoke("evidenceAssistant:deleteSession", data),
  listEvidenceResearchScopes: (data) => ipcRenderer.invoke("evidenceAssistant:listScopes", data),
  askEvidenceResearchAssistant: (data) => ipcRenderer.invoke("evidenceAssistant:ask", data),
  exportEvidenceResearchSession: (data) => ipcRenderer.invoke("evidenceAssistant:exportSession", data),
  openEvidenceResearchExport: (filePath) => ipcRenderer.invoke("evidenceAssistant:open", filePath),
  listResearchCanvases: (data) => ipcRenderer.invoke("researchCanvas:list", data),
  createResearchCanvas: (data) => ipcRenderer.invoke("researchCanvas:create", data),
  updateResearchCanvas: (data) => ipcRenderer.invoke("researchCanvas:update", data),
  deleteResearchCanvas: (data) => ipcRenderer.invoke("researchCanvas:delete", data),
  exportResearchCanvas: (data) => ipcRenderer.invoke("researchCanvas:export", data),
  openResearchCanvasSource: (filePath) => ipcRenderer.invoke("researchCanvas:openSource", filePath),
  listResearchNotebooks: (data) => ipcRenderer.invoke("workbench:list", data),
  createResearchNotebook: (data) => ipcRenderer.invoke("workbench:create", data),
  updateResearchNotebook: (data) => ipcRenderer.invoke("workbench:update", data),
  deleteResearchNotebook: (data) => ipcRenderer.invoke("workbench:delete", data),
  addResearchEvidence: (data) => ipcRenderer.invoke("workbench:addEvidence", data),
  removeResearchEvidence: (data) => ipcRenderer.invoke("workbench:removeEvidence", data),
  exportResearchNotebook: (data) => ipcRenderer.invoke("workbench:export", data),
  openResearchSource: (filePath) => ipcRenderer.invoke("workbench:openSource", filePath),
  listCitations: (data) => ipcRenderer.invoke("citation:list", data),
  createCitation: (data) => ipcRenderer.invoke("citation:create", data),
  createCitationFromEvidence: (data) => ipcRenderer.invoke("citation:fromEvidence", data),
  updateCitation: (data) => ipcRenderer.invoke("citation:update", data),
  deleteCitation: (data) => ipcRenderer.invoke("citation:delete", data),
  buildBibliography: (data) => ipcRenderer.invoke("citation:bibliography", data),
  validateCitations: (data) => ipcRenderer.invoke("citation:validate", data),
  exportCitations: (data) => ipcRenderer.invoke("citation:export", data),
  openCitationSource: (filePath) => ipcRenderer.invoke("citation:openSource", filePath),
  listPageRevisions: (data) => ipcRenderer.invoke("revision:list", data),
  getPageRevision: (data) => ipcRenderer.invoke("revision:get", data),
  diffPageRevisions: (data) => ipcRenderer.invoke("revision:diff", data),
  restorePageRevision: (data) => ipcRenderer.invoke("revision:restore", data),
  listResearchReports: (data) => ipcRenderer.invoke("research:list", data),
  getResearchReport: (data) => ipcRenderer.invoke("research:get", data),
  runResearchCopilot: (data) => ipcRenderer.invoke("research:run", data),
  deleteResearchReport: (data) => ipcRenderer.invoke("research:delete", data),
  exportResearchReport: (data) => ipcRenderer.invoke("research:export", data),
  openResearchExport: (filePath) => ipcRenderer.invoke("research:open", filePath),
  getAssistantSettings: (data) => ipcRenderer.invoke("assistant:getSettings", data),
  saveAssistantSettings: (data) => ipcRenderer.invoke("assistant:saveSettings", data),
  checkOllama: (data) => ipcRenderer.invoke("assistant:checkOllama", data),
  listAssistantConversations: (data) => ipcRenderer.invoke("assistant:listConversations", data),
  getAssistantConversation: (data) => ipcRenderer.invoke("assistant:getConversation", data),
  deleteAssistantConversation: (data) => ipcRenderer.invoke("assistant:deleteConversation", data),
  askManuscriptAssistant: (data) => ipcRenderer.invoke("assistant:ask", data),
  getManuscriptIndexStatus: (data) => ipcRenderer.invoke("manuscriptIndex:getStatus", data),
  buildManuscriptIndex: (data) => ipcRenderer.invoke("manuscriptIndex:build", data),
  searchManuscriptIndex: (data) => ipcRenderer.invoke("manuscriptIndex:search", data),
  openManuscriptIndexPath: (filePath) => ipcRenderer.invoke("manuscriptIndex:open", filePath),
  getWorkspaceIntelligence: (data) => ipcRenderer.invoke("intelligence:getDashboard", data),
  exportWorkspaceIntelligence: (data) => ipcRenderer.invoke("intelligence:exportSnapshot", data),
  scanDuplicates: (data) => ipcRenderer.invoke("duplicate:scan", data),
  getDuplicateRegistry: (data) => ipcRenderer.invoke("duplicate:getRegistry", data),
  exportDuplicateReport: (data) => ipcRenderer.invoke("duplicate:export", data),
  openDuplicateReport: (filePath) => ipcRenderer.invoke("duplicate:openPath", filePath),
  searchAcrossProjects: (data) =>
    ipcRenderer.invoke("globalSearch:search", data),
  exportCrossProjectSearch: (data) =>
    ipcRenderer.invoke("globalSearch:export", data),
  listCollections: (data) => ipcRenderer.invoke("collection:list", data),
  createCollection: (data) => ipcRenderer.invoke("collection:create", data),
  updateCollection: (data) => ipcRenderer.invoke("collection:update", data),
  deleteCollection: (data) => ipcRenderer.invoke("collection:delete", data),
  assignProjectToCollection: (data) => ipcRenderer.invoke("collection:assignProject", data),
  exportCollection: (data) => ipcRenderer.invoke("collection:export", data),
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

  getReviewCollaboration: (data) =>
    ipcRenderer.invoke("reviewCollab:getState", data),

  addReviewCollaborator: (data) =>
    ipcRenderer.invoke("reviewCollab:addReviewer", data),

  toggleReviewCollaborator: (data) =>
    ipcRenderer.invoke("reviewCollab:toggleReviewer", data),

  createReviewAssignment: (data) =>
    ipcRenderer.invoke("reviewCollab:createAssignment", data),

  updateReviewAssignment: (data) =>
    ipcRenderer.invoke("reviewCollab:updateAssignment", data),

  addReviewComment: (data) =>
    ipcRenderer.invoke("reviewCollab:addComment", data),

  resolveReviewComment: (data) =>
    ipcRenderer.invoke("reviewCollab:resolveComment", data),

  exportReviewCollaborationReport: (data) =>
    ipcRenderer.invoke("reviewCollab:exportReport", data),

  getKnowledgeGraphWorkspace: () => ipcRenderer.invoke("knowledgeGraph:getWorkspace"),
  getProjectKnowledgeGraph: (data) => ipcRenderer.invoke("knowledgeGraph:getProject", data),
  extractKnowledgeGraph: (data) => ipcRenderer.invoke("knowledgeGraph:extract", data),
  discoverKnowledgeGraphRelationships: (data) => ipcRenderer.invoke("knowledgeGraph:discoverAi", data),
  getKnowledgeGraphAnalytics: (data) => ipcRenderer.invoke("knowledgeGraph:getAnalytics", data),
  addKnowledgeGraphEntity: (data) => ipcRenderer.invoke("knowledgeGraph:addEntity", data),
  addKnowledgeGraphRelationship: (data) => ipcRenderer.invoke("knowledgeGraph:addRelationship", data),
  reviewKnowledgeGraphItem: (data) => ipcRenderer.invoke("knowledgeGraph:review", data),
  mergeKnowledgeGraphEntities: (data) => ipcRenderer.invoke("knowledgeGraph:merge", data),
  exportKnowledgeGraph: (data) => ipcRenderer.invoke("knowledgeGraph:export", data),
  openKnowledgeGraphFile: (filePath) => ipcRenderer.invoke("knowledgeGraph:openFile", filePath),
  getEntityIntelligenceWorkspace: () => ipcRenderer.invoke("entityIntel:getWorkspace"),
  getEntityIntelligenceProject: (data) => ipcRenderer.invoke("entityIntel:getProject", data),
  saveEntityIntelligenceEntity: (data) => ipcRenderer.invoke("entityIntel:saveEntity", data),
  deleteEntityIntelligenceEntity: (data) => ipcRenderer.invoke("entityIntel:deleteEntity", data),
  saveEntityIntelligenceRelationship: (data) => ipcRenderer.invoke("entityIntel:saveRelationship", data),
  deleteEntityIntelligenceRelationship: (data) => ipcRenderer.invoke("entityIntel:deleteRelationship", data),
  saveEntityTimelineEvent: (data) => ipcRenderer.invoke("entityIntel:saveTimeline", data),
  saveEntityMapPoint: (data) => ipcRenderer.invoke("entityIntel:saveMap", data),
  compareKnowledgeEntities: (data) => ipcRenderer.invoke("entityIntel:compare", data),
  saveEntityGraphView: (data) => ipcRenderer.invoke("entityIntel:saveView", data),
  exportEntityIntelligence: (data) => ipcRenderer.invoke("entityIntel:export", data),
  openEntityIntelligenceFile: (filePath) => ipcRenderer.invoke("entityIntel:openFile", filePath),
  getTimelineWorkspace: () => ipcRenderer.invoke("timeline:getWorkspace"),
  getProjectTimeline: (data) => ipcRenderer.invoke("timeline:getProject", data),
  addTimelineEvent: (data) => ipcRenderer.invoke("timeline:addEvent", data),
  addTimelinePlace: (data) => ipcRenderer.invoke("timeline:addPlace", data),
  updateTimelinePlace: (data) => ipcRenderer.invoke("timeline:updatePlace", data),
  createNarrativeThread: (data) => ipcRenderer.invoke("timeline:createThread", data),
  updateNarrativeThread: (data) => ipcRenderer.invoke("timeline:updateThread", data),
  reviewTimelineItem: (data) => ipcRenderer.invoke("timeline:review", data),
  extractTimelineRules: (data) => ipcRenderer.invoke("timeline:extractRules", data),
  discoverTimelineWithAi: (data) => ipcRenderer.invoke("timeline:discoverAi", data),
  exportTimelineNarratives: (data) => ipcRenderer.invoke("timeline:export", data),
  openTimelineFile: (filePath) => ipcRenderer.invoke("timeline:openFile", filePath),
  getCrossProjectGraphWorkspace: () => ipcRenderer.invoke("crossGraph:getWorkspace"),
  compareCrossProjectGraphs: (data) => ipcRenderer.invoke("crossGraph:compare", data),
  decideCrossProjectEntityLink: (data) => ipcRenderer.invoke("crossGraph:decideLink", data),
  reviewCrossProjectVariant: (data) => ipcRenderer.invoke("crossGraph:reviewVariant", data),
  addCrossProjectComparisonNote: (data) => ipcRenderer.invoke("crossGraph:addNote", data),
  exportCrossProjectComparison: (data) => ipcRenderer.invoke("crossGraph:export", data),
  openCrossProjectComparisonFile: (filePath) => ipcRenderer.invoke("crossGraph:openFile", filePath),
  getGovernanceWorkspace: () => ipcRenderer.invoke("governance:getWorkspace"),
  getProjectGovernance: (data) => ipcRenderer.invoke("governance:getProject", data),
  saveGovernancePolicy: (data) => ipcRenderer.invoke("governance:savePolicy", data),
  signGovernanceApproval: (data) => ipcRenderer.invoke("governance:sign", data),
  scanGovernanceIntegrity: (data) => ipcRenderer.invoke("governance:scanIntegrity", data),
  publishGovernedAssignment: (data) => ipcRenderer.invoke("governance:publish", data),
  exportGovernanceCertificate: (data) => ipcRenderer.invoke("governance:exportCertificate", data),
  openGovernanceFile: (filePath) => ipcRenderer.invoke("governance:openFile", filePath),

  getPublicationDashboard: (data) =>
    ipcRenderer.invoke("publish:getDashboard", data),

  exportPublicationAuditLog: (data) =>
    ipcRenderer.invoke("publish:exportAuditLog", data),

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