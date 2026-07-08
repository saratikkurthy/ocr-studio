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

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | undefined>();
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [exports, setExports] = useState<ProjectExport[]>([]);
    const [ocrRunning, setOcrRunning] = useState(false);
    const [ocrMessage, setOcrMessage] = useState("");
    const [selectedCompression, setSelectedCompression] = useState("medium");

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const loadExports = async (projectPath: string) => {
        const exported = await window.ocrStudio.listProjectExports({ projectPath });
        setExports(exported);
    };

    const loadDocuments = async (projectPath: string) => {
        const docs = await window.ocrStudio.listProjectDocuments({ projectPath });
        setDocuments(docs);
    };

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

    const runOcr = async () => {
        if (!project?.projectPath) {
            alert("Project path is missing.");
            return;
        }

        if (exports.length > 0) {
            const confirmRun = confirm(
                "Converted PDF already exists for this project.\n\nDo you still want to run OCR again?"
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
        });

        setOcrRunning(false);

        if (!result.success) {
            setOcrMessage("OCR failed.");
            alert("OCR failed:\n\n" + result.message);
            return;
        }

        const formatBytes = (bytes?: number) => {
            if (!bytes) return "N/A";
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        const reductionText =
            result.reductionPercent !== undefined
                ? ` Original: ${formatBytes(result.inputSize)} | OCR: ${formatBytes(result.ocrSize)} | Final: ${formatBytes(result.outputSize)} | Reduction: ${result.reductionPercent.toFixed(1)}%`
                : "";

        setOcrMessage(`OCR completed successfully.${reductionText}`);
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
                <select
                    className="compression-select"
                    value={selectedCompression}
                    onChange={(e) => setSelectedCompression(e.target.value)}
                    disabled={ocrRunning}
                >
                    <option value="low">Low Compression</option>
                    <option value="medium">Medium Compression</option>
                    <option value="high">High Compression</option>
                    <option value="maximum">Maximum Compression</option>
                </select>
                <div>
                    <div className="project-actions">
                        <button className="secondary" onClick={openInputFolder}>
                            Open Input Folder
                        </button>

                        <button className="secondary" onClick={handleImportFiles}>
                            Import Files
                        </button>

                        <div className="ocr-action-group">
                            <div className="compression-control">
                                <label htmlFor="compression">PDF Compression</label>

                                <select
                                    id="compression"
                                    value={selectedCompression}
                                    onChange={(e) => setSelectedCompression(e.target.value)}
                                    disabled={ocrRunning}
                                >
                                    <option value="low">Low — Best Quality</option>
                                    <option value="medium">Medium — Balanced</option>
                                    <option value="high">High — Smaller PDF</option>
                                    <option value="maximum">Maximum — Smallest PDF</option>
                                </select>
                            </div>

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
            </div>

            {ocrRunning && (
                <div className="panel ocr-progress-panel">
                    <div className="panel-header">
                        <h2>OCR Running</h2>
                    </div>

                    <div className="ocr-progress-body">
                        <div className="spinner"></div>
                        <div>
                            <strong>{ocrMessage}</strong>
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

            <section className="project-grid">
                <div className="panel">
                    <div className="panel-header">
                        <h2>Project Info</h2>
                    </div>

                    <div className="info-list">
                        <p><strong>Status:</strong> {project.status}</p>
                        <p><strong>Language:</strong> {getLanguageLabel(project.language)}</p>
                        <p><strong>Compression:</strong> {project.compression || "medium"}</p>
                        <p><strong>Workflow:</strong> {project.workflow}</p>
                        <p><strong>Workspace:</strong> {project.workspacePath}</p>
                        <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleString()}</p>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <h2>Documents</h2>
                    </div>

                    {documents.length === 0 ? (
                        <div className="empty">No documents imported yet.</div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>Status</th>
                                    <th>Imported</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>{doc.fileName}</td>
                                        <td><span className="badge pending">{doc.status}</span></td>
                                        <td>{new Date(doc.importedAt).toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="small-button"
                                                onClick={() => window.ocrStudio.openPath(doc.destinationPath)}
                                            >
                                                Open
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
                        <h2>Converted PDFs</h2>
                    </div>

                    {exports.length === 0 ? (
                        <div className="empty">No converted PDFs yet.</div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Size</th>
                                    <th>Modified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {exports.map((file) => (
                                    <tr key={file.filePath}>
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
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </>
    );
}