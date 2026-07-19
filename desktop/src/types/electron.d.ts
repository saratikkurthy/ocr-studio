export { };

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

declare global {
    interface Window {
        ocrStudio: {
            selectWorkspaceFolder: () => Promise<string | null>;

            createProject: (data: {
                name: string;
                description: string;
                language: string;
                workflow: string;
                workspacePath: string;
                compression?: string;
            }) => Promise<ProjectInfo>;

            listRecentProjects: () => Promise<ProjectInfo[]>;

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