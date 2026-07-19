import type { Project } from "../../../services/projectStorage";
import { getLanguageLabel } from "../../../services/languageService";
import type {
    OcrJob,
    OcrQueueItem,
    PdfAnalysis,
    ProjectDocument,
    ProjectExport,
} from "./types";

type OverviewTabProps = {
    project: Project;
    documents: ProjectDocument[];
    analyses: PdfAnalysis[];
    queue: OcrQueueItem[];
    exports: ProjectExport[];
    jobs: OcrJob[];
    compression: string;
    onNavigate: (
        tab: "documents" | "analysis" | "queue" | "outputs" | "history"
    ) => void;
};

export default function OverviewTab({
    project,
    documents,
    analyses,
    queue,
    exports,
    jobs,
    compression,
    onNavigate,
}: OverviewTabProps) {
    const failedDocuments = documents.filter(
        (document) => document.status === "Failed"
    ).length;
    const waitingQueue = queue.filter((item) => item.status === "Waiting").length;
    const processingQueue = queue.filter(
        (item) => item.status === "Processing"
    ).length;

    return (
        <div className="overview-layout">
            <section className="workspace-panel">
                <div className="workspace-panel-header">
                    <div>
                        <h2>Project Information</h2>
                        <p>Configuration and storage details.</p>
                    </div>
                </div>
                <div className="project-info-grid">
                    <div><span>Status</span><strong>{project.status}</strong></div>
                    <div><span>Language</span><strong>{getLanguageLabel(project.language)}</strong></div>
                    <div><span>Compression</span><strong>{compression}</strong></div>
                    <div><span>Workflow</span><strong>{project.workflow}</strong></div>
                    <div className="wide"><span>Workspace</span><strong>{project.workspacePath}</strong></div>
                    <div><span>Created</span><strong>{new Date(project.createdAt).toLocaleString()}</strong></div>
                </div>
            </section>

            <section className="overview-action-grid">
                <button className="overview-action-card" onClick={() => onNavigate("documents")}>
                    <span>Documents</span>
                    <strong>{documents.length}</strong>
                    <small>{failedDocuments} failed</small>
                </button>
                <button className="overview-action-card" onClick={() => onNavigate("analysis")}>
                    <span>PDF Analysis</span>
                    <strong>{analyses.length}</strong>
                    <small>Analyzed files</small>
                </button>
                <button className="overview-action-card" onClick={() => onNavigate("queue")}>
                    <span>OCR Queue</span>
                    <strong>{queue.length}</strong>
                    <small>{waitingQueue} waiting, {processingQueue} processing</small>
                </button>
                <button className="overview-action-card" onClick={() => onNavigate("outputs")}>
                    <span>Generated Outputs</span>
                    <strong>{exports.length}</strong>
                    <small>PDF and TXT files</small>
                </button>
                <button className="overview-action-card" onClick={() => onNavigate("history")}>
                    <span>OCR History</span>
                    <strong>{jobs.length}</strong>
                    <small>Recorded OCR runs</small>
                </button>
            </section>
        </div>
    );
}
