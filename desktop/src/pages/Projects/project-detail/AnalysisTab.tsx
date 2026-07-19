import type { PdfAnalysis } from "./types";

type AnalysisTabProps = {
    analyses: PdfAnalysis[];
    analysisMessage: string;
};

function recommendationClass(
    recommendation: PdfAnalysis["recommendation"]
) {
    switch (recommendation) {
        case "RUN_OCR":
            return "recommend-run";
        case "SKIP_OCR":
            return "recommend-skip";
        default:
            return "recommend-review";
    }
}

export default function AnalysisTab({
    analyses,
    analysisMessage,
}: AnalysisTabProps) {
    return (
        <section className="workspace-panel">
            <div className="workspace-panel-header">
                <div>
                    <h2>PDF Analysis</h2>
                    <p>
                        Inspect page structure, text availability, image count,
                        quality, and OCR recommendations.
                    </p>
                </div>
            </div>

            {analysisMessage && (
                <div className="inline-message">{analysisMessage}</div>
            )}

            {analyses.length === 0 ? (
                <div className="empty">
                    Select documents and click Analyze Selected.
                </div>
            ) : (
                <div className="data-table-wrap">
                    <table className="workspace-table">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Pages</th>
                                <th>Searchable</th>
                                <th>Characters</th>
                                <th>Images</th>
                                <th>Document Type</th>
                                <th>Quality</th>
                                <th>Recommendation</th>
                                <th>Analyzed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyses.map((analysis) => (
                                <tr key={analysis.documentId}>
                                    <td className="file-cell">
                                        <strong>{analysis.fileName}</strong>
                                        {analysis.error && (
                                            <small className="text-danger">
                                                {analysis.error}
                                            </small>
                                        )}
                                    </td>
                                    <td>{analysis.pageCount ?? "—"}</td>
                                    <td>
                                        <span
                                            className={`badge ${
                                                analysis.searchable
                                                    ? "completed"
                                                    : "pending"
                                            }`}
                                        >
                                            {analysis.searchable ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td>
                                        {analysis.characterCount?.toLocaleString() ??
                                            "—"}
                                    </td>
                                    <td>{analysis.imageCount ?? "—"}</td>
                                    <td>
                                        {analysis.estimatedDocumentType || "—"}
                                    </td>
                                    <td>
                                        {analysis.analysisStatus === "Completed"
                                            ? `${analysis.qualityLabel} (${analysis.qualityScore}%)`
                                            : "Failed"}
                                    </td>
                                    <td className="recommendation-cell">
                                        <span
                                            className={`recommendation-badge ${recommendationClass(
                                                analysis.recommendation
                                            )}`}
                                        >
                                            {analysis.recommendationLabel}
                                        </span>
                                        <small>
                                            {analysis.recommendationReason}
                                        </small>
                                    </td>
                                    <td>
                                        {new Date(
                                            analysis.analyzedAt
                                        ).toLocaleString()}
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
