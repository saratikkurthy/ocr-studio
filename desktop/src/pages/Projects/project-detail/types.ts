export type WorkspaceTab =
    | "overview"
    | "documents"
    | "analysis"
    | "queue"
    | "review"
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
    searchablePath?: string;
    compressedPath?: string;
    sidecarTxtPath?: string;
    inputSize?: number;
    outputSize?: number;
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


export type PageConfidenceRecord = {
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


export type OcrIndexedWord = {
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

export type OcrWordIndexPage = {
    version: number;
    documentId: number;
    pageNumber: number;
    sourceFile: string;
    language: string;
    imageWidth: number;
    imageHeight: number;
    indexedAt: string;
    summary: {
        totalWords: number;
        lowConfidenceWords: number;
        veryLowConfidenceWords: number;
        averageConfidence: number;
    };
    words: OcrIndexedWord[];
};

export type OcrWordIndexDocument = {
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

export type OcrWordIndexManifest = {
    version: number;
    documents: OcrWordIndexDocument[];
    updatedAt: string | null;
};


export type WordIndexBackgroundJob = {
    id: string;
    type: "WordIndex";
    documentId: number;
    fileName: string;
    mode: "quick" | "full";
    language: string;
    status:
        | "Queued"
        | "Running"
        | "Completed"
        | "Failed"
        | "Cancelled";
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
