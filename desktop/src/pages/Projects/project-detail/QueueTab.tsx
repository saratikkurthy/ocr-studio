import { getLanguageLabel } from "../../../services/languageService";
import type { OcrQueueItem } from "./types";

type QueueTabProps = {
    queue: OcrQueueItem[];
    queueMessage: string;
    queueUpdating: boolean;
    counts: {
        waiting: number;
        processing: number;
        completed: number;
        failed: number;
    };
    workerStatus: "Running" | "Idle" | "Stopping" | "Stopped";
    workerMessage: string;
    onStartWorker: () => void;
    onStopWorker: () => void;
    onClearFinished: () => void;
    onRemove: (item: OcrQueueItem) => void;
    onOpen: (path: string) => void;
    getBadgeClass: (status: OcrQueueItem["status"]) => string;
};

export default function QueueTab({
    queue,
    queueMessage,
    queueUpdating,
    counts,
    workerStatus,
    workerMessage,
    onStartWorker,
    onStopWorker,
    onClearFinished,
    onRemove,
    onOpen,
    getBadgeClass,
}: QueueTabProps) {
    return (
        <section className="workspace-panel">
            <div className="workspace-panel-header">
                <div>
                    <h2>OCR Queue</h2>
                    <p>Batch OCR items and their current processing state.</p>
                </div>
                <div className="panel-actions">
                    {workerStatus === "Running" || workerStatus === "Stopping" ? (
                        <button
                            className="small-button danger"
                            onClick={onStopWorker}
                            disabled={workerStatus === "Stopping"}
                        >
                            {workerStatus === "Stopping"
                                ? "Stopping..."
                                : "Stop Queue"}
                        </button>
                    ) : (
                        <button
                            className="primary"
                            onClick={onStartWorker}
                            disabled={queueUpdating || counts.waiting === 0}
                        >
                            Start Queue
                        </button>
                    )}

                    {queue.length > 0 && (
                        <button
                            className="small-button"
                            onClick={onClearFinished}
                            disabled={
                                queueUpdating ||
                                workerStatus === "Running" ||
                                workerStatus === "Stopping"
                            }
                        >
                            Clear Finished
                        </button>
                    )}
                </div>
            </div>

            <div className={`inline-message queue-worker-message ${workerStatus.toLowerCase()}`}>
                <strong>Worker: {workerStatus}</strong>
                <span>{workerMessage || "The queue worker is ready."}</span>
            </div>

            <div className="queue-summary">
                <div><span>Waiting</span><strong>{counts.waiting}</strong></div>
                <div><span>Processing</span><strong>{counts.processing}</strong></div>
                <div><span>Completed</span><strong>{counts.completed}</strong></div>
                <div><span>Failed</span><strong>{counts.failed}</strong></div>
            </div>

            {queueMessage && (
                <div className="inline-message">{queueMessage}</div>
            )}

            {queue.length === 0 ? (
                <div className="empty">
                    Select documents and click Add to Queue.
                </div>
            ) : (
                <div className="data-table-wrap">
                    <table className="workspace-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>File</th>
                                <th>Status</th>
                                <th>Language</th>
                                <th>Compression</th>
                                <th>Output</th>
                                <th>Added</th>
                                <th>Started</th>
                                <th className="actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...queue]
                                .sort((a, b) => a.position - b.position)
                                .map((item) => (
                                    <tr key={item.id}>
                                        <td><strong>#{item.position}</strong></td>
                                        <td className="file-cell">
                                            <strong>{item.fileName}</strong>
                                            {item.error && (
                                                <small className="text-danger">
                                                    {item.error}
                                                </small>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${getBadgeClass(
                                                    item.status
                                                )}`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{getLanguageLabel(item.language)}</td>
                                        <td className="capitalize">
                                            {item.compression || "medium"}
                                        </td>
                                        <td>
                                            {item.outputType ===
                                            "searchable_pdf_txt"
                                                ? "PDF + TXT"
                                                : "Searchable PDF"}
                                        </td>
                                        <td>
                                            {new Date(
                                                item.addedAt
                                            ).toLocaleString()}
                                        </td>
                                        <td>
                                            {item.startedAt
                                                ? new Date(
                                                      item.startedAt
                                                  ).toLocaleString()
                                                : "—"}
                                        </td>
                                        <td className="actions-column">
                                            <div className="row-actions">
                                                {item.outputPath && (
                                                    <button
                                                        className="small-button"
                                                        onClick={() =>
                                                            onOpen(
                                                                item.outputPath!
                                                            )
                                                        }
                                                    >
                                                        Open Output
                                                    </button>
                                                )}
                                                <button
                                                    className="small-button danger"
                                                    onClick={() => onRemove(item)}
                                                    disabled={
                                                        queueUpdating ||
                                                        item.status ===
                                                            "Processing"
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
