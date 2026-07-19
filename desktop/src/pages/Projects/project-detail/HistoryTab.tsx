import type { OcrJob } from "./types";

type HistoryTabProps = {
    jobs: OcrJob[];
    formatDuration: (milliseconds: number) => string;
    onOpen: (path: string) => void;
    onOpenLog: () => void;
    onRetry: (job: OcrJob) => void;
};

function historyBadgeClass(status: string) {
    if (status === "Completed") return "completed";
    if (status === "Failed") return "failed";
    if (status === "Cancelled") return "cancelled";
    if (status === "Processing") return "processing";
    return "pending";
}

export default function HistoryTab({
    jobs,
    formatDuration,
    onOpen,
    onOpenLog,
    onRetry,
}: HistoryTabProps) {
    return (
        <section className="workspace-panel">
            <div className="workspace-panel-header">
                <div>
                    <h2>OCR Job History</h2>
                    <p>Completed, failed, and cancelled OCR runs.</p>
                </div>
                <button className="small-button" onClick={onOpenLog}>
                    Open OCR Log
                </button>
            </div>

            {jobs.length === 0 ? (
                <div className="empty">No OCR jobs yet.</div>
            ) : (
                <div className="data-table-wrap">
                    <table className="workspace-table">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Status</th>
                                <th>Started</th>
                                <th>Ended</th>
                                <th>Duration</th>
                                <th>Input Size</th>
                                <th>Output Size</th>
                                <th>Reduction</th>
                                <th>Message</th>
                                <th className="actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr key={job.id}>
                                    <td className="file-cell">
                                        <strong>{job.fileName}</strong>
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${historyBadgeClass(
                                                job.status
                                            )}`}
                                        >
                                            {job.status}
                                        </span>
                                    </td>
                                    <td>
                                        {new Date(
                                            job.startedAt
                                        ).toLocaleString()}
                                    </td>
                                    <td>
                                        {job.endedAt
                                            ? new Date(
                                                  job.endedAt
                                              ).toLocaleString()
                                            : "—"}
                                    </td>
                                    <td>
                                        {formatDuration(job.durationMs)}
                                    </td>
                                    <td>
                                        {job.inputSize !== undefined
                                            ? `${(
                                                  job.inputSize /
                                                  (1024 * 1024)
                                              ).toFixed(1)} MB`
                                            : "—"}
                                    </td>
                                    <td>
                                        {job.outputSize !== undefined
                                            ? `${(
                                                  job.outputSize /
                                                  (1024 * 1024)
                                              ).toFixed(1)} MB`
                                            : "—"}
                                    </td>
                                    <td>
                                        {job.reductionPercent !== undefined
                                            ? `${job.reductionPercent.toFixed(
                                                  1
                                              )}%`
                                            : "—"}
                                    </td>
                                    <td className="message-cell">
                                        {job.message || "—"}
                                    </td>
                                    <td className="actions-column">
                                        <div className="row-actions">
                                            {job.outputPath && (
                                                <button
                                                    className="small-button"
                                                    onClick={() =>
                                                        onOpen(job.outputPath!)
                                                    }
                                                >
                                                    Open Output
                                                </button>
                                            )}
                                            {job.sidecarTxtPath && (
                                                <button
                                                    className="small-button"
                                                    onClick={() =>
                                                        onOpen(
                                                            job.sidecarTxtPath!
                                                        )
                                                    }
                                                >
                                                    Open TXT
                                                </button>
                                            )}
                                            {job.status !== "Completed" && (
                                                <button
                                                    className="small-button"
                                                    onClick={() => onRetry(job)}
                                                >
                                                    Retry
                                                </button>
                                            )}
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
