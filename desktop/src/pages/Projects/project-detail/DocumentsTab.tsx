import type { ProjectDocument } from "./types";

type DocumentsTabProps = {
    documents: ProjectDocument[];
    selectedDocumentIds: number[];
    allowReprocess: boolean;
    ocrRunning: boolean;
    onToggle: (documentId: number) => void;
    onSelectAll: () => void;
    onClear: () => void;
    onOpen: (path: string) => void;
    onDelete: (document: ProjectDocument) => void;
    getBadgeClass: (status: ProjectDocument["status"]) => string;
};

export default function DocumentsTab({
    documents,
    selectedDocumentIds,
    allowReprocess,
    ocrRunning,
    onToggle,
    onSelectAll,
    onClear,
    onOpen,
    onDelete,
    getBadgeClass,
}: DocumentsTabProps) {
    return (
        <section className="workspace-panel">
            <div className="workspace-panel-header">
                <div>
                    <h2>Documents</h2>
                    <p>Select the PDFs to analyze, queue, or process.</p>
                </div>
                {documents.length > 0 && (
                    <div className="panel-actions">
                        <button className="small-button" onClick={onSelectAll}>
                            Select All
                        </button>
                        <button className="small-button" onClick={onClear}>
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {documents.length === 0 ? (
                <div className="empty">No documents imported yet.</div>
            ) : (
                <div className="data-table-wrap">
                    <table className="workspace-table">
                        <thead>
                            <tr>
                                <th className="check-column">Select</th>
                                <th>File Name</th>
                                <th>Status</th>
                                <th>Imported</th>
                                <th>Reduction</th>
                                <th>Last Error</th>
                                <th className="actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((document) => {
                                const disabled =
                                    ocrRunning ||
                                    document.status === "Processing" ||
                                    (document.status === "Converted" &&
                                        !allowReprocess);

                                return (
                                    <tr key={document.id}>
                                        <td className="check-column">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocumentIds.includes(
                                                    document.id
                                                )}
                                                disabled={disabled}
                                                onChange={() =>
                                                    onToggle(document.id)
                                                }
                                                title={
                                                    document.status ===
                                                    "Processing"
                                                        ? "This PDF is currently processing"
                                                        : document.status ===
                                                                "Converted" &&
                                                            !allowReprocess
                                                          ? "Enable reprocessing to select this PDF"
                                                          : "Select this PDF"
                                                }
                                            />
                                        </td>
                                        <td className="file-cell">
                                            <strong>{document.fileName}</strong>
                                            <small>{document.destinationPath}</small>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${getBadgeClass(
                                                    document.status
                                                )}`}
                                            >
                                                {document.status}
                                            </span>
                                        </td>
                                        <td>
                                            {new Date(
                                                document.importedAt
                                            ).toLocaleString()}
                                        </td>
                                        <td>
                                            {document.reductionPercent !==
                                            undefined
                                                ? `${document.reductionPercent.toFixed(
                                                      1
                                                  )}%`
                                                : "—"}
                                        </td>
                                        <td className="error-cell">
                                            {document.lastError || "—"}
                                        </td>
                                        <td className="actions-column">
                                            <div className="row-actions">
                                                <button
                                                    className="small-button"
                                                    onClick={() =>
                                                        onOpen(
                                                            document.destinationPath
                                                        )
                                                    }
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    className="small-button danger"
                                                    onClick={() =>
                                                        onDelete(document)
                                                    }
                                                    disabled={
                                                        document.status ===
                                                        "Processing"
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
