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

            openPath: (filePath: string) => Promise<string>;
            runOcrForProject: (data: {
                projectPath: string;
                language: string;
                compression?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                outputPath?: string;
                inputSize?: number;
                ocrSize?: number;
                outputSize?: number;
                reductionPercent?: number;

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
        };
    }
}