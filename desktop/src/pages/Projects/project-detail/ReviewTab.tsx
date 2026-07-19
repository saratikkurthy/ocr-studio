import { useEffect, useMemo, useRef, useState } from "react";
import type { OcrWordIndexManifest, PageConfidenceRecord, PdfAnalysis, ProjectDocument, WordIndexBackgroundJob } from "./types";

type ReviewTabProps = {
    documents: ProjectDocument[];
    analyses: PdfAnalysis[];
    pageConfidence: PageConfidenceRecord[];
    wordIndexManifest: OcrWordIndexManifest;
    wordIndexJobs: WordIndexBackgroundJob[];
    wordIndexRunning: boolean;
    wordIndexMessage: string;
    onBuildWordIndex: (
        documentId: number,
        mode: "quick" | "full"
    ) => void;
    onCancelWordIndex: () => void;
    onCancelWordIndexJob: (jobId: string) => void;
    onRetryWordIndexJob: (jobId: string) => void;
    onRemoveWordIndexJob: (jobId: string) => void;
    onClearWordIndex: (documentId: number) => void;
    confidenceRunning: boolean;
    confidenceMessage: string;
    onAnalyzeConfidence: (
        documentId: number,
        mode: "quick" | "full"
    ) => void;
    onCancelConfidence: () => void;
    onClearConfidence: (documentId: number) => void;
    onOpen: (filePath: string) => void;
};

type ReviewIssue = {
    id: string;
    severity: "High" | "Medium" | "Low";
    title: string;
    description: string;
    pageNumber?: number;
};

type PreviewPaneProps = {
    title: string;
    subtitle: string;
    filePath: string | null;
    pageNumber: number;
    scalePercent: number;
    syncEnabled: boolean;
    onPageChange: (pageNumber: number) => void;
    onScaleChange: (scalePercent: number) => void;
    onPageCountChange: (pageCount: number) => void;
};

function getOutputPath(document: ProjectDocument) {
    return (
        document.outputPath ||
        document.compressedPath ||
        document.searchablePath ||
        null
    );
}

function buildReviewIssues(
    document: ProjectDocument | undefined,
    analysis: PdfAnalysis | undefined
): ReviewIssue[] {
    if (!document) return [];

    const issues: ReviewIssue[] = [];

    if (!analysis) {
        issues.push({
            id: "analysis-missing",
            severity: "Medium",
            title: "Analysis not available",
            description:
                "Run PDF Analysis to populate quality indicators and document recommendations.",
        });
        return issues;
    }

    if (analysis.qualityScore < 50) {
        issues.push({
            id: "quality-low",
            severity: "High",
            title: "Low source quality",
            description:
                "The source PDF quality score is below 50%. Review the OCR result carefully.",
        });
    } else if (analysis.qualityScore < 75) {
        issues.push({
            id: "quality-medium",
            severity: "Medium",
            title: "Moderate source quality",
            description:
                "The scan may contain blur, noise, skew, or other defects that reduce OCR accuracy.",
        });
    }

    if (analysis.recommendation === "RUN_OCR") {
        issues.push({
            id: "ocr-recommended",
            severity: "Low",
            title: analysis.recommendationLabel || "OCR recommended",
            description:
                analysis.recommendationReason ||
                "The analysis indicates that OCR should be applied.",
        });
    }

    if (analysis.recommendation === "REVIEW") {
        issues.push({
            id: "manual-review",
            severity: "Medium",
            title: analysis.recommendationLabel || "Manual review recommended",
            description:
                analysis.recommendationReason ||
                "The document should be reviewed before final approval.",
        });
    }

    if (!analysis.searchable) {
        issues.push({
            id: "source-not-searchable",
            severity: "Low",
            title: "Original PDF has no text layer",
            description:
                "This is expected for scanned documents, but it increases reliance on OCR quality.",
        });
    }

    if (!analysis.containsImages) {
        issues.push({
            id: "images-not-detected",
            severity: "Low",
            title: "No page images detected",
            description:
                "The source may already contain text, or the PDF structure may require additional inspection.",
        });
    }

    if (analysis.pageCount >= 500) {
        issues.push({
            id: "large-document",
            severity: "Low",
            title: "Large document",
            description:
                `This PDF contains ${analysis.pageCount} pages. Use synchronized navigation to review representative sections.`,
        });
    }

    if (
        document.reductionPercent !== undefined &&
        document.reductionPercent < -10
    ) {
        issues.push({
            id: "output-growth",
            severity: "Medium",
            title: "OCR output is larger than the source",
            description:
                "The converted PDF increased substantially in size. Consider using a stronger compression profile.",
        });
    }

    if (issues.length === 0) {
        issues.push({
            id: "no-major-issues",
            severity: "Low",
            title: "No major issues detected",
            description:
                "The available analysis does not indicate any major source-quality concerns.",
        });
    }

    return issues;
}

function PreviewPane({
    title,
    subtitle,
    filePath,
    pageNumber,
    scalePercent,
    syncEnabled,
    onPageChange,
    onScaleChange,
    onPageCountChange,
}: PreviewPaneProps) {
    const requestIdRef = useRef(0);

    const [pageCount, setPageCount] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [rendering, setRendering] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;

        setPageCount(0);
        setImageUrl(null);
        setMessage("");

        if (!filePath) {
            setMessage("PDF file is unavailable.");
            return;
        }

        async function loadInfo() {
            setLoadingInfo(true);

            try {
                const result = await window.ocrStudio.getPdfInfo({ filePath });

                if (cancelled) return;

                if (!result.success || result.pageCount <= 0) {
                    setPageCount(0);
                    return;
                }

                setPageCount(result.pageCount);
                onPageCountChange(result.pageCount);
            } catch {
                if (!cancelled) {
                    setPageCount(0);
                }
            } finally {
                if (!cancelled) {
                    setLoadingInfo(false);
                }
            }
        }

        void loadInfo();

        return () => {
            cancelled = true;
        };
    }, [filePath, onPageCountChange]);

    useEffect(() => {
        if (!filePath) return;

        const requestId = ++requestIdRef.current;
        const timer = window.setTimeout(async () => {
            setRendering(true);
            setMessage("");

            try {
                const result = await window.ocrStudio.renderPdfPage({
                    filePath,
                    pageNumber,
                    scalePercent,
                });

                if (requestId !== requestIdRef.current) return;

                if (!result.success || !result.dataUrl) {
                    throw new Error(
                        result.message || "Could not render PDF page."
                    );
                }

                setImageUrl(result.dataUrl);
            } catch (error) {
                if (requestId === requestIdRef.current) {
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : "Could not render PDF page."
                    );
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setRendering(false);
                }
            }
        }, 180);

        return () => {
            window.clearTimeout(timer);
        };
    }, [filePath, pageNumber, scalePercent]);

    const busy = rendering;

    const clampPage = (requestedPage: number) => {
        if (!Number.isFinite(requestedPage)) return pageNumber;

        if (pageCount > 0) {
            return Math.min(Math.max(1, requestedPage), pageCount);
        }

        return Math.max(1, requestedPage);
    };

    const updatePage = (requestedPage: number) => {
        onPageChange(clampPage(requestedPage));
    };

    const updateScale = (requestedScale: number) => {
        onScaleChange(Math.min(200, Math.max(50, requestedScale)));
    };

    return (
        <article className="pdf-review-pane">
            <header>
                <div className="pdf-pane-title">
                    <strong>{title}</strong>
                    <span>{subtitle}</span>
                </div>

                <div className="pdf-viewer-controls">
                    <button
                        type="button"
                        className="icon-button"
                        disabled={busy || pageNumber <= 1}
                        onClick={() => updatePage(pageNumber - 1)}
                        title={
                            syncEnabled
                                ? "Previous page in both viewers"
                                : "Previous page"
                        }
                    >
                        ‹
                    </button>

                    <label className="pdf-page-control">
                        <span>Page</span>
                        <input
                            type="number"
                            min={1}
                            max={pageCount > 0 ? pageCount : undefined}
                            value={pageNumber}
                            disabled={busy}
                            onChange={(event) =>
                                updatePage(Number(event.target.value))
                            }
                        />
                        <span>
                            of {pageCount || (loadingInfo ? "…" : "?")}
                        </span>
                    </label>

                    <button
                        type="button"
                        className="icon-button"
                        disabled={
                            busy ||
                            (pageCount > 0 && pageNumber >= pageCount)
                        }
                        onClick={() => updatePage(pageNumber + 1)}
                        title={
                            syncEnabled
                                ? "Next page in both viewers"
                                : "Next page"
                        }
                    >
                        ›
                    </button>

                    <button
                        type="button"
                        className="icon-button"
                        disabled={busy || scalePercent <= 50}
                        onClick={() => updateScale(scalePercent - 25)}
                        title={
                            syncEnabled
                                ? "Zoom out both viewers"
                                : "Zoom out"
                        }
                    >
                        −
                    </button>

                    <span className="pdf-zoom-label">{scalePercent}%</span>

                    <button
                        type="button"
                        className="icon-button"
                        disabled={busy || scalePercent >= 200}
                        onClick={() => updateScale(scalePercent + 25)}
                        title={
                            syncEnabled
                                ? "Zoom in both viewers"
                                : "Zoom in"
                        }
                    >
                        +
                    </button>
                </div>
            </header>

            <div className="pdf-frame-shell poppler-preview-shell">
                {imageUrl && (
                    <div className="pdf-image-scroll">
                        <img
                            src={imageUrl}
                            alt={`${title}, page ${pageNumber}`}
                            className="pdf-page-image"
                            draggable={false}
                        />
                    </div>
                )}

                {busy && (
                    <div className="pdf-loading">
                        <div className="spinner" />
                        {`Rendering page ${pageNumber}...`}
                    </div>
                )}

                {!busy && message && (
                    <div className="pdf-empty">{message}</div>
                )}
            </div>
        </article>
    );
}

export default function ReviewTab({
    documents,
    analyses,
    pageConfidence,
    wordIndexManifest,
    wordIndexJobs,
    wordIndexRunning,
    wordIndexMessage,
    onBuildWordIndex,
    onCancelWordIndex,
    onCancelWordIndexJob,
    onRetryWordIndexJob,
    onRemoveWordIndexJob,
    onClearWordIndex,
    confidenceRunning,
    confidenceMessage,
    onAnalyzeConfidence,
    onCancelConfidence,
    onClearConfidence,
    onOpen,
}: ReviewTabProps) {
    const reviewableDocuments = useMemo(
        () =>
            documents.filter(
                (document) =>
                    document.status === "Converted" &&
                    Boolean(getOutputPath(document))
            ),
        [documents]
    );

    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
        reviewableDocuments[0]?.id ?? null
    );

    const [syncEnabled, setSyncEnabled] = useState(true);

    const [sharedPage, setSharedPage] = useState(1);
    const [sharedScale, setSharedScale] = useState(100);

    const [originalPage, setOriginalPage] = useState(1);
    const [outputPage, setOutputPage] = useState(1);

    const [originalScale, setOriginalScale] = useState(100);
    const [outputScale, setOutputScale] = useState(100);

    const [originalPageCount, setOriginalPageCount] = useState(0);
    const [outputPageCount, setOutputPageCount] = useState(0);

    const [issuesExpanded, setIssuesExpanded] = useState(true);
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    useEffect(() => {
        if (
            selectedDocumentId !== null &&
            reviewableDocuments.some(
                (document) => document.id === selectedDocumentId
            )
        ) {
            return;
        }

        setSelectedDocumentId(reviewableDocuments[0]?.id ?? null);
    }, [reviewableDocuments, selectedDocumentId]);

    useEffect(() => {
        setSharedPage(1);
        setOriginalPage(1);
        setOutputPage(1);

        setSharedScale(100);
        setOriginalScale(100);
        setOutputScale(100);

        setOriginalPageCount(0);
        setOutputPageCount(0);
        setSelectedIssueId(null);
    }, [selectedDocumentId]);

    const selectedDocument = reviewableDocuments.find(
        (document) => document.id === selectedDocumentId
    );

    const selectedAnalysis = analyses.find(
        (analysis) => analysis.documentId === selectedDocumentId
    );

    const selectedWordIndex = useMemo(
        () =>
            wordIndexManifest.documents.find(
                (item) =>
                    item.documentId === selectedDocumentId
            ),
        [wordIndexManifest, selectedDocumentId]
    );

    const selectedWordIndexJobs = useMemo(
        () =>
            wordIndexJobs
                .filter(
                    (job) =>
                        job.documentId === selectedDocumentId
                )
                .sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                ),
        [wordIndexJobs, selectedDocumentId]
    );

    const selectedConfidence = useMemo(
        () =>
            pageConfidence
                .filter(
                    (record) =>
                        record.documentId === selectedDocumentId
                )
                .sort((a, b) => a.pageNumber - b.pageNumber),
        [pageConfidence, selectedDocumentId]
    );

    const averagePageConfidence = useMemo(() => {
        const completed = selectedConfidence.filter(
            (record) => record.status === "Completed"
        );

        if (completed.length === 0) return null;

        return (
            completed.reduce(
                (sum, record) => sum + record.confidence,
                0
            ) / completed.length
        );
    }, [selectedConfidence]);

    const lowConfidencePages = useMemo(
        () =>
            selectedConfidence.filter(
                (record) =>
                    record.status === "Completed" &&
                    record.confidence < 60
            ),
        [selectedConfidence]
    );

    const reviewIssues = useMemo(
        () => buildReviewIssues(selectedDocument, selectedAnalysis),
        [selectedDocument, selectedAnalysis]
    );

    const severityCounts = useMemo(
        () => ({
            high: reviewIssues.filter((issue) => issue.severity === "High").length,
            medium: reviewIssues.filter(
                (issue) => issue.severity === "Medium"
            ).length,
            low: reviewIssues.filter((issue) => issue.severity === "Low").length,
        }),
        [reviewIssues]
    );

    const effectiveSharedPageCount =
        originalPageCount > 0 && outputPageCount > 0
            ? Math.min(originalPageCount, outputPageCount)
            : originalPageCount || outputPageCount;

    const changeSharedPage = (requestedPage: number) => {
        const nextPage =
            effectiveSharedPageCount > 0
                ? Math.min(
                      Math.max(1, requestedPage),
                      effectiveSharedPageCount
                  )
                : Math.max(1, requestedPage);

        setSharedPage(nextPage);
    };

    const changeSharedScale = (requestedScale: number) => {
        setSharedScale(Math.min(200, Math.max(50, requestedScale)));
    };

    const toggleSync = () => {
        setSyncEnabled((current) => {
            const next = !current;

            if (next) {
                const nextPage = Math.min(originalPage, outputPage);
                const nextScale = originalScale;

                setSharedPage(Math.max(1, nextPage));
                setSharedScale(nextScale);
            } else {
                setOriginalPage(sharedPage);
                setOutputPage(sharedPage);
                setOriginalScale(sharedScale);
                setOutputScale(sharedScale);
            }

            return next;
        });
    };

    if (reviewableDocuments.length === 0) {
        return (
            <section className="workspace-panel empty-panel">
                <h2>OCR Review</h2>
                <p>
                    No converted PDF is available yet. Run OCR for a document,
                    then return to this tab for side-by-side review.
                </p>
            </section>
        );
    }

    const outputPath = selectedDocument
        ? getOutputPath(selectedDocument)
        : null;

    return (
        <section className="review-workspace">
            <header className="review-toolbar">
                <div className="review-document-picker">
                    <label htmlFor="review-document">Document</label>
                    <select
                        id="review-document"
                        value={selectedDocumentId ?? ""}
                        onChange={(event) =>
                            setSelectedDocumentId(Number(event.target.value))
                        }
                    >
                        {reviewableDocuments.map((document) => (
                            <option key={document.id} value={document.id}>
                                {document.fileName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="review-toolbar-actions">
                    <button
                        type="button"
                        className={
                            syncEnabled
                                ? "small-button sync-active"
                                : "small-button"
                        }
                        onClick={toggleSync}
                    >
                        {syncEnabled
                            ? "🔗 Synchronized"
                            : "⛓ Independent"}
                    </button>

                    {selectedDocument && (
                        <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                                onOpen(selectedDocument.destinationPath)
                            }
                        >
                            Open Original
                        </button>
                    )}

                    {outputPath && (
                        <button
                            type="button"
                            className="primary"
                            onClick={() => onOpen(outputPath)}
                        >
                            Open OCR PDF
                        </button>
                    )}
                </div>
            </header>

            {selectedDocument && (
                <div className="review-metrics">
                    <span>
                        <strong>Status</strong>
                        {selectedDocument.status}
                    </span>
                    <span>
                        <strong>Pages</strong>
                        {selectedAnalysis?.pageCount ?? "—"}
                    </span>
                    <span>
                        <strong>Quality</strong>
                        {selectedAnalysis?.qualityLabel ?? "Not analyzed"}
                    </span>
                    <span>
                        <strong>Quality score</strong>
                        {selectedAnalysis
                            ? `${selectedAnalysis.qualityScore}%`
                            : "—"}
                    </span>
                    <span>
                        <strong>Compression</strong>
                        {selectedDocument.reductionPercent !== undefined
                            ? `${selectedDocument.reductionPercent.toFixed(1)}%`
                            : "—"}
                    </span>
                </div>
            )}

            <section className="word-index-panel">
                <div className="word-index-header">
                    <div>
                        <span className="eyebrow">
                            OCR word database
                        </span>
                        <strong>
                            {selectedWordIndex
                                ? `${selectedWordIndex.totalWords.toLocaleString()} indexed words`
                                : "Not built"}
                        </strong>
                        <small>
                            {selectedWordIndex
                                ? `${selectedWordIndex.indexedPageCount} of ${selectedWordIndex.pageCount} pages indexed`
                                : "Creates scalable per-page word files with text, confidence, line metadata, and bounding boxes."}
                        </small>
                    </div>

                    <div className="word-index-actions">
                        {wordIndexRunning ? (
                            <button
                                type="button"
                                className="small-button danger"
                                onClick={onCancelWordIndex}
                            >
                                Cancel Build
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="small-button"
                                    disabled={!selectedDocument}
                                    onClick={() =>
                                        selectedDocument &&
                                        onBuildWordIndex(
                                            selectedDocument.id,
                                            "quick"
                                        )
                                    }
                                >
                                    Quick Index
                                </button>
                                <button
                                    type="button"
                                    className="primary"
                                    disabled={!selectedDocument}
                                    onClick={() =>
                                        selectedDocument &&
                                        onBuildWordIndex(
                                            selectedDocument.id,
                                            "full"
                                        )
                                    }
                                >
                                    Full Index
                                </button>
                            </>
                        )}

                        {selectedDocument &&
                            selectedWordIndex &&
                            !wordIndexRunning && (
                                <button
                                    type="button"
                                    className="small-button"
                                    onClick={() =>
                                        onClearWordIndex(
                                            selectedDocument.id
                                        )
                                    }
                                >
                                    Clear Index
                                </button>
                            )}
                    </div>
                </div>

                {wordIndexMessage && (
                    <div className="inline-message">
                        {wordIndexMessage}
                    </div>
                )}

                {selectedWordIndex && (
                    <div className="word-index-stats">
                        <div>
                            <span>Total words</span>
                            <strong>
                                {selectedWordIndex.totalWords.toLocaleString()}
                            </strong>
                        </div>
                        <div>
                            <span>Average confidence</span>
                            <strong>
                                {selectedWordIndex.averageConfidence.toFixed(
                                    1
                                )}
                                %
                            </strong>
                        </div>
                        <div>
                            <span>Needs review</span>
                            <strong>
                                {selectedWordIndex.lowConfidenceWords.toLocaleString()}
                            </strong>
                        </div>
                        <div>
                            <span>Very low confidence</span>
                            <strong>
                                {selectedWordIndex.veryLowConfidenceWords.toLocaleString()}
                            </strong>
                        </div>
                        <div>
                            <span>Failed pages</span>
                            <strong>
                                {selectedWordIndex.failedPageCount}
                            </strong>
                        </div>
                        <div>
                            <span>Index mode</span>
                            <strong>
                                {selectedWordIndex.mode === "full"
                                    ? "Full"
                                    : "Quick"}
                            </strong>
                        </div>
                    </div>
                )}

                {selectedWordIndex?.failedPages &&
                    selectedWordIndex.failedPages.length > 0 && (
                        <div className="word-index-failures">
                            <strong>Pages not indexed</strong>
                            <div>
                                {selectedWordIndex.failedPages
                                    .slice(0, 20)
                                    .map((failure) => (
                                        <button
                                            type="button"
                                            key={failure.pageNumber}
                                            title={failure.error}
                                            onClick={() => {
                                                if (syncEnabled) {
                                                    changeSharedPage(
                                                        failure.pageNumber
                                                    );
                                                } else {
                                                    setOriginalPage(
                                                        failure.pageNumber
                                                    );
                                                    setOutputPage(
                                                        failure.pageNumber
                                                    );
                                                }
                                            }}
                                        >
                                            Page {failure.pageNumber}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}
            </section>

            <section className="background-job-center">
                <div className="background-job-center-header">
                    <div>
                        <span className="eyebrow">
                            Background jobs
                        </span>
                        <strong>
                            {selectedWordIndexJobs.length === 0
                                ? "No word-index jobs"
                                : `${selectedWordIndexJobs.length} job(s)`}
                        </strong>
                        <small>
                            Indexing now continues while you browse and review PDFs.
                        </small>
                    </div>
                </div>

                {selectedWordIndexJobs.length > 0 && (
                    <div className="background-job-list">
                        {selectedWordIndexJobs.map((job) => {
                            const progress = Math.max(
                                0,
                                Math.min(100, job.progress || 0)
                            );

                            return (
                                <article
                                    key={job.id}
                                    className={`background-job-card ${job.status.toLowerCase()}`}
                                >
                                    <div className="background-job-title">
                                        <div>
                                            <strong>
                                                {job.mode === "full"
                                                    ? "Full Word Index"
                                                    : "Quick Word Index"}
                                            </strong>
                                            <span>{job.status}</span>
                                        </div>
                                        <small>
                                            Attempt {job.attempt}
                                        </small>
                                    </div>

                                    <div className="background-job-progress">
                                        <div>
                                            <span
                                                style={{
                                                    width: `${progress}%`,
                                                }}
                                            />
                                        </div>
                                        <strong>{progress}%</strong>
                                    </div>

                                    <p>{job.message}</p>

                                    {job.totalPages > 0 && (
                                        <small>
                                            Page {job.currentPage} of{" "}
                                            {job.totalPages}
                                        </small>
                                    )}

                                    {job.error && (
                                        <div className="job-error">
                                            {job.error}
                                        </div>
                                    )}

                                    <div className="background-job-actions">
                                        {(job.status === "Queued" ||
                                            job.status === "Running") && (
                                            <button
                                                type="button"
                                                className="small-button danger"
                                                onClick={() =>
                                                    onCancelWordIndexJob(
                                                        job.id
                                                    )
                                                }
                                            >
                                                Cancel
                                            </button>
                                        )}

                                        {(job.status === "Failed" ||
                                            job.status === "Cancelled") && (
                                            <button
                                                type="button"
                                                className="small-button"
                                                onClick={() =>
                                                    onRetryWordIndexJob(
                                                        job.id
                                                    )
                                                }
                                            >
                                                Retry
                                            </button>
                                        )}

                                        {job.status !== "Running" &&
                                            job.status !== "Queued" && (
                                                <button
                                                    type="button"
                                                    className="small-button"
                                                    onClick={() =>
                                                        onRemoveWordIndexJob(
                                                            job.id
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="confidence-panel">
                <div className="confidence-panel-header">
                    <div>
                        <span className="eyebrow">
                            OCR confidence
                        </span>
                        <strong>
                            {averagePageConfidence === null
                                ? "Not analyzed"
                                : `${averagePageConfidence.toFixed(1)}% average`}
                        </strong>
                        <small>
                            {selectedConfidence.length > 0
                                ? `${selectedConfidence.length} page result(s), ${lowConfidencePages.length} low-confidence`
                                : "Run a quick scan on representative pages or a full scan on every page."}
                        </small>
                    </div>

                    <div className="confidence-actions">
                        {confidenceRunning ? (
                            <button
                                type="button"
                                className="small-button danger"
                                onClick={onCancelConfidence}
                            >
                                Cancel Scan
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="small-button"
                                    disabled={!selectedDocument}
                                    onClick={() =>
                                        selectedDocument &&
                                        onAnalyzeConfidence(
                                            selectedDocument.id,
                                            "quick"
                                        )
                                    }
                                >
                                    Quick Scan
                                </button>
                                <button
                                    type="button"
                                    className="primary"
                                    disabled={!selectedDocument}
                                    onClick={() =>
                                        selectedDocument &&
                                        onAnalyzeConfidence(
                                            selectedDocument.id,
                                            "full"
                                        )
                                    }
                                >
                                    Full Scan
                                </button>
                            </>
                        )}

                        {selectedDocument &&
                            selectedConfidence.length > 0 &&
                            !confidenceRunning && (
                                <button
                                    type="button"
                                    className="small-button"
                                    onClick={() =>
                                        onClearConfidence(
                                            selectedDocument.id
                                        )
                                    }
                                >
                                    Clear Results
                                </button>
                            )}
                    </div>
                </div>

                {confidenceMessage && (
                    <div className="inline-message">
                        {confidenceMessage}
                    </div>
                )}

                {selectedConfidence.length > 0 && (
                    <div className="confidence-heatmap">
                        {selectedConfidence.map((record) => (
                            <button
                                type="button"
                                key={`${record.documentId}-${record.pageNumber}`}
                                className={`confidence-page ${
                                    record.status === "Failed"
                                        ? "failed"
                                        : record.confidence >= 85
                                          ? "excellent"
                                          : record.confidence >= 75
                                            ? "good"
                                            : record.confidence >= 60
                                              ? "review"
                                              : "poor"
                                }`}
                                title={
                                    record.status === "Failed"
                                        ? `Page ${record.pageNumber}: ${record.error || "Analysis failed"}`
                                        : `Page ${record.pageNumber}: ${record.confidence}% confidence; ${record.lowConfidenceWordCount} low-confidence words`
                                }
                                onClick={() => {
                                    if (syncEnabled) {
                                        changeSharedPage(
                                            record.pageNumber
                                        );
                                    } else {
                                        setOriginalPage(
                                            record.pageNumber
                                        );
                                        setOutputPage(
                                            record.pageNumber
                                        );
                                    }
                                }}
                            >
                                <strong>{record.pageNumber}</strong>
                                <span>
                                    {record.status === "Failed"
                                        ? "!"
                                        : `${Math.round(
                                              record.confidence
                                          )}%`}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {lowConfidencePages.length > 0 && (
                    <div className="low-confidence-list">
                        <strong>Pages needing review</strong>
                        <div>
                            {lowConfidencePages
                                .slice(0, 30)
                                .map((record) => (
                                    <button
                                        type="button"
                                        key={`low-${record.pageNumber}`}
                                        onClick={() => {
                                            if (syncEnabled) {
                                                changeSharedPage(
                                                    record.pageNumber
                                                );
                                            } else {
                                                setOriginalPage(
                                                    record.pageNumber
                                                );
                                                setOutputPage(
                                                    record.pageNumber
                                                );
                                            }
                                        }}
                                    >
                                        Page {record.pageNumber}
                                        <span>
                                            {record.confidence.toFixed(
                                                1
                                            )}
                                            %
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="review-quality-section">
                <div className="review-quality-card">
                    <div className="review-quality-heading">
                        <div>
                            <span className="eyebrow">Document quality</span>
                            <strong>
                                {selectedAnalysis?.qualityLabel ??
                                    "Not analyzed"}
                            </strong>
                        </div>

                        <div className="quality-score-ring">
                            <span>
                                {selectedAnalysis
                                    ? selectedAnalysis.qualityScore
                                    : "—"}
                            </span>
                            <small>/100</small>
                        </div>
                    </div>

                    <div className="quality-meter">
                        <span
                            style={{
                                width: selectedAnalysis
                                    ? `${Math.min(
                                          100,
                                          Math.max(
                                              0,
                                              selectedAnalysis.qualityScore
                                          )
                                      )}%`
                                    : "0%",
                            }}
                        />
                    </div>

                    <p>
                        {selectedAnalysis?.recommendationReason ||
                            "Run PDF Analysis to generate a quality recommendation."}
                    </p>
                </div>

                <div className="review-issues-card">
                    <button
                        type="button"
                        className="issues-header-button"
                        onClick={() =>
                            setIssuesExpanded((current) => !current)
                        }
                    >
                        <div>
                            <span className="eyebrow">Review issues</span>
                            <strong>
                                {reviewIssues.length} finding
                                {reviewIssues.length === 1 ? "" : "s"}
                            </strong>
                        </div>

                        <div className="issue-counts">
                            {severityCounts.high > 0 && (
                                <span className="issue-count high">
                                    {severityCounts.high} high
                                </span>
                            )}
                            {severityCounts.medium > 0 && (
                                <span className="issue-count medium">
                                    {severityCounts.medium} medium
                                </span>
                            )}
                            {severityCounts.low > 0 && (
                                <span className="issue-count low">
                                    {severityCounts.low} low
                                </span>
                            )}
                            <span className="issues-chevron">
                                {issuesExpanded ? "⌃" : "⌄"}
                            </span>
                        </div>
                    </button>

                    {issuesExpanded && (
                        <div className="review-issues-list">
                            {reviewIssues.map((issue) => (
                                <button
                                    type="button"
                                    key={issue.id}
                                    className={`review-issue-row ${issue.severity.toLowerCase()} ${
                                        selectedIssueId === issue.id
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() => {
                                        setSelectedIssueId(issue.id);

                                        if (issue.pageNumber) {
                                            if (syncEnabled) {
                                                changeSharedPage(
                                                    issue.pageNumber
                                                );
                                            } else {
                                                setOriginalPage(
                                                    issue.pageNumber
                                                );
                                                setOutputPage(
                                                    issue.pageNumber
                                                );
                                            }
                                        }
                                    }}
                                >
                                    <span className="issue-severity-dot" />

                                    <span className="issue-copy">
                                        <strong>{issue.title}</strong>
                                        <small>{issue.description}</small>
                                    </span>

                                    {issue.pageNumber && (
                                        <span className="issue-page">
                                            Page {issue.pageNumber}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <div className="review-sync-bar">
                <div>
                    <strong>
                        {syncEnabled
                            ? "Synchronized review"
                            : "Independent review"}
                    </strong>
                    <span>
                        {syncEnabled
                            ? "Page and zoom changes apply to both viewers."
                            : "Each viewer can use a different page and zoom level."}
                    </span>
                </div>

                {syncEnabled && (
                    <div className="review-sync-controls">
                        <button
                            type="button"
                            className="icon-button"
                            disabled={sharedPage <= 1}
                            onClick={() =>
                                changeSharedPage(sharedPage - 1)
                            }
                        >
                            ‹
                        </button>

                        <span>
                            Page {sharedPage}
                            {effectiveSharedPageCount > 0
                                ? ` of ${effectiveSharedPageCount}`
                                : ""}
                        </span>

                        <button
                            type="button"
                            className="icon-button"
                            disabled={
                                effectiveSharedPageCount > 0 &&
                                sharedPage >= effectiveSharedPageCount
                            }
                            onClick={() =>
                                changeSharedPage(sharedPage + 1)
                            }
                        >
                            ›
                        </button>

                        <button
                            type="button"
                            className="icon-button"
                            disabled={sharedScale <= 50}
                            onClick={() =>
                                changeSharedScale(sharedScale - 25)
                            }
                        >
                            −
                        </button>

                        <span>{sharedScale}%</span>

                        <button
                            type="button"
                            className="icon-button"
                            disabled={sharedScale >= 200}
                            onClick={() =>
                                changeSharedScale(sharedScale + 25)
                            }
                        >
                            +
                        </button>
                    </div>
                )}
            </div>

            <div className="dual-pdf-viewer">
                <PreviewPane
                    title="Original Scan"
                    subtitle={selectedDocument?.fileName ?? ""}
                    filePath={selectedDocument?.destinationPath ?? null}
                    pageNumber={syncEnabled ? sharedPage : originalPage}
                    scalePercent={
                        syncEnabled ? sharedScale : originalScale
                    }
                    syncEnabled={syncEnabled}
                    onPageChange={
                        syncEnabled ? changeSharedPage : setOriginalPage
                    }
                    onScaleChange={
                        syncEnabled ? changeSharedScale : setOriginalScale
                    }
                    onPageCountChange={setOriginalPageCount}
                />

                <PreviewPane
                    title="OCR Output"
                    subtitle="Searchable and compressed result"
                    filePath={outputPath}
                    pageNumber={syncEnabled ? sharedPage : outputPage}
                    scalePercent={
                        syncEnabled ? sharedScale : outputScale
                    }
                    syncEnabled={syncEnabled}
                    onPageChange={
                        syncEnabled ? changeSharedPage : setOutputPage
                    }
                    onScaleChange={
                        syncEnabled ? changeSharedScale : setOutputScale
                    }
                    onPageCountChange={setOutputPageCount}
                />
            </div>

            <footer className="review-help">
                Use Synchronized mode to compare matching pages at the same
                zoom. Quality findings are derived from PDF Analysis and current
                output metadata. Page-level OCR confidence will be added after
                the OCR engine begins persisting per-page confidence data.
            </footer>
        </section>
    );
}
