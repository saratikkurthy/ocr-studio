export { };

type ImportedDocument = {
    id: number;
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    status: string;
    importedAt: string;
    compression: string;
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
            }) => Promise<ProjectInfo>;

            listRecentProjects: () => Promise<ProjectInfo[]>;
            openInputFolder: (projectPath: string) => Promise<string>;
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
            }) => Promise<
                {
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
                }[]
            >;
            openPath: (filePath: string) => Promise<string>;
            runOcrForProject: (data: {
                projectPath: string;
                language: string;
                compression?: string;
                outputType?: string;
                documentIds?: number[];
            }) => Promise<{
                success: boolean;
                message: string;
                outputPath?: string;
                inputSize?: number;
                ocrSize?: number;
                outputSize?: number;
                reductionPercent?: number;
                results?: {
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
                }[];
            }>;
            listProjectExports: (data: {
                projectPath: string;
            }) => Promise<
                {
                    fileName: string;
                    filePath: string;
                    size: number;
                    createdAt: string;
                    modifiedAt: string;
                }[]
            >;
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
            }) => Promise<
                {
                    fileName: string;
                    filePath: string;
                    size: number;
                    createdAt: string;
                    modifiedAt: string;
                }[]
            >;
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
        };
    }
}