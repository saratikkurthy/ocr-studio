export { };
type OcrQueueItem = {
    id: number;
    documentId: number;
    fileName: string;
    inputPath: string;

    status:
    | "Waiting"
    | "Processing"
    | "Completed"
    | "Failed"
    | "Cancelled";

    position: number;

    language: string;
    compression: string;
    outputType: string;

    addedAt: string;
    startedAt?: string;
    completedAt?: string;

    error?: string;
    outputPath?: string;
};


type WordIndexBackgroundJob = {
    id: string;
    type: "WordIndex";
    documentId: number;
    fileName: string;
    mode: "quick" | "full";
    language: string;
    status: "Queued" | "Running" | "Completed" | "Failed" | "Cancelled";
    progress: number;
    currentPage: number;
    totalPages: number;
    pageNumber: number;
    message: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
    attempt: number;
};

type OcrIndexedWord = {
    id: string;
    pageNumber: number;
    blockNumber: number;
    paragraphNumber: number;
    lineNumber: number;
    wordNumber: number;
    text: string;
    confidence: number;
    box: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    status: "Unreviewed" | "Verified" | "Corrected" | "Ignored";
    correctedText: string | null;
    verifiedAt: string | null;
};

type OcrWordIndexPage = {
    version: number;
    documentId: number;
    pageNumber: number;
    sourceFile: string;
    language: string;
    imageWidth: number;
    imageHeight: number;
    indexedAt: string;
    updatedAt?: string;
    reviewSummary?: {
        unreviewed: number;
        verified: number;
        corrected: number;
        ignored: number;
    };
    summary: {
        totalWords: number;
        lowConfidenceWords: number;
        veryLowConfidenceWords: number;
        averageConfidence: number;
    };
    words: OcrIndexedWord[];
};

type OcrWordIndexDocument = {
    documentId: number;
    fileName: string;
    language: string;
    mode: "quick" | "full";
    pageCount: number;
    indexedPageCount: number;
    failedPageCount: number;
    indexedPages: number[];
    failedPages: Array<{
        pageNumber: number;
        error: string;
    }>;
    totalWords: number;
    lowConfidenceWords: number;
    veryLowConfidenceWords: number;
    averageConfidence: number;
    startedAt: string;
    completedAt: string;
    status: "Completed" | "CompletedWithErrors" | "Cancelled";
};

type OcrWordIndexManifest = {
    version: number;
    documents: OcrWordIndexDocument[];
    updatedAt: string | null;
};

type PageConfidenceRecord = {
    documentId: number;
    fileName: string;
    pageNumber: number;
    language: string;
    confidence: number;
    confidenceLabel: string;
    wordCount: number;
    lowConfidenceWordCount: number;
    veryLowConfidenceWordCount: number;
    suspiciousWords: Array<{
        text: string;
        confidence: number;
    }>;
    status: "Completed" | "Failed";
    analyzedAt: string;
    error?: string;
};

type PdfAnalysis = {
    documentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;

    pageCount: number;
    pageSize: string;
    pdfVersion: string;
    encrypted: string;
    tagged: string;

    title: string;
    author: string;
    creator: string;
    producer: string;

    searchable: boolean;
    characterCount: number;
    wordCount: number;
    sampleText: string;

    imageCount: number;
    containsImages: boolean;
    estimatedDocumentType: string;

    qualityScore: number;
    qualityLabel: string;

    recommendation: "RUN_OCR" | "SKIP_OCR" | "REVIEW";
    recommendationLabel: string;
    recommendationReason: string;

    analysisStatus: "Completed" | "Failed";
    analyzedAt: string;
    error?: string;
};
type DocumentStatus =
    | "Imported"
    | "Processing"
    | "Converted"
    | "Failed"
    | "Cancelled";

type ImportedDocument = {
    id: number;
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    status: DocumentStatus;
    importedAt: string;

    processingStartedAt?: string;
    completedAt?: string;
    failedAt?: string;

    outputPath?: string;
    searchablePath?: string;
    compressedPath?: string;
    sidecarTxtPath?: string;

    inputSize?: number;
    outputSize?: number;
    reductionPercent?: number;
    lastError?: string;
};

type ProjectInfo = {
    id: number;
    name: string;
    description: string;
    language: string;
    workflow: string;
    status: string;
    workspacePath: string;
    projectPath: string;
    createdAt: string;
    updatedAt: string;
    compression: string;
};

type ProjectExport = {
    fileName: string;
    filePath: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
};

type OcrJob = {
    id: number;
    documentId?: number;
    fileName: string;
    status: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    message?: string;
    outputPath?: string;
    inputSize?: number;
    ocrSize?: number;
    outputSize?: number;
    reductionPercent?: number;
    sidecarTxtPath?: string;
};

type OcrResultItem = {
    documentId?: number;
    fileName: string;
    success: boolean;
    message?: string;
    outputPath?: string;
    searchablePath?: string;
    compressedPath?: string;
    sidecarTxtPath?: string;
    inputSize?: number;
    ocrSize?: number;
    outputSize?: number;
    reductionPercent?: number;
};

type ReviewCollaborationState = {
    version: number;
    reviewers: Array<{
        id: string;
        name: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    assignments: Array<{
        id: string;
        documentId: number;
        documentName: string;
        reviewerId: string;
        reviewerName: string;
        scope: "document" | "pages";
        pageStart: number | null;
        pageEnd: number | null;
        priority: string;
        note: string;
        status: string;
        createdAt: string;
        startedAt: string | null;
        completedAt: string | null;
        updatedAt: string;
    }>;
    comments: Array<{
        id: string;
        documentId: number;
        documentName: string;
        pageNumber: number | null;
        wordId: string | null;
        author: string;
        text: string;
        status: string;
        createdAt: string;
        resolvedAt: string | null;
        resolvedBy: string | null;
    }>;
    activity: Array<{
        id: string;
        action: string;
        details: string;
        createdAt: string;
    }>;
    updatedAt: string | null;
};

declare global {
    interface Window {
        ocrStudio: {
            getIiifWorkspace: () => Promise<any>;
            getIiifProject: (data: any) => Promise<any>;
            saveIiifManifest: (data: any) => Promise<any>;
            deleteIiifManifest: (data: any) => Promise<any>;
            saveIiifCanvas: (data: any) => Promise<any>;
            deleteIiifCanvas: (data: any) => Promise<any>;
            saveIiifAnnotation: (data: any) => Promise<any>;
            deleteIiifAnnotation: (data: any) => Promise<any>;
            saveIiifSettings: (data: any) => Promise<any>;
            exportIiifManifest: (data: any) => Promise<any>;
            exportIiifAnnotations: (data: any) => Promise<any>;
            openIiifFile: (filePath: string) => Promise<any>;
            getParallelCorpusWorkspace: (data: any) => Promise<any>;
            saveParallelCorpus: (data: any) => Promise<any>;
            deleteParallelCorpus: (data: any) => Promise<any>;
            saveParallelAlignment: (data: any) => Promise<any>;
            deleteParallelAlignment: (data: any) => Promise<any>;
            saveTranslationMemory: (data: any) => Promise<any>;
            saveCorpusTerm: (data: any) => Promise<any>;
            deleteCorpusTerm: (data: any) => Promise<any>;
            suggestParallelTranslation: (data: any) => Promise<any>;
            getParallelCorpusQuality: (data: any) => Promise<any>;
            exportParallelCorpus: (data: any) => Promise<any>;
            openParallelCorpusExport: (filePath: string) => Promise<any>;
            getCriticalApparatus: (data: any) => Promise<any>;
            saveCriticalApparatusEntry: (data: any) => Promise<any>;
            saveCriticalApparatusSettings: (data: any) => Promise<any>;
            exportCriticalApparatus: (data: any) => Promise<any>;
            openCriticalApparatusExport: (filePath: string) => Promise<any>;
            getStemmaAnalysis: (data: any) => Promise<any>;
            analyzeStemma: (data: any) => Promise<any>;
            saveStemmaRelationship: (data: any) => Promise<any>;
            deleteStemmaRelationship: (data: any) => Promise<any>;
            exportStemmaAnalysis: (data: any) => Promise<any>;
            openStemmaExport: (filePath: string) => Promise<any>;
            getManuscriptWorkspace: (data: any) => Promise<any>;
            saveManuscriptWitness: (data: any) => Promise<any>;
            deleteManuscriptWitness: (data: any) => Promise<any>;
            saveWitnessGroup: (data: any) => Promise<any>;
            deleteWitnessGroup: (data: any) => Promise<any>;
            buildWitnessCollation: (data: any) => Promise<any>;
            saveWitnessCollation: (data: any) => Promise<any>;
            deleteWitnessCollation: (data: any) => Promise<any>;
            exportWitnessCollation: (data: any) => Promise<any>;
            openWitnessExport: (filePath: string) => Promise<any>;
            getEditionComparisonCatalog: (data: any) => Promise<any>;
            compareScholarlyEditions: (data: any) => Promise<any>;
            saveEditionComparison: (data: any) => Promise<any>;
            listEditionComparisons: (data: any) => Promise<any>;
            getSavedEditionComparison: (data: any) => Promise<any>;
            deleteEditionComparison: (data: any) => Promise<any>;
            exportEditionComparison: (data: any) => Promise<any>;
            openEditionComparison: (filePath: string) => Promise<any>;
            getScholarlyLibrary: (data: any) => Promise<any>;
            createLibraryCollection: (data: any) => Promise<any>;
            updateLibraryCollection: (data: any) => Promise<any>;
            deleteLibraryCollection: (data: any) => Promise<any>;
            searchScholarlyLibrary: (data: any) => Promise<any>;
            openLibraryEdition: (data: any) => Promise<any>;
            getCriticalTextWorkspace: (data: any) => Promise<any>;
            addEditionBook: (data: any) => Promise<any>;
            addEditionChapter: (data: any) => Promise<any>;
            saveEditionVerse: (data: any) => Promise<any>;
            deleteEditionVerse: (data: any) => Promise<any>;
            saveEditionApparatus: (data: any) => Promise<any>;
            deleteEditionApparatus: (data: any) => Promise<any>;
            saveEditionCommentary: (data: any) => Promise<any>;
            deleteEditionCommentary: (data: any) => Promise<any>;
            saveEditionFootnote: (data: any) => Promise<any>;
            deleteEditionFootnote: (data: any) => Promise<any>;
            saveEditorialDecision: (data: any) => Promise<any>;
            deleteEditorialDecision: (data: any) => Promise<any>;
            listEditions: (data: { workspacePath: string }) => Promise<any>;
            createEdition: (data: any) => Promise<any>;
            updateEdition: (data: any) => Promise<any>;
            deleteEdition: (data: { workspacePath: string; id: string }) => Promise<any>;
            duplicateEdition: (data: { workspacePath: string; id: string }) => Promise<any>;
            openEditionFolder: (data: { workspacePath: string; id: string }) => Promise<any>;
            getEditionValidation: (data: any) => Promise<any>;
            getEditionPublicationCenter: (data: any) => Promise<any>;
            saveEditionPublicationMetadata: (data: any) => Promise<any>;
            generateEditionPublication: (data: any) => Promise<any>;
            openEditionPublication: (filePath: string) => Promise<any>;
            runEditionValidation: (data: any) => Promise<any>;
            exportEditionValidation: (data: any) => Promise<any>;
            openEditionValidation: (filePath: string) => Promise<any>;

            getResearchDiscovery: (data: { workspacePath: string }) => Promise<any>;
            analyzeResearchDiscovery: (data: { workspacePath: string }) => Promise<any>;
            openResearchDiscoverySource: (filePath: string) => Promise<any>;
            getCorpusIntelligence: (data: { workspacePath: string }) => Promise<any>;
            analyzeCorpusIntelligence: (data: { workspacePath: string }) => Promise<any>;
            searchCorpusIntelligence: (data: { workspacePath: string; query: string; limit?: number }) => Promise<any>;
            getConceptEvolution: (data: { workspacePath: string; concept: string }) => Promise<any>;
            openCorpusSource: (filePath: string) => Promise<any>;
            listEvidenceResearchSessions: (data: { workspacePath: string }) => Promise<any>;
            getEvidenceResearchSession: (data: { workspacePath: string; sessionId: string }) => Promise<any>;
            deleteEvidenceResearchSession: (data: { workspacePath: string; sessionId: string }) => Promise<any>;
            listEvidenceResearchScopes: (data: { workspacePath: string }) => Promise<any>;
            askEvidenceResearchAssistant: (data: any) => Promise<any>;
            exportEvidenceResearchSession: (data: { workspacePath: string; sessionId: string }) => Promise<any>;
            openEvidenceResearchExport: (filePath: string) => Promise<any>;
            listResearchCanvases: (data: { workspacePath: string }) => Promise<any>;
            createResearchCanvas: (data: { workspacePath: string; canvas: any }) => Promise<any>;
            updateResearchCanvas: (data: { workspacePath: string; canvas: any }) => Promise<any>;
            deleteResearchCanvas: (data: { workspacePath: string; canvasId: string }) => Promise<any>;
            exportResearchCanvas: (data: { workspacePath: string; canvasId: string; format: "json" | "svg" | "html" }) => Promise<any>;
            openResearchCanvasSource: (filePath: string) => Promise<any>;
            getCrossProjectGraphWorkspace: () => Promise<any>;
            compareCrossProjectGraphs: (data: { projectIds: number[] }) => Promise<any>;
            decideCrossProjectEntityLink: (data: { linkId: string; decision: string; note?: string }) => Promise<any>;
            reviewCrossProjectVariant: (data: { variantId: string; decision: string; note?: string }) => Promise<any>;
            addCrossProjectComparisonNote: (data: { title: string; body: string; comparisonId?: string | null }) => Promise<any>;
            exportCrossProjectComparison: (data: { format: "json" | "html" }) => Promise<any>;
            openCrossProjectComparisonFile: (filePath: string) => Promise<any>;

            getTimelineWorkspace: () => Promise<any>;
            getProjectTimeline: (data: { projectPath: string }) => Promise<any>;
            addTimelineEvent: (data: any) => Promise<any>;
            addTimelinePlace: (data: any) => Promise<any>;
            updateTimelinePlace: (data: any) => Promise<any>;
            createNarrativeThread: (data: any) => Promise<any>;
            updateNarrativeThread: (data: any) => Promise<any>;
            reviewTimelineItem: (data: any) => Promise<any>;
            extractTimelineRules: (data: any) => Promise<any>;
            discoverTimelineWithAi: (data: any) => Promise<any>;
            exportTimelineNarratives: (data: { projectPath: string }) => Promise<any>;
            openTimelineFile: (filePath: string) => Promise<any>;
            getKnowledgeGraphWorkspace: () => Promise<any>;
            getProjectKnowledgeGraph: (data: { projectPath: string }) => Promise<any>;
            extractKnowledgeGraph: (data: { projectPath: string }) => Promise<any>;
            discoverKnowledgeGraphRelationships: (data: { projectPath: string; endpoint?: string; model?: string; pageLimit?: number; documentId?: number | null }) => Promise<any>;
            getKnowledgeGraphAnalytics: (data: { projectPath: string }) => Promise<any>;
            addKnowledgeGraphEntity: (data: any) => Promise<any>;
            addKnowledgeGraphRelationship: (data: any) => Promise<any>;
            reviewKnowledgeGraphItem: (data: any) => Promise<any>;
            mergeKnowledgeGraphEntities: (data: any) => Promise<any>;
            exportKnowledgeGraph: (data: { projectPath: string }) => Promise<any>;
            openKnowledgeGraphFile: (filePath: string) => Promise<any>;
            getEntityIntelligenceWorkspace: () => Promise<any>;
            getEntityIntelligenceProject: (data: { projectPath: string }) => Promise<any>;
            saveEntityIntelligenceEntity: (data: any) => Promise<any>;
            deleteEntityIntelligenceEntity: (data: { projectPath: string; id: string }) => Promise<any>;
            saveEntityIntelligenceRelationship: (data: any) => Promise<any>;
            deleteEntityIntelligenceRelationship: (data: { projectPath: string; id: string }) => Promise<any>;
            saveEntityTimelineEvent: (data: any) => Promise<any>;
            saveEntityMapPoint: (data: any) => Promise<any>;
            compareKnowledgeEntities: (data: { projectPath: string; entityIds: string[] }) => Promise<any>;
            saveEntityGraphView: (data: any) => Promise<any>;
            exportEntityIntelligence: (data: { projectPath: string; format: string }) => Promise<any>;
            openEntityIntelligenceFile: (filePath: string) => Promise<any>;
            getScholarlyAssistantWorkspace: (data: { projectPath?: string }) => Promise<any>;
            rebuildScholarlySemanticIndex: (data: { projectPath: string }) => Promise<any>;
            askScholarlyAssistant: (data: { projectPath: string; conversationId?: string | null; question: string; limit?: number }) => Promise<any>;
            deleteScholarlyConversation: (data: { projectPath: string; id: string }) => Promise<any>;
            saveScholarlyNotebook: (data: any) => Promise<any>;
            deleteScholarlyNotebook: (data: { projectPath: string; id: string }) => Promise<any>;
            saveScholarlyPrompt: (data: any) => Promise<any>;
            saveScholarlyBookmark: (data: any) => Promise<any>;
            deleteScholarlyBookmark: (data: { projectPath: string; id: string }) => Promise<any>;
            generateScholarlyCitation: (data: any) => Promise<any>;
            exportScholarlyConversation: (data: { projectPath: string; conversationId: string; format: string }) => Promise<any>;
            openScholarlyAssistantFile: (filePath: string) => Promise<any>;
            getGovernanceWorkspace: () => Promise<any>;
            getProjectGovernance: (data: { projectPath: string }) => Promise<any>;
            saveGovernancePolicy: (data: { projectPath: string; policy: any }) => Promise<any>;
            signGovernanceApproval: (data: { projectPath: string; assignmentId: string; reviewer: string; role: string; comment: string }) => Promise<any>;
            scanGovernanceIntegrity: (data: { projectPath: string }) => Promise<any>;
            publishGovernedAssignment: (data: { projectPath: string; assignmentId: string; actor: string; note: string }) => Promise<any>;
            exportGovernanceCertificate: (data: { projectPath: string; publicationId: string }) => Promise<any>;
            openGovernanceFile: (filePath: string) => Promise<any>;
            listResearchReports: (data: { workspacePath: string }) => Promise<any>;
            getResearchReport: (data: { workspacePath: string; reportId: string }) => Promise<any>;
            runResearchCopilot: (data: { workspacePath: string; collectionId?: string | null; mode: string; question: string }) => Promise<any>;
            deleteResearchReport: (data: { workspacePath: string; reportId: string }) => Promise<any>;
            exportResearchReport: (data: { workspacePath: string; reportId: string; format: "markdown" | "html" | "json" }) => Promise<any>;
            openResearchExport: (filePath: string) => Promise<any>;

            getAssistantSettings: (data: { workspacePath: string }) => Promise<any>;
            saveAssistantSettings: (data: { workspacePath: string; settings: any }) => Promise<any>;
            checkOllama: (data: { endpoint: string }) => Promise<any>;
            listAssistantConversations: (data: { workspacePath: string }) => Promise<any>;
            getAssistantConversation: (data: { workspacePath: string; conversationId: string }) => Promise<any>;
            deleteAssistantConversation: (data: { workspacePath: string; conversationId: string }) => Promise<any>;
            askManuscriptAssistant: (data: { workspacePath: string; collectionId: string | null; conversationId: string | null; question: string; settings: any }) => Promise<any>;
            getManuscriptIndexStatus: (data: { workspacePath: string }) => Promise<{ success: boolean; message: string; metadata: any | null }>;
            buildManuscriptIndex: (data: { workspacePath: string; chunkWords: number; overlap: number }) => Promise<{ success: boolean; message: string; metadata: any | null }>;
            searchManuscriptIndex: (data: { workspacePath: string; collectionId: string | null; query: string; limit: number }) => Promise<{ success: boolean; message: string; results: any[]; metadata?: any }>;
            openManuscriptIndexPath: (filePath: string) => Promise<{ success: boolean; message: string }>;
            scanDuplicates: (data: { workspacePath: string; collectionId?: string | null; threshold?: number }) => Promise<any>;
            getDuplicateRegistry: (data: { workspacePath: string }) => Promise<any>;
            exportDuplicateReport: (data: { workspacePath: string }) => Promise<{ success: boolean; message: string; files: string[] }>;
            openDuplicateReport: (filePath: string) => Promise<string>;
            searchAcrossProjects: (data: {
                workspacePath: string;
                collectionId: string | null;
                query: string;
                mode: string;
                limit: number;
            }) => Promise<{
                success: boolean;
                message: string;
                results: Array<{
                    id: string;
                    projectId: number;
                    projectName: string;
                    projectPath: string;
                    documentId: number;
                    documentName: string;
                    pageNumber: number;
                    wordId: string | null;
                    text: string;
                    originalText: string;
                    correctedText: string | null;
                    confidence: number;
                    status: string;
                    language: string;
                    context: Array<{
                        id: string | null;
                        text: string;
                        selected: boolean;
                        confidence: number;
                    }>;
                }>;
                summary: {
                    projects: number;
                    matchedProjects: number;
                    documents: number;
                    pages: number;
                    words: number;
                    matches: number;
                };
                truncated: boolean;
                scope?: {
                    type: string;
                    id: string | null;
                    name: string;
                };
            }>;

            exportCrossProjectSearch: (data: {
                workspacePath: string;
                query: string;
                results: any[];
            }) => Promise<{
                success: boolean;
                message: string;
                filePath: string | null;
            }>;

            listCollections: (data: { workspacePath: string }) => Promise<{ success: boolean; collections: any[]; unassignedProjects: any[] }>;
            createCollection: (data: any) => Promise<{ success: boolean; message: string; collection?: any }>;
            updateCollection: (data: any) => Promise<{ success: boolean; message: string; collection?: any }>;
            deleteCollection: (data: { workspacePath: string; collectionId: string }) => Promise<{ success: boolean; message: string }>;
            assignProjectToCollection: (data: { workspacePath: string; projectId: number; collectionId: string | null }) => Promise<{ success: boolean; message: string }>;
            exportCollection: (data: { workspacePath: string; collectionId: string }) => Promise<{ success: boolean; message: string; filePath: string | null }>;

            selectWorkspaceFolder: () => Promise<string | null>;
            listOcrQueue: (data: {
                projectPath: string;
            }) => Promise<OcrQueueItem[]>;

            addToOcrQueue: (data: {
                projectPath: string;
                documentIds: number[];
                language: string;
                compression?: string;
                outputType?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                queue: OcrQueueItem[];
            }>;

            removeFromOcrQueue: (data: {
                projectPath: string;
                queueItemId: number;
            }) => Promise<{
                success: boolean;
                message: string;
                queue: OcrQueueItem[];
            }>;

            clearCompletedQueueItems: (data: {
                projectPath: string;
            }) => Promise<OcrQueueItem[]>;

            createProject: (data: {
                name: string;
                description: string;
                language: string;
                workflow: string;
                workspacePath: string;
                compression?: string;
            }) => Promise<ProjectInfo>;

            getWorkspaceIntelligence: (data: { workspacePath: string }) => Promise<{ success: boolean; message?: string; dashboard: any }>;
            exportWorkspaceIntelligence: (data: { workspacePath: string }) => Promise<{ success: boolean; message: string; filePath: string | null }>;
            listRecentProjects: () => Promise<ProjectInfo[]>;
            listResearchNotebooks: (data: { workspacePath: string }) => Promise<{ notebooks: any[]; updatedAt: string | null }>;
            createResearchNotebook: (data: any) => Promise<any>;
            updateResearchNotebook: (data: any) => Promise<any>;
            deleteResearchNotebook: (data: any) => Promise<{ success: boolean }>;
            addResearchEvidence: (data: any) => Promise<any>;
            removeResearchEvidence: (data: any) => Promise<{ success: boolean }>;
            exportResearchNotebook: (data: any) => Promise<{ canceled: boolean; filePath?: string }>;
            openResearchSource: (filePath: string) => Promise<string>;
            listCitations: (data: { workspacePath: string; notebookId?: string }) => Promise<any>;
            createCitation: (data: any) => Promise<any>;
            createCitationFromEvidence: (data: any) => Promise<any>;
            updateCitation: (data: any) => Promise<any>;
            deleteCitation: (data: any) => Promise<any>;
            buildBibliography: (data: any) => Promise<any>;
            validateCitations: (data: any) => Promise<any>;
            exportCitations: (data: any) => Promise<any>;
            openCitationSource: (filePath: string) => Promise<string>;

            openInputFolder: (projectPath: string) => Promise<string>;

            openPath: (filePath: string) => Promise<string>;

            checkOcrTools: () => Promise<{
                tesseract: {
                    installed: boolean;
                    output: string;
                };
                ocrmypdf: {
                    installed: boolean;
                    output: string;
                };
            }>;

            importFilesToProject: (data: {
                projectPath: string;
            }) => Promise<ImportedDocument[]>;

            listProjectDocuments: (data: {
                projectPath: string;
            }) => Promise<ImportedDocument[]>;

            listOcrJobs: (data: {
                projectPath: string;
            }) => Promise<OcrJob[]>;

            runOcrForProject: (data: {
                projectPath: string;
                language: string;
                compression?: string;
                outputType?: string;
                documentIds?: number[];
                allowReprocess?: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                outputPath?: string;
                inputSize?: number;
                ocrSize?: number;
                outputSize?: number;
                reductionPercent?: number;
                results?: OcrResultItem[];
            }>;

            listProjectExports: (data: {
                projectPath: string;
            }) => Promise<ProjectExport[]>;

            getPdfPreviewUrl: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                url: string | null;
            }>;

            listWordIndexJobs: (data: {
                projectPath: string;
            }) => Promise<WordIndexBackgroundJob[]>;

            enqueueWordIndexJob: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
                job?: WordIndexBackgroundJob;
            }>;

            cancelWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            retryWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            removeWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            onWordIndexQueueUpdated: (
                callback: (data: {
                    projectPath: string;
                    jobs: WordIndexBackgroundJob[];
                }) => void
            ) => void;

            listPageRevisions: (data: { projectPath: string; documentId: number; pageNumber: number }) => Promise<{ success: boolean; revisions: Array<{ id: string; documentId: number; pageNumber: number; createdAt: string; action: string; actor: string; comment: string; sourceRevisionId: string | null; pageHash: string; summary: unknown; wordCount: number }> }>;
            getPageRevision: (data: { projectPath: string; documentId: number; pageNumber: number; revisionId: string }) => Promise<{ success: boolean; message?: string; revision: any | null }>;
            diffPageRevisions: (data: { projectPath: string; documentId: number; pageNumber: number; leftRevisionId: string; rightRevisionId: string }) => Promise<{ success: boolean; message?: string; diff: { added: number; removed: number; modified: number; changes: Array<any> } | null; left?: any; right?: any }>;
            restorePageRevision: (data: { projectPath: string; documentId: number; pageNumber: number; revisionId: string; comment?: string }) => Promise<{ success: boolean; message: string; page: OcrWordIndexPage | null }>;

            getWordIndexManifest: (data: {
                projectPath: string;
            }) => Promise<OcrWordIndexManifest>;

            getWordIndexPage: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
            }) => Promise<OcrWordIndexPage | null>;

            updateWordIndexWord: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                action: "correct" | "verify" | "ignore" | "reset";
                correctedText?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                page: OcrWordIndexPage | null;
                word?: OcrIndexedWord;
            }>;

            getWordCorrectionHistory: (data: {
                projectPath: string;
                documentId?: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                action: string;
                originalText: string;
                previousStatus: string;
                previousCorrectedText: string | null;
                status: string;
                correctedText: string | null;
                changedAt: string;
            }>>;

            getCorrectionMemory: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<{
                success: boolean;
                message: string;
                memory: Array<{
                    sourceText: string;
                    normalizedSource: string;
                    correctedText: string;
                    timesApplied: number;
                    lastUsedAt: string | null;
                }>;
            }>;

            previewBatchCorrection: (data: {
                projectPath: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                maxConfidence?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                totalMatches: number;
                matches: Array<{
                    documentId: number;
                    pageNumber: number;
                    wordId: string;
                    text: string;
                    confidence: number;
                    status: string;
                    correctedText: string | null;
                    box: {
                        left: number;
                        top: number;
                        width: number;
                        height: number;
                    };
                }>;
            }>;

            getReviewCollaboration: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            addReviewCollaborator: (data: {
                projectPath: string;
                name: string;
                role: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            toggleReviewCollaborator: (data: {
                projectPath: string;
                reviewerId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            createReviewAssignment: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                reviewerId: string;
                scope: "document" | "pages";
                pageStart: number;
                pageEnd: number;
                priority: string;
                note: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            updateReviewAssignment: (data: {
                projectPath: string;
                assignmentId: string;
                status: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            addReviewComment: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                pageNumber: number | null;
                wordId: string | null;
                author: string;
                text: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            resolveReviewComment: (data: {
                projectPath: string;
                commentId: string;
                resolvedBy: string;
            }) => Promise<{
                success: boolean;
                message: string;
                state: ReviewCollaborationState | null;
            }>;

            exportReviewCollaborationReport: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                filePath: string | null;
            }>;

            getPublicationDashboard: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                dashboard: {
                    generatedAt: string;
                    engineStatus: "Idle" | "Running" | "Paused" | "Recovering";
                    settings: {
                        workerCount: number;
                        isPaused: boolean;
                    };
                    counts: {
                        total: number;
                        queued: number;
                        running: number;
                        completed: number;
                        failed: number;
                        cancelled: number;
                    };
                    averageDurationMs: number;
                    estimatedRemainingMs: number;
                    totalGeneratedFiles: number;
                    totalGeneratedBytes: number;
                    recentCompleted: number;
                    totalChangedPages: number;
                    totalUnchangedPages: number;
                    workerUtilizationPercent: number;
                    recentJobs: Array<{
                        id: string;
                        documentName: string;
                        status: string;
                        progress: number;
                        durationMs: number;
                        createdAt: string;
                        completedAt: string | null;
                        files: number;
                        error: string | null;
                    }>;
                } | null;
            }>;

            exportPublicationAuditLog: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                filePath: string | null;
            }>;

            getPublicationSettings: (data: {
                projectPath: string;
            }) => Promise<{
                workerCount: number;
                isPaused: boolean;
            }>;

            updatePublicationSettings: (data: {
                projectPath: string;
                workerCount?: number;
                isPaused?: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                settings: {
                    workerCount: number;
                    isPaused: boolean;
                };
            }>;

            previewIncrementalPublication: (data: {
                projectPath: string;
                documentId: number;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                preview: {
                    hasPreviousSnapshot: boolean;
                    changedPageNumbers: number[];
                    unchangedPageNumbers: number[];
                    previousPublishedAt: string | null;
                    totalPages: number;
                } | null;
            }>;

            listPublicationProfiles: (data: {
                projectPath: string;
            }) => Promise<Array<{
                id: string;
                name: string;
                options: Record<string, boolean>;
                createdAt: string;
                updatedAt: string;
            }>>;

            savePublicationProfile: (data: {
                projectPath: string;
                name: string;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                profiles: Array<{
                    id: string;
                    name: string;
                    options: Record<string, boolean>;
                    createdAt: string;
                    updatedAt: string;
                }>;
            }>;

            deletePublicationProfile: (data: {
                projectPath: string;
                profileId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                profiles: Array<{
                    id: string;
                    name: string;
                    options: Record<string, boolean>;
                    createdAt: string;
                    updatedAt: string;
                }>;
            }>;

            listPublicationQueue: (data: {
                projectPath: string;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                documentName: string;
                profileId: string | null;
                profileName: string | null;
                options: Record<string, boolean>;
                status: "Queued" | "Running" | "Completed" | "Failed" | "Cancelled";
                progress: number;
                message: string;
                createdAt: string;
                startedAt: string | null;
                completedAt: string | null;
                durationMs: number | null;
                folderPath: string | null;
                files: Array<{
                    type: string;
                    fileName: string;
                    filePath: string;
                }>;
                error: string | null;
                attempts: number;
            }>>;

            enqueuePublicationJobs: (data: {
                projectPath: string;
                documents: Array<{
                    documentId: number;
                    documentName: string;
                    basePdf?: string | null;
                }>;
                profileId?: string | null;
                profileName?: string | null;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            retryPublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            cancelPublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            removePublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            resumePublicationQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            validatePublishedDocument: (data: {
                projectPath: string;
                documentId: number;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                validation: {
                    valid: boolean;
                    missingPages: number[];
                    emptyPages: number[];
                    malformedWords: number;
                    invalidBoxes: number;
                    duplicateWordIds: number;
                } | null;
                summary: {
                    pages: number;
                    words: number;
                    corrected: number;
                    verified: number;
                    ignored: number;
                    unreviewed: number;
                    publishedWords: number;
                } | null;
            }>;

            createPublishedBundle: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                    exportTxt: boolean;
                    exportJson: boolean;
                    exportCsv: boolean;
                    exportHtml: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                files: Array<{
                    type: string;
                    fileName: string;
                    filePath: string;
                }>;
                record: {
                    id: string;
                    documentId: number;
                    documentName: string;
                    version: number;
                    publishedAt: string;
                    durationMs: number;
                    folderPath: string;
                    summary: {
                        pages: number;
                        words: number;
                        corrected: number;
                        verified: number;
                        ignored: number;
                        unreviewed: number;
                        publishedWords: number;
                    };
                    validation: {
                        valid: boolean;
                        missingPages: number[];
                        emptyPages: number[];
                        malformedWords: number;
                        invalidBoxes: number;
                        duplicateWordIds: number;
                    };
                    files: Array<{
                        type: string;
                        fileName: string;
                        filePath: string;
                    }>;
                } | null;
            }>;

            createCorrectedSearchablePdf: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                basePdf: string;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                outputPdf: string | null;
                record: {
                    id: string;
                    version: number;
                    folderPath: string;
                    searchablePdf: {
                        fileName: string;
                        filePath: string;
                        size: number;
                        extractedCharacters: number;
                        fontPath: string | null;
                        missingIndexPages: number[];
                    };
                } | null;
            }>;

            listPublishHistory: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                documentName: string;
                version: number;
                publishedAt: string;
                durationMs: number;
                folderPath: string;
                summary: {
                    pages: number;
                    words: number;
                    corrected: number;
                    verified: number;
                    ignored: number;
                    unreviewed: number;
                    publishedWords: number;
                };
                validation: {
                    valid: boolean;
                    missingPages: number[];
                    emptyPages: number[];
                    malformedWords: number;
                    invalidBoxes: number;
                    duplicateWordIds: number;
                };
                files: Array<{
                    type: string;
                    fileName: string;
                    filePath: string;
                }>;
            }>>;

            listBatchCorrectionTransactions: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                createdAt: string;
                applied: number;
                failed: number;
                undoneAt: string | null;
                undoRestored: number;
                undoFailed: number;
            }>>;

            undoBatchCorrection: (data: {
                projectPath: string;
                transactionId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                restored: number;
                failed: number;
            }>;

            listCorrectionRules: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                maxConfidence: number;
                isEnabled: boolean;
                createdAt: string;
                updatedAt: string;
                appliedCount: number;
                lastAppliedAt: string | null;
            }>>;

            saveCorrectionRule: (data: {
                projectPath: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                maxConfidence: number;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
                    id: string;
                    documentId: number;
                    sourceText: string;
                    correctedText: string;
                    maxConfidence: number;
                    isEnabled: boolean;
                    createdAt: string;
                    updatedAt: string;
                    appliedCount: number;
                    lastAppliedAt: string | null;
                }>;
            }>;

            toggleCorrectionRule: (data: {
                projectPath: string;
                ruleId: string;
                isEnabled: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
                    id: string;
                    documentId: number;
                    sourceText: string;
                    correctedText: string;
                    maxConfidence: number;
                    isEnabled: boolean;
                    createdAt: string;
                    updatedAt: string;
                    appliedCount: number;
                    lastAppliedAt: string | null;
                }>;
            }>;

            deleteCorrectionRule: (data: {
                projectPath: string;
                documentId: number;
                ruleId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
                    id: string;
                    documentId: number;
                    sourceText: string;
                    correctedText: string;
                    maxConfidence: number;
                    isEnabled: boolean;
                    createdAt: string;
                    updatedAt: string;
                    appliedCount: number;
                    lastAppliedAt: string | null;
                }>;
            }>;

            applyBatchCorrection: (data: {
                projectPath: string;
                documentId: number;
                correctedText: string;
                matches: Array<{
                    pageNumber: number;
                    wordId: string;
                }>;
            }) => Promise<{
                success: boolean;
                message: string;
                applied: number;
                failed: number;
            }>;

            suggestWordCorrections: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                limit?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                sourceText?: string;
                scannedPages: number;
                context: Array<{
                    id: string;
                    text: string;
                    selected: boolean;
                    confidence: number;
                }>;
                suggestions: Array<{
                    text: string;
                    score: number;
                    similarity: number;
                    occurrences: number;
                    averageConfidence: number;
                    correctedOccurrences: number;
                    verifiedOccurrences: number;
                    reason: string;
                    examples: Array<{
                        pageNumber: number;
                        confidence: number;
                        status: string;
                    }>;
                }>;
            }>;

            searchWordIndexDocument: (data: {
                projectPath: string;
                documentId: number;
                query: string;
                mode: "all" | "review" | "poor" | "unreviewed";
                limit?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                results: Array<
                    OcrIndexedWord & {
                        documentId: number;
                        sourceFile: string;
                    }
                >;
                scannedPages: number;
                totalMatches: number;
                truncated: boolean;
            }>;

            getWordIndexReviewQueue: (data: {
                projectPath: string;
                documentId: number;
                limit?: number;
            }) => Promise<{
                success: boolean;
                results: Array<
                    OcrIndexedWord & {
                        documentId: number;
                        sourceFile: string;
                    }
                >;
                scannedPages: number;
                totalMatches: number;
                truncated: boolean;
            }>;

            buildWordIndex: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                cancelled?: boolean;
                message: string;
                manifest: OcrWordIndexManifest;
            }>;

            cancelWordIndex: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            clearWordIndex: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<OcrWordIndexManifest>;

            onWordIndexProgress: (
                callback: (data: {
                    projectPath: string;
                    documentId: number;
                    fileName: string;
                    pageNumber: number;
                    current: number;
                    total: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            listPageConfidence: (data: {
                projectPath: string;
            }) => Promise<PageConfidenceRecord[]>;

            analyzePageConfidence: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                cancelled?: boolean;
                message: string;
                records: PageConfidenceRecord[];
            }>;

            cancelPageConfidence: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            clearPageConfidence: (data: {
                projectPath: string;
                documentId?: number;
            }) => Promise<PageConfidenceRecord[]>;

            onPageConfidenceProgress: (
                callback: (data: {
                    projectPath: string;
                    documentId: number;
                    fileName: string;
                    pageNumber: number;
                    current: number;
                    total: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            getPdfInfo: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                pageCount: number;
                pageWidth?: number;
                pageHeight?: number;
            }>;

            renderPdfPage: (data: {
                filePath: string;
                pageNumber: number;
                scalePercent: number;
            }) => Promise<{
                success: boolean;
                message: string;
                dataUrl: string | null;
                pageNumber: number;
                scalePercent: number;
            }>;

            readPdfFile: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                data: Uint8Array | null;
            }>;

            verifyPdfTextLayer: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                characterCount: number;
                sampleText: string;
            }>;

            deleteProject: (data: {
                projectId: number;
                projectPath?: string;
                deleteFiles: boolean;
            }) => Promise<ProjectInfo[]>;

            deleteProjectDocument: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<ImportedDocument[]>;

            deleteProjectExport: (data: {
                projectPath: string;
                filePath: string;
            }) => Promise<ProjectExport[]>;

            getEditorialDecisionWorkspace: (data: any) => Promise<any>;
            transitionEditorialDecision: (data: any) => Promise<any>;
            addEditorialDecisionEvidence: (data: any) => Promise<any>;
            deleteEditorialDecisionEvidence: (data: any) => Promise<any>;
            restoreEditorialDecisionRevision: (data: any) => Promise<any>;
            compareEditorialDecisions: (data: any) => Promise<any>;
            listEditorialAiSuggestions: (data: any) => Promise<any>;
            generateEditorialAiSuggestions: (data: any) => Promise<any>;
            updateEditorialAiSuggestion: (data: any) => Promise<any>;

            cancelOcr: () => Promise<{
                success: boolean;
                message: string;
            }>;

            onOcrProgress: (
                callback: (data: {
                    fileName: string;
                    currentPage?: number;
                    totalPages?: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            onOcrDocumentStatus: (
                callback: (data: {
                    documentId: number;
                    status: DocumentStatus;
                }) => void
            ) => void;


            startOcrQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                status: "Running" | "Idle" | "Stopping" | "Stopped";
                queue: OcrQueueItem[];
            }>;

            stopOcrQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                status: "Running" | "Idle" | "Stopping" | "Stopped";
                queue: OcrQueueItem[];
            }>;

            getOcrQueueStatus: (data: {
                projectPath: string;
            }) => Promise<{
                status: "Running" | "Idle";
                running: boolean;
                queue: OcrQueueItem[];
            }>;

            onOcrQueueUpdated: (
                callback: (data: {
                    projectPath: string;
                    queue: OcrQueueItem[];
                }) => void
            ) => void;

            onOcrQueueWorkerStatus: (
                callback: (data: {
                    projectPath: string;
                    status: "Running" | "Idle" | "Stopping" | "Stopped";
                    message: string;
                    queueItemId?: number;
                }) => void
            ) => void;

            analyzeProject: (data: {
                projectPath: string;
                documentIds?: number[];
            }) => Promise<{
                success: boolean;
                message: string;
                analyses: PdfAnalysis[];
                completedCount?: number;
                failedCount?: number;
            }>;

            listProjectAnalysis: (data: {
                projectPath: string;
            }) => Promise<PdfAnalysis[]>;

            onAnalysisProgress: (
                callback: (data: {
                    documentId: number;
                    fileName: string;
                    current: number;
                    total: number;
                    percent: number;
                    message: string;
                }) => void
            ) => void;
        };
    }
}