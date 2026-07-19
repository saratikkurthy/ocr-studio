export type WorkspaceTab =
    | "overview"
    | "documents"
    | "analysis"
    | "queue"
    | "outputs"
    | "history";

export type ProjectExport = {
    fileName: string;
    filePath: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
};

export type OcrQueueItem = {
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

export type OcrJob = {
    id: number;
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

export type ProjectDocument = {
    id: number;
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    status:
        | "Imported"
        | "Processing"
        | "Converted"
        | "Failed"
        | "Cancelled";
    importedAt: string;
    processingStartedAt?: string;
    completedAt?: string;
    failedAt?: string;
    outputPath?: string;
    reductionPercent?: number;
    lastError?: string;
};

export type PdfAnalysis = {
    documentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    pageCount: number;
    searchable: boolean;
    characterCount: number;
    imageCount: number;
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

export type OcrProgress = {
    fileName: string;
    currentPage?: number;
    totalPages?: number;
    percent?: number;
    message: string;
};
