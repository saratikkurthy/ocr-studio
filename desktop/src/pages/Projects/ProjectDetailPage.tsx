import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProjectById } from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";
import { getLanguageLabel } from "../../services/languageService";

type ProjectDocument = {
    id: number;
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    status: string;
    importedAt: string;
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


export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | undefined>();
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [exports, setExports] = useState<ProjectExport[]>([]);
    const [ocrRunning, setOcrRunning] = useState(false);
    const [ocrMessage, setOcrMessage] = useState("");
    const [selectedCompression, setSelectedCompression] = useState("medium");
    const [outputType, setOutputType] = useState("searchable_pdf");
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
    const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
    const [ocrProgress, setOcrProgress] = useState<{
        fileName: string;
        currentPage?: number;
        totalPages?: number;
        percent?: number;
        message: string;
    } | null>(null);
    const cancelOcr = async () => {
        const result = await window.ocrStudio.cancelOcr();
        setOcrMessage(result.message);
        setOcrRunning(false);
    };
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const loadOcrJobs = async (projectPath: string) => {
        const jobs = await window.ocrStudio.listOcrJobs({ projectPath });
        setOcrJobs(jobs);
    };

    const loadExports = async (projectPath: string) => {
        const exported = await window.ocrStudio.listProjectExports({ projectPath });
        setExports(exported);
    };

    const loadDocuments = async (projectPath: string) => {
        const docs = await window.ocrStudio.listProjectDocuments({ projectPath });
        setDocuments(docs);
    };
    const retryJob = async (job: OcrJob) => {
        const matchingDoc = documents.find((doc) => doc.fileName === job.fileName);

        if (!matchingDoc) {
            alert("Original imported PDF was not found. Please import it again.");
            return;
        }

        setSelectedDocumentIds([matchingDoc.id]);
        alert(`Selected for retry:\n\n${matchingDoc.fileName}\n\nClick Run OCR.`);
    };
    const verifyTextLayer = async (file: ProjectExport) => {
        if (!file.fileName.toLowerCase().endsWith(".pdf")) {
            alert("Text layer verification is only for PDF files.");
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
    useEffect(() => {
        if (!window.ocrStudio?.onOcrProgress) return;

        window.ocrStudio.onOcrProgress((data) => {
            setOcrProgress(data);
            setOcrMessage(`${data.fileName}: ${data.message}`);
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
                await loadDocuments(data.projectPath);
                await loadExports(data.projectPath);
                await loadOcrJobs(data.projectPath);
            }
        }

        loadProject();
    }, [id]);

    const handleImportFiles = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        const imported = await window.ocrStudio.importFilesToProject({
            projectPath: project.projectPath,
        });

        setDocuments(imported);
        await loadExports(project.projectPath);
        await loadOcrJobs(project.projectPath);
    };

    const formatDuration = (ms: number) => {
        const seconds = Math.round(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes === 0) return `${remainingSeconds}s`;
        return `${minutes}m ${remainingSeconds}s`;
    };
    const openInputFolder = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        const result = await window.ocrStudio.openInputFolder(project.projectPath);

        if (result) {
            alert(result);
        }
    };

    const toggleDocumentSelection = (documentId: number) => {
        setSelectedDocumentIds((prev) =>
            prev.includes(documentId)
                ? prev.filter((item) => item !== documentId)
                : [...prev, documentId]
        );
    };

    const selectAllDocuments = () => {
        setSelectedDocumentIds(documents.map((doc) => doc.id));
    };

    const clearDocumentSelection = () => {
        setSelectedDocumentIds([]);
    };

    const deleteDocument = async (doc: ProjectDocument) => {
        if (!project?.projectPath) return;
        if (!confirm(`Delete imported document?\n\n${doc.fileName}`)) return;

        const updated = await window.ocrStudio.deleteProjectDocument({
            projectPath: project.projectPath,
            documentId: doc.id,
        });

        setDocuments(updated);
        setSelectedDocumentIds((prev) => prev.filter((item) => item !== doc.id));
    };

    const deleteExport = async (file: ProjectExport) => {
        if (!project?.projectPath) return;
        if (!confirm(`Delete generated output?\n\n${file.fileName}`)) return;

        const updated = await window.ocrStudio.deleteProjectExport({
            projectPath: project.projectPath,
            filePath: file.filePath,
        });

        setExports(updated);
    };

    const runOcr = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        if (selectedDocumentIds.length === 0) {
            alert("Please select at least one PDF to convert.");
            return;
        }

        if (exports.length > 0) {
            const confirmRun = confirm(
                "Generated outputs already exist for this project.\n\nDo you still want to run OCR again?"
            );

            if (!confirmRun) return;
        }

        setOcrRunning(true);
        setOcrMessage("Checking OCR tools...");

        const tools = await window.ocrStudio.checkOcrTools();

        if (!tools.tesseract.installed || !tools.ocrmypdf.installed) {
            setOcrRunning(false);
            setOcrMessage("");
            alert("OCR tools are missing.");
            return;
        }

        setOcrMessage("Running OCR. This may take several minutes for large Telugu/Sanskrit PDFs...");

        const result = await window.ocrStudio.runOcrForProject({
            projectPath: project.projectPath,
            language: project.language,
            compression: selectedCompression,
            outputType,
            documentIds: selectedDocumentIds,
        });

        setOcrRunning(false);

        if (!result.success) {
            setOcrMessage("OCR failed.");
            alert("OCR failed:\n\n" + result.message);
            return;
        }

        const processedCount = result.results?.filter((item) => item.success).length ?? 1;
        const failedCount = result.results?.filter((item) => !item.success).length ?? 0;

        setOcrMessage(
            failedCount === 0
                ? `OCR completed successfully for ${processedCount} PDF(s).`
                : `OCR completed for ${processedCount} PDF(s), failed for ${failedCount}.`
        );

        await loadExports(project.projectPath);

        if (result.outputPath) {
            await window.ocrStudio.openPath(result.outputPath);
        }
    };

    if (!project) {
        return <div className="empty">Loading project...</div>;
    }

    return (
        <>
            <div className="project-title">
                <div>
                    <button className="small-button" onClick={() => navigate("/projects")}>
                        ← Back
                    </button>
                    <h1>{project.name}</h1>
                    <p>{project.projectPath}</p>
                </div>

                <div className="project-actions">
                    <button className="secondary" onClick={openInputFolder}>
                        Open Input Folder
                    </button>

                    <button className="secondary" onClick={handleImportFiles}>
                        Import Files
                    </button>

                    <div className="ocr-action-group">
                        <div className="compression-control">
                            <label htmlFor="outputType">Output Type</label>
                            <select
                                id="outputType"
                                value={outputType}
                                onChange={(event) => setOutputType(event.target.value)}
                                disabled={ocrRunning}
                            >
                                <option value="searchable_pdf">Searchable PDF</option>
                                <option value="searchable_pdf_txt">Searchable PDF + OCR Text TXT</option>
                            </select>
                        </div>

                        <div className="compression-control">
                            <label htmlFor="compression">PDF Compression</label>
                            <select
                                id="compression"
                                value={selectedCompression}
                                onChange={(event) => setSelectedCompression(event.target.value)}
                                disabled={ocrRunning}
                            >
                                <option value="low">Low — Best Quality</option>
                                <option value="medium">Medium — Balanced</option>
                                <option value="high">High — Smaller PDF</option>
                                <option value="maximum">Maximum — Smallest PDF</option>
                            </select>
                        </div>

                        <small className="selection-hint">
                            {selectedDocumentIds.length} PDF(s) selected
                        </small>

                        <button
                            className="primary run-ocr-button"
                            onClick={runOcr}
                            disabled={ocrRunning || documents.length === 0}
                        >
                            {ocrRunning ? "Running OCR..." : "Run OCR"}
                        </button>
                    </div>
                </div>
            </div>

            {ocrRunning && (
                <div className="panel ocr-progress-panel">
                    <div className="panel-header">
                        <h2>OCR Running</h2>
                    </div>
                    <div style={{ padding: "0 22px 22px" }}>
                        <button className="small-button danger" onClick={cancelOcr}>
                            Cancel OCR
                        </button>
                    </div>
                    <div className="ocr-progress-body">
                        <div className="spinner"></div>
                        <div>
                            <strong>
                                {ocrProgress
                                    ? `${ocrProgress.fileName} — ${ocrProgress.message}`
                                    : ocrMessage}
                            </strong>
                            <p>Please keep OCR Studio open until processing completes.</p>
                        </div>
                    </div>

                    <div className="progress-track">
                        <div className="progress-indeterminate"></div>
                    </div>
                </div>
            )}

            {!ocrRunning && ocrMessage && (
                <div className="panel ocr-progress-panel">
                    <div className="ocr-progress-body">
                        <strong>{ocrMessage}</strong>
                    </div>
                </div>
            )}

            <section className="stats project-stats">
                <div className="stat">
                    <h3>Imported Files</h3>
                    <strong>{documents.length}</strong>
                    <p>Ready for OCR</p>
                </div>

                <div className="stat">
                    <h3>Selected</h3>
                    <strong>{selectedDocumentIds.length}</strong>
                    <p>Will be processed</p>
                </div>

                <div className="stat">
                    <h3>PDF Outputs</h3>
                    <strong>{exports.filter((file) => file.fileName.toLowerCase().endsWith(".pdf")).length}</strong>
                    <p>Generated PDFs</p>
                </div>

                <div className="stat">
                    <h3>TXT Outputs</h3>
                    <strong>{exports.filter((file) => file.fileName.toLowerCase().endsWith(".txt")).length}</strong>
                    <p>OCR text files</p>
                </div>
            </section>

            <section className="project-grid">
                <div className="panel">
                    <div className="panel-header">
                        <h2>Project Info</h2>
                    </div>

                    <div className="info-list">
                        <p><strong>Status:</strong> {project.status}</p>
                        <p><strong>Language:</strong> {getLanguageLabel(project.language)}</p>
                        <p><strong>Compression:</strong> {selectedCompression}</p>
                        <p><strong>Workflow:</strong> {project.workflow}</p>
                        <p><strong>Workspace:</strong> {project.workspacePath}</p>
                        <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2>Documents</h2>
                        {documents.length > 0 && (
                            <div>
                                <button className="small-button" onClick={selectAllDocuments}>
                                    Select All
                                </button>
                                <button className="small-button" onClick={clearDocumentSelection}>
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>

                    {documents.length === 0 ? (
                        <div className="empty">No documents imported yet.</div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Select</th>
                                    <th>File Name</th>
                                    <th>Status</th>
                                    <th>Imported</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedDocumentIds.includes(doc.id)}
                                                onChange={() => toggleDocumentSelection(doc.id)}
                                            />
                                        </td>
                                        <td>{doc.fileName}</td>
                                        <td>
                                            <span className="badge pending">{doc.status}</span>
                                        </td>
                                        <td>{new Date(doc.importedAt).toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="small-button"
                                                onClick={() => window.ocrStudio.openPath(doc.destinationPath)}
                                            >
                                                Open
                                            </button>
                                            <button
                                                className="small-button danger"
                                                onClick={() => deleteDocument(doc)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2>Generated Outputs</h2>
                    </div>

                    {exports.length === 0 ? (
                        <div className="empty">No generated outputs yet.</div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>File</th>
                                    <th>Size</th>
                                    <th>Modified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {exports.map((file) => (
                                    <tr key={file.filePath}>
                                        <td>
                                            <span className="badge completed">
                                                {file.fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "TXT"}
                                            </span>
                                        </td>
                                        <td>{file.fileName}</td>
                                        <td>{formatSize(file.size)}</td>
                                        <td>{new Date(file.modifiedAt).toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="small-button"
                                                onClick={() => window.ocrStudio.openPath(file.filePath)}
                                            >
                                                Open
                                            </button>
                                            <button
                                                className="small-button danger"
                                                onClick={() => deleteExport(file)}
                                            >
                                                Delete
                                            </button>
                                            {file.fileName.toLowerCase().endsWith(".pdf") && (
                                                <button
                                                    className="small-button"
                                                    onClick={() => verifyTextLayer(file)}
                                                >
                                                    Verify OCR
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <div className="panel">
                        <div className="panel-header">
                            <h2>OCR Job History</h2>
                        </div>

                        {ocrJobs.length === 0 ? (
                            <div className="empty">No OCR jobs yet.</div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>File</th>
                                        <th>Status</th>
                                        <th>Started</th>
                                        <th>Duration</th>
                                        <th>Reduction</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {ocrJobs.map((job) => (
                                        <tr key={job.id}>
                                            <td>{job.fileName}</td>
                                            <td>
                                                <span className={`badge ${job.status === "Completed" ? "completed" : "pending"}`}>
                                                    {job.status}
                                                </span>
                                            </td>
                                            <td>{new Date(job.startedAt).toLocaleString()}</td>
                                            <td>{formatDuration(job.durationMs)}</td>
                                            <td>
                                                {job.reductionPercent !== undefined
                                                    ? `${job.reductionPercent.toFixed(1)}%`
                                                    : "—"}
                                            </td>
                                            <td>
                                                {job.outputPath && (
                                                    <button
                                                        className="small-button"
                                                        onClick={() => window.ocrStudio.openPath(job.outputPath!)}
                                                    >
                                                        Open Output
                                                    </button>
                                                )}
                                                {job.sidecarTxtPath && (
                                                    <button
                                                        className="small-button"
                                                        onClick={() => window.ocrStudio.openPath(job.sidecarTxtPath!)}
                                                    >
                                                        Open TXT
                                                    </button>
                                                )}
                                                <button
                                                    className="small-button"
                                                    onClick={() => {
                                                        if (!project?.projectPath) return;
                                                        window.ocrStudio.openPath(`${project.projectPath}\\Logs\\ocr-run.log`);
                                                    }}
                                                >
                                                    Open Log
                                                </button>
                                                {job.status !== "Completed" && (
                                                    <button
                                                        className="small-button"
                                                        onClick={() => retryJob(job)}
                                                    >
                                                        Retry
                                                    </button>
                                                )}
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}