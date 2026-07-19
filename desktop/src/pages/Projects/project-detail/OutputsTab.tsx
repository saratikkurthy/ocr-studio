import type { ProjectExport } from "./types";

type OutputsTabProps = {
    exports: ProjectExport[];
    formatSize: (bytes: number) => string;
    onOpen: (path: string) => void;
    onDelete: (file: ProjectExport) => void;
    onVerify: (file: ProjectExport) => void;
};

export default function OutputsTab({
    exports,
    formatSize,
    onOpen,
    onDelete,
    onVerify,
}: OutputsTabProps) {
    return (
        <section className="workspace-panel">
            <div className="workspace-panel-header">
                <div>
                    <h2>Generated Outputs</h2>
                    <p>Searchable PDFs and optional OCR text sidecars.</p>
                </div>
            </div>

            {exports.length === 0 ? (
                <div className="empty">No generated outputs yet.</div>
            ) : (
                <div className="data-table-wrap">
                    <table className="workspace-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>File</th>
                                <th>Size</th>
                                <th>Created</th>
                                <th>Modified</th>
                                <th className="actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exports.map((file) => {
                                const isPdf = file.fileName
                                    .toLowerCase()
                                    .endsWith(".pdf");

                                return (
                                    <tr key={file.filePath}>
                                        <td>
                                            <span className="badge completed">
                                                {isPdf ? "PDF" : "TXT"}
                                            </span>
                                        </td>
                                        <td className="file-cell">
                                            <strong>{file.fileName}</strong>
                                            <small>{file.filePath}</small>
                                        </td>
                                        <td>{formatSize(file.size)}</td>
                                        <td>
                                            {new Date(
                                                file.createdAt
                                            ).toLocaleString()}
                                        </td>
                                        <td>
                                            {new Date(
                                                file.modifiedAt
                                            ).toLocaleString()}
                                        </td>
                                        <td className="actions-column">
                                            <div className="row-actions">
                                                <button
                                                    className="small-button"
                                                    onClick={() =>
                                                        onOpen(file.filePath)
                                                    }
                                                >
                                                    Open
                                                </button>
                                                {isPdf && (
                                                    <button
                                                        className="small-button"
                                                        onClick={() =>
                                                            onVerify(file)
                                                        }
                                                    >
                                                        Verify OCR
                                                    </button>
                                                )}
                                                <button
                                                    className="small-button danger"
                                                    onClick={() =>
                                                        onDelete(file)
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
