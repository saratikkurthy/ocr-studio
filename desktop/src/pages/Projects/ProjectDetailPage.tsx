import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProjectById } from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";

import AnalysisTab from "./project-detail/AnalysisTab";
import DocumentsTab from "./project-detail/DocumentsTab";
import HistoryTab from "./project-detail/HistoryTab";
import OutputsTab from "./project-detail/OutputsTab";
import OverviewTab from "./project-detail/OverviewTab";
import ProjectSummary from "./project-detail/ProjectSummary";
import ProjectToolbar from "./project-detail/ProjectToolbar";
import QueueTab from "./project-detail/QueueTab";
import WorkspaceTabs from "./project-detail/WorkspaceTabs";

import type {
    OcrJob,
    OcrProgress,
    OcrQueueItem,
    PdfAnalysis,
    ProjectDocument,
    ProjectExport,
    WorkspaceTab,
} from "./project-detail/types";

import "./ProjectDetailPage.css";

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | undefined>();
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [exports, setExports] = useState<ProjectExport[]>([]);
    const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
    const [analyses, setAnalyses] = useState<PdfAnalysis[]>([]);
    const [ocrQueue, setOcrQueue] = useState<OcrQueueItem[]>([]);

    const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
    const [selectedCompression, setSelectedCompression] = useState("medium");
    const [outputType, setOutputType] = useState("searchable_pdf");
    const [allowReprocess, setAllowReprocess] = useState(false);

    const [ocrRunning, setOcrRunning] = useState(false);
    const [analysisRunning, setAnalysisRunning] = useState(false);
    const [queueUpdating, setQueueUpdating] = useState(false);

    const [ocrMessage, setOcrMessage] = useState("");
    const [analysisMessage, setAnalysisMessage] = useState("");
    const [queueMessage, setQueueMessage] = useState("");
    const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDuration = (milliseconds: number) => {
        const seconds = Math.round(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes === 0) return `${remainingSeconds}s`;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const loadDocuments = async (projectPath: string) => {
        const result = await window.ocrStudio.listProjectDocuments({
            projectPath,
        });
        setDocuments(result);
    };

    const loadExports = async (projectPath: string) => {
        const result = await window.ocrStudio.listProjectExports({
            projectPath,
        });
        setExports(result);
    };

    const loadOcrJobs = async (projectPath: string) => {
        const result = await window.ocrStudio.listOcrJobs({ projectPath });
        setOcrJobs(result);
    };

    const loadAnalysis = async (projectPath: string) => {
        const result = await window.ocrStudio.listProjectAnalysis({
            projectPath,
        });
        setAnalyses(result);
    };

    const loadOcrQueue = async (projectPath: string) => {
        const result = await window.ocrStudio.listOcrQueue({ projectPath });
        setOcrQueue(result);
    };

    const refreshProjectData = async (projectPath: string) => {
        await Promise.all([
            loadDocuments(projectPath),
            loadExports(projectPath),
            loadOcrJobs(projectPath),
            loadAnalysis(projectPath),
            loadOcrQueue(projectPath),
        ]);
    };

    useEffect(() => {
        if (!window.ocrStudio?.onOcrProgress) return;

        window.ocrStudio.onOcrProgress((data) => {
            setOcrProgress(data);
            setOcrMessage(`${data.fileName}: ${data.message}`);
        });
    }, []);

    useEffect(() => {
        if (!window.ocrStudio?.onOcrDocumentStatus) return;

        window.ocrStudio.onOcrDocumentStatus((update) => {
            setDocuments((current) =>
                current.map((document) =>
                    document.id === update.documentId
                        ? { ...document, status: update.status }
                        : document
                )
            );
        });
    }, []);

    useEffect(() => {
        if (!window.ocrStudio?.onAnalysisProgress) return;

        window.ocrStudio.onAnalysisProgress((progress) => {
            setAnalysisMessage(
                `${progress.fileName} — ${progress.current} of ${progress.total} — ${progress.percent}%`
            );
        });
    }, []);

    useEffect(() => {
        async function loadProject() {
            const data = await getProjectById(Number(id));
            setProject(data);

            if (data?.compression) {
                setSelectedCompression(data.compression);
            }

            if (data?.projectPath && window.ocrStudio) {
                await refreshProjectData(data.projectPath);
            }
        }

        void loadProject();
    }, [id]);

    const cancelOcr = async () => {
        const result = await window.ocrStudio.cancelOcr();
        setOcrMessage(result.message);
        setOcrRunning(false);
    };

    const openInputFolder = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        const result = await window.ocrStudio.openInputFolder(
            project.projectPath
        );

        if (result) alert(result);
    };

    const handleImportFiles = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        await window.ocrStudio.importFilesToProject({
            projectPath: project.projectPath,
        });

        await refreshProjectData(project.projectPath);
        setSelectedDocumentIds([]);
        setActiveTab("documents");
    };

    const toggleDocumentSelection = (documentId: number) => {
        setSelectedDocumentIds((current) =>
            current.includes(documentId)
                ? current.filter((item) => item !== documentId)
                : [...current, documentId]
        );
    };

    const selectAllDocuments = () => {
        const selectableDocuments = documents.filter((document) => {
            if (document.status === "Processing") return false;
            if (document.status === "Converted" && !allowReprocess) return false;
            return true;
        });

        setSelectedDocumentIds(
            selectableDocuments.map((document) => document.id)
        );
    };

    const clearDocumentSelection = () => {
        setSelectedDocumentIds([]);
    };

    const handleAllowReprocessChange = (enabled: boolean) => {
        setAllowReprocess(enabled);

        if (!enabled) {
            const convertedIds = new Set(
                documents
                    .filter((document) => document.status === "Converted")
                    .map((document) => document.id)
            );

            setSelectedDocumentIds((current) =>
                current.filter((documentId) => !convertedIds.has(documentId))
            );
        }
    };

    const analyzeSelectedPdfs = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        if (selectedDocumentIds.length === 0) {
            alert("Please select at least one PDF to analyze.");
            return;
        }

        setAnalysisRunning(true);
        setAnalysisMessage("Starting PDF analysis...");
        setActiveTab("analysis");

        try {
            const result = await window.ocrStudio.analyzeProject({
                projectPath: project.projectPath,
                documentIds: selectedDocumentIds,
            });

            setAnalysisMessage(result.message);
            setAnalyses(result.analyses);

            if (!result.success) alert(result.message);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "PDF analysis failed.";
            setAnalysisMessage(message);
            alert(message);
        } finally {
            setAnalysisRunning(false);
        }
    };

    const addSelectedToQueue = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        if (selectedDocumentIds.length === 0) {
            alert("Please select at least one PDF.");
            return;
        }

        const selectedDocuments = documents.filter((document) =>
            selectedDocumentIds.includes(document.id)
        );

        const invalidDocuments = selectedDocuments.filter(
            (document) =>
                document.status === "Processing" ||
                (document.status === "Converted" && !allowReprocess)
        );

        if (invalidDocuments.length > 0) {
            alert(
                "Some selected documents cannot be queued:\n\n" +
                    invalidDocuments
                        .map(
                            (document) =>
                                `${document.fileName} — ${document.status}`
                        )
                        .join("\n")
            );
            return;
        }

        setQueueUpdating(true);
        setQueueMessage("Adding selected PDFs to the OCR queue...");
        setActiveTab("queue");

        try {
            const result = await window.ocrStudio.addToOcrQueue({
                projectPath: project.projectPath,
                documentIds: selectedDocumentIds,
                language: project.language,
                compression: selectedCompression,
                outputType,
            });

            setOcrQueue(result.queue);
            setQueueMessage(result.message);

            if (result.success) {
                setSelectedDocumentIds([]);
            } else {
                alert(result.message);
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not add PDFs to the OCR queue.";

            setQueueMessage(message);
            alert(message);
        } finally {
            setQueueUpdating(false);
        }
    };

    const removeQueueItem = async (item: OcrQueueItem) => {
        if (!project?.projectPath) return;

        if (item.status === "Processing") {
            alert("A processing item cannot be removed.");
            return;
        }

        if (!confirm(`Remove this PDF from the OCR queue?\n\n${item.fileName}`)) {
            return;
        }

        setQueueUpdating(true);

        try {
            const result = await window.ocrStudio.removeFromOcrQueue({
                projectPath: project.projectPath,
                queueItemId: item.id,
            });

            setOcrQueue(result.queue);
            setQueueMessage(result.message);

            if (!result.success) alert(result.message);
        } finally {
            setQueueUpdating(false);
        }
    };

    const clearFinishedQueueItems = async () => {
        if (!project?.projectPath) return;

        const finishedCount = ocrQueue.filter((item) =>
            ["Completed", "Failed", "Cancelled"].includes(item.status)
        ).length;

        if (finishedCount === 0) {
            alert("There are no finished queue items.");
            return;
        }

        setQueueUpdating(true);

        try {
            const updatedQueue =
                await window.ocrStudio.clearCompletedQueueItems({
                    projectPath: project.projectPath,
                });

            setOcrQueue(updatedQueue);
            setQueueMessage(
                `${finishedCount} finished queue item(s) removed.`
            );
        } finally {
            setQueueUpdating(false);
        }
    };

    const deleteDocument = async (document: ProjectDocument) => {
        if (!project?.projectPath) return;

        if (!confirm(`Delete imported document?\n\n${document.fileName}`)) {
            return;
        }

        const updated = await window.ocrStudio.deleteProjectDocument({
            projectPath: project.projectPath,
            documentId: document.id,
        });

        setDocuments(updated);
        setSelectedDocumentIds((current) =>
            current.filter((item) => item !== document.id)
        );
    };

    const deleteExport = async (file: ProjectExport) => {
        if (!project?.projectPath) return;

        if (!confirm(`Delete generated output?\n\n${file.fileName}`)) {
            return;
        }

        const updated = await window.ocrStudio.deleteProjectExport({
            projectPath: project.projectPath,
            filePath: file.filePath,
        });

        setExports(updated);
    };

    const verifyTextLayer = async (file: ProjectExport) => {
        if (!file.fileName.toLowerCase().endsWith(".pdf")) {
            alert("Text layer verification is only available for PDF files.");
            return;
        }

        const result = await window.ocrStudio.verifyPdfTextLayer({
            filePath: file.filePath,
        });

        alert(
            `${result.message}\n\n` +
                `Characters extracted: ${result.characterCount}\n\n` +
                `Sample:\n${result.sampleText || "No text sample available."}`
        );
    };

    const retryJob = (job: OcrJob) => {
        const matchingDocument = documents.find(
            (document) => document.fileName === job.fileName
        );

        if (!matchingDocument) {
            alert("Original imported PDF was not found. Import it again.");
            return;
        }

        setSelectedDocumentIds([matchingDocument.id]);
        setActiveTab("documents");
        alert(
            `Selected for retry:\n\n${matchingDocument.fileName}\n\nClick Run OCR.`
        );
    };

    const runOcr = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        const selectedDocuments = documents.filter((document) =>
            selectedDocumentIds.includes(document.id)
        );

        if (selectedDocuments.length === 0) {
            alert("Please select at least one PDF to convert.");
            return;
        }

        const processingDocuments = selectedDocuments.filter(
            (document) => document.status === "Processing"
        );

        if (processingDocuments.length > 0) {
            alert(
                "Some selected PDFs are already processing:\n\n" +
                    processingDocuments
                        .map((document) => document.fileName)
                        .join("\n")
            );
            return;
        }

        const convertedDocuments = selectedDocuments.filter(
            (document) => document.status === "Converted"
        );

        if (convertedDocuments.length > 0 && !allowReprocess) {
            alert(
                "Some selected PDFs were already converted:\n\n" +
                    convertedDocuments
                        .map((document) => document.fileName)
                        .join("\n") +
                    "\n\nEnable reprocessing to run them again."
            );
            return;
        }

        setOcrRunning(true);
        setOcrMessage("Checking OCR tools...");
        setOcrProgress(null);

        try {
            const tools = await window.ocrStudio.checkOcrTools();

            if (!tools.tesseract.installed || !tools.ocrmypdf.installed) {
                setOcrMessage("");
                alert("OCR tools are missing.");
                return;
            }

            setOcrMessage(
                "Running OCR. Large Telugu or Sanskrit PDFs may take several minutes."
            );

            const result = await window.ocrStudio.runOcrForProject({
                projectPath: project.projectPath,
                language: project.language,
                compression: selectedCompression,
                outputType,
                documentIds: selectedDocumentIds,
                allowReprocess,
            });

            if (!result.success) {
                setOcrMessage("OCR failed.");
                alert(`OCR failed:\n\n${result.message}`);
                return;
            }

            const processedCount =
                result.results?.filter((item) => item.success).length ?? 1;
            const failedCount =
                result.results?.filter((item) => !item.success).length ?? 0;

            setOcrMessage(
                failedCount === 0
                    ? `OCR completed successfully for ${processedCount} PDF(s).`
                    : `OCR completed for ${processedCount} PDF(s), failed for ${failedCount}.`
            );

            await refreshProjectData(project.projectPath);
            setActiveTab("outputs");

            if (result.outputPath) {
                await window.ocrStudio.openPath(result.outputPath);
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "OCR failed.";
            setOcrMessage(message);
            alert(message);
        } finally {
            setOcrRunning(false);
        }
    };

    const getDocumentBadgeClass = (
        status: ProjectDocument["status"]
    ) => {
        switch (status) {
            case "Converted":
                return "completed";
            case "Failed":
                return "failed";
            case "Processing":
                return "processing";
            case "Cancelled":
                return "cancelled";
            default:
                return "pending";
        }
    };

    const getQueueBadgeClass = (status: OcrQueueItem["status"]) => {
        switch (status) {
            case "Completed":
                return "completed";
            case "Processing":
                return "processing";
            case "Failed":
                return "failed";
            case "Cancelled":
                return "cancelled";
            default:
                return "pending";
        }
    };

    if (!project) {
        return <div className="empty">Loading project...</div>;
    }

    const queueCounts = {
        waiting: ocrQueue.filter((item) => item.status === "Waiting").length,
        processing: ocrQueue.filter((item) => item.status === "Processing")
            .length,
        completed: ocrQueue.filter((item) => item.status === "Completed").length,
        failed: ocrQueue.filter((item) => item.status === "Failed").length,
    };

    const failedCount =
        documents.filter((document) => document.status === "Failed").length +
        queueCounts.failed;

    const openLog = () => {
        if (!project.projectPath) return;
        void window.ocrStudio.openPath(
            `${project.projectPath}\\Logs\\ocr-run.log`
        );
    };

    return (
        <main className="project-workspace">
            <header className="workspace-header">
                <div>
                    <button
                        className="back-button"
                        onClick={() => navigate("/projects")}
                    >
                        ← Back to Projects
                    </button>
                    <h1>{project.name}</h1>
                    <p title={project.projectPath}>{project.projectPath}</p>
                </div>
                <div className="workspace-status">
                    <span className="badge completed">{project.status}</span>
                </div>
            </header>

            <ProjectSummary
                imported={documents.length}
                selected={selectedDocumentIds.length}
                waiting={queueCounts.waiting}
                processing={queueCounts.processing}
                outputs={exports.length}
                failed={failedCount}
            />

            <ProjectToolbar
                outputType={outputType}
                compression={selectedCompression}
                selectedCount={selectedDocumentIds.length}
                allowReprocess={allowReprocess}
                ocrRunning={ocrRunning}
                analysisRunning={analysisRunning}
                queueUpdating={queueUpdating}
                hasDocuments={documents.length > 0}
                onOutputTypeChange={setOutputType}
                onCompressionChange={setSelectedCompression}
                onAllowReprocessChange={handleAllowReprocessChange}
                onOpenInputFolder={openInputFolder}
                onImport={handleImportFiles}
                onAnalyze={analyzeSelectedPdfs}
                onAddToQueue={addSelectedToQueue}
                onRunOcr={runOcr}
                onCancelOcr={cancelOcr}
            />

            {(ocrRunning || ocrMessage) && (
                <section className="workspace-progress">
                    {ocrRunning && <div className="spinner" />}
                    <div>
                        <strong>
                            {ocrProgress
                                ? `${ocrProgress.fileName} — ${ocrProgress.message}`
                                : ocrMessage}
                        </strong>
                        {ocrProgress?.totalPages && (
                            <p>
                                Page {ocrProgress.currentPage ?? 0} of{" "}
                                {ocrProgress.totalPages}
                            </p>
                        )}
                    </div>
                    {ocrProgress?.percent !== undefined && (
                        <div className="determinate-progress">
                            <span
                                style={{
                                    width: `${Math.max(
                                        0,
                                        Math.min(100, ocrProgress.percent)
                                    )}%`,
                                }}
                            />
                        </div>
                    )}
                </section>
            )}

            <WorkspaceTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                counts={{
                    documents: documents.length,
                    analysis: analyses.length,
                    queue: ocrQueue.length,
                    outputs: exports.length,
                    history: ocrJobs.length,
                }}
            />

            <section className="workspace-content">
                {activeTab === "overview" && (
                    <OverviewTab
                        project={project}
                        documents={documents}
                        analyses={analyses}
                        queue={ocrQueue}
                        exports={exports}
                        jobs={ocrJobs}
                        compression={selectedCompression}
                        onNavigate={setActiveTab}
                    />
                )}

                {activeTab === "documents" && (
                    <DocumentsTab
                        documents={documents}
                        selectedDocumentIds={selectedDocumentIds}
                        allowReprocess={allowReprocess}
                        ocrRunning={ocrRunning}
                        onToggle={toggleDocumentSelection}
                        onSelectAll={selectAllDocuments}
                        onClear={clearDocumentSelection}
                        onOpen={(path) =>
                            void window.ocrStudio.openPath(path)
                        }
                        onDelete={deleteDocument}
                        getBadgeClass={getDocumentBadgeClass}
                    />
                )}

                {activeTab === "analysis" && (
                    <AnalysisTab
                        analyses={analyses}
                        analysisMessage={analysisMessage}
                    />
                )}

                {activeTab === "queue" && (
                    <QueueTab
                        queue={ocrQueue}
                        queueMessage={queueMessage}
                        queueUpdating={queueUpdating}
                        counts={queueCounts}
                        onClearFinished={clearFinishedQueueItems}
                        onRemove={removeQueueItem}
                        onOpen={(path) =>
                            void window.ocrStudio.openPath(path)
                        }
                        getBadgeClass={getQueueBadgeClass}
                    />
                )}

                {activeTab === "outputs" && (
                    <OutputsTab
                        exports={exports}
                        formatSize={formatSize}
                        onOpen={(path) =>
                            void window.ocrStudio.openPath(path)
                        }
                        onDelete={deleteExport}
                        onVerify={verifyTextLayer}
                    />
                )}

                {activeTab === "history" && (
                    <HistoryTab
                        jobs={ocrJobs}
                        formatDuration={formatDuration}
                        onOpen={(path) =>
                            void window.ocrStudio.openPath(path)
                        }
                        onOpenLog={openLog}
                        onRetry={retryJob}
                    />
                )}
            </section>
        </main>
    );
}
