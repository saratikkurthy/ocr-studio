import { useEffect, useMemo, useRef, useState } from "react";
import type { OcrIndexedWord, OcrWordIndexManifest, OcrWordIndexPage, PageConfidenceRecord, PdfAnalysis, ProjectDocument, WordIndexBackgroundJob } from "./types";

function normalizeWordSearch(value: string) {
    return value
        .normalize("NFC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
}

type ReviewTabProps = {
    projectPath: string;
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

type DocumentWordResult = OcrIndexedWord & {
    documentId: number;
    sourceFile: string;
};

type ReviewCollaboration = {
    version: number;
    reviewers: Array<{
        id: string;
        name: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    assignments: Array<{
        id: string;
        documentId: number;
        documentName: string;
        reviewerId: string;
        reviewerName: string;
        scope: "document" | "pages";
        pageStart: number | null;
        pageEnd: number | null;
        priority: string;
        note: string;
        status: string;
        createdAt: string;
        startedAt: string | null;
        completedAt: string | null;
        updatedAt: string;
    }>;
    comments: Array<{
        id: string;
        documentId: number;
        documentName: string;
        pageNumber: number | null;
        wordId: string | null;
        author: string;
        text: string;
        status: string;
        createdAt: string;
        resolvedAt: string | null;
        resolvedBy: string | null;
    }>;
    activity: Array<{
        id: string;
        action: string;
        details: string;
        createdAt: string;
    }>;
    updatedAt: string | null;
};

type PublicationDashboard = {
    generatedAt: string;
    engineStatus: "Idle" | "Running" | "Paused" | "Recovering";
    settings: {
        workerCount: number;
        isPaused: boolean;
    };
    counts: {
        total: number;
        queued: number;
        running: number;
        completed: number;
        failed: number;
        cancelled: number;
    };
    averageDurationMs: number;
    estimatedRemainingMs: number;
    totalGeneratedFiles: number;
    totalGeneratedBytes: number;
    recentCompleted: number;
    totalChangedPages: number;
    totalUnchangedPages: number;
    workerUtilizationPercent: number;
    recentJobs: Array<{
        id: string;
        documentName: string;
        status: string;
        progress: number;
        durationMs: number;
        createdAt: string;
        completedAt: string | null;
        files: number;
        error: string | null;
    }>;
};

type PublicationProfile = {
    id: string;
    name: string;
    options: Record<string, boolean>;
    createdAt: string;
    updatedAt: string;
};

type PublicationQueueJob = {
    id: string;
    documentId: number;
    documentName: string;
    profileId: string | null;
    profileName: string | null;
    options: Record<string, boolean>;
    status: "Queued" | "Running" | "Completed" | "Failed" | "Cancelled";
    progress: number;
    message: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    folderPath: string | null;
    files: Array<{
        type: string;
        fileName: string;
        filePath: string;
    }>;
    error: string | null;
    attempts: number;
    incremental?: {
        enabled: boolean;
        hasPreviousSnapshot: boolean;
        changedPageNumbers: number[];
        unchangedPageNumbers: number[];
    } | null;
};

type PublishValidation = {
    valid: boolean;
    missingPages: number[];
    emptyPages: number[];
    malformedWords: number;
    invalidBoxes: number;
    duplicateWordIds: number;
};

type PublishSummary = {
    pages: number;
    words: number;
    corrected: number;
    verified: number;
    ignored: number;
    unreviewed: number;
    publishedWords: number;
};

type PublishRecord = {
    id: string;
    documentId: number;
    documentName: string;
    version: number;
    publishedAt: string;
    durationMs: number;
    folderPath: string;
    summary: PublishSummary;
    validation: PublishValidation;
    files: Array<{
        type: string;
        fileName: string;
        filePath: string;
    }>;
};

type BatchCorrectionTransaction = {
    id: string;
    documentId: number;
    sourceText: string;
    correctedText: string;
    createdAt: string;
    applied: number;
    failed: number;
    undoneAt: string | null;
    undoRestored: number;
    undoFailed: number;
};

type CorrectionRule = {
    id: string;
    documentId: number;
    sourceText: string;
    correctedText: string;
    maxConfidence: number;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    appliedCount: number;
    lastAppliedAt: string | null;
};

type CorrectionMemoryItem = {
    sourceText: string;
    normalizedSource: string;
    correctedText: string;
    timesApplied: number;
    lastUsedAt: string | null;
};

type BatchCorrectionMatch = {
    documentId: number;
    pageNumber: number;
    wordId: string;
    text: string;
    confidence: number;
    status: string;
    correctedText: string | null;
    box: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
};

type IntelligentSuggestion = {
    text: string;
    score: number;
    similarity: number;
    occurrences: number;
    averageConfidence: number;
    correctedOccurrences: number;
    verifiedOccurrences: number;
    reason: string;
    examples: Array<{
        pageNumber: number;
        confidence: number;
        status: string;
    }>;
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
    overlayEnabled?: boolean;
    overlayWords?: OcrIndexedWord[];
    overlayImageWidth?: number;
    overlayImageHeight?: number;
    selectedOverlayWordId?: string | null;
    onOverlayWordSelect?: (wordId: string) => void;
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
    overlayEnabled = false,
    overlayWords = [],
    overlayImageWidth = 0,
    overlayImageHeight = 0,
    selectedOverlayWordId = null,
    onOverlayWordSelect,
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
                        <div className="pdf-page-overlay-stage">
                            <img
                                src={imageUrl}
                                alt={`${title}, page ${pageNumber}`}
                                className="pdf-page-image"
                                draggable={false}
                            />

                            {overlayEnabled &&
                                overlayImageWidth > 0 &&
                                overlayImageHeight > 0 && (
                                    <div
                                        className="confidence-overlay-layer"
                                        aria-label="OCR confidence overlay"
                                    >
                                        {overlayWords.map((word) => {
                                            const left =
                                                (word.box.left /
                                                    overlayImageWidth) *
                                                100;
                                            const top =
                                                (word.box.top /
                                                    overlayImageHeight) *
                                                100;
                                            const width =
                                                (word.box.width /
                                                    overlayImageWidth) *
                                                100;
                                            const height =
                                                (word.box.height /
                                                    overlayImageHeight) *
                                                100;

                                            const level =
                                                word.confidence < 35
                                                    ? "poor"
                                                    : word.confidence < 60
                                                      ? "review"
                                                      : word.confidence < 75
                                                        ? "good"
                                                        : "excellent";

                                            return (
                                                <button
                                                    type="button"
                                                    key={`overlay-${word.id}`}
                                                    className={`confidence-box ${level} ${
                                                        selectedOverlayWordId ===
                                                        word.id
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                    style={{
                                                        left: `${left}%`,
                                                        top: `${top}%`,
                                                        width: `${width}%`,
                                                        height: `${height}%`,
                                                    }}
                                                    title={`${word.text} — ${word.confidence.toFixed(
                                                        1
                                                    )}% confidence`}
                                                    onClick={() =>
                                                        onOverlayWordSelect?.(
                                                            word.id
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                        </div>
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
    projectPath,
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

    const [wordIndexPage, setWordIndexPage] =
        useState<OcrWordIndexPage | null>(null);
    const [wordInspectorLoading, setWordInspectorLoading] =
        useState(false);
    const [wordInspectorMessage, setWordInspectorMessage] =
        useState("");
    const [selectedWordId, setSelectedWordId] =
        useState<string | null>(null);
    const [wordFilter, setWordFilter] = useState<
        "all" | "review" | "poor"
    >("review");
    const [wordSearch, setWordSearch] = useState("");
    const [confidenceOverlayEnabled, setConfidenceOverlayEnabled] =
        useState(true);
    const [confidenceOverlayFilter, setConfidenceOverlayFilter] =
        useState<"poor" | "review" | "all">("review");
    const [correctionDraft, setCorrectionDraft] = useState("");
    const [wordReviewSaving, setWordReviewSaving] =
        useState(false);
    const [wordReviewMessage, setWordReviewMessage] =
        useState("");
    const [documentSearchQuery, setDocumentSearchQuery] =
        useState("");
    const [documentSearchMode, setDocumentSearchMode] =
        useState<"all" | "review" | "poor" | "unreviewed">(
            "all"
        );
    const [documentSearchResults, setDocumentSearchResults] =
        useState<DocumentWordResult[]>([]);
    const [documentSearchLoading, setDocumentSearchLoading] =
        useState(false);
    const [documentSearchMessage, setDocumentSearchMessage] =
        useState("");
    const [documentSearchTotal, setDocumentSearchTotal] =
        useState(0);
    const [documentSearchTruncated, setDocumentSearchTruncated] =
        useState(false);
    const [reviewQueue, setReviewQueue] =
        useState<DocumentWordResult[]>([]);
    const [reviewQueueTotal, setReviewQueueTotal] =
        useState(0);
    const [reviewQueueLoading, setReviewQueueLoading] =
        useState(false);
    const [pendingDocumentWordId, setPendingDocumentWordId] =
        useState<string | null>(null);
    const [intelligentSuggestions, setIntelligentSuggestions] =
        useState<IntelligentSuggestion[]>([]);
    const [suggestionContext, setSuggestionContext] =
        useState<Array<{
            id: string;
            text: string;
            selected: boolean;
            confidence: number;
        }>>([]);
    const [suggestionLoading, setSuggestionLoading] =
        useState(false);
    const [suggestionMessage, setSuggestionMessage] =
        useState("");
    const [correctionMemory, setCorrectionMemory] =
        useState<CorrectionMemoryItem[]>([]);
    const [batchMatches, setBatchMatches] =
        useState<BatchCorrectionMatch[]>([]);
    const [selectedBatchMatchIds, setSelectedBatchMatchIds] =
        useState<Set<string>>(new Set());
    const [batchPreviewLoading, setBatchPreviewLoading] =
        useState(false);
    const [batchApplyLoading, setBatchApplyLoading] =
        useState(false);
    const [batchMessage, setBatchMessage] = useState("");
    const [batchMaxConfidence, setBatchMaxConfidence] =
        useState(100);
    const [batchTransactions, setBatchTransactions] =
        useState<BatchCorrectionTransaction[]>([]);
    const [batchUndoLoadingId, setBatchUndoLoadingId] =
        useState<string | null>(null);
    const [correctionRules, setCorrectionRules] =
        useState<CorrectionRule[]>([]);
    const [ruleMessage, setRuleMessage] = useState("");
    const [publishOptions, setPublishOptions] = useState({
        includeCorrected: true,
        includeVerified: true,
        includeUnreviewed: true,
        includeIgnored: false,
        exportTxt: true,
        exportJson: true,
        exportCsv: true,
        exportHtml: true,
        exportTsv: false,
        exportMarkdown: false,
        exportHocr: false,
        exportAlto: false,
        exportPageXml: false,
        incrementalPublishing: false,
    });
    const [publishValidation, setPublishValidation] =
        useState<PublishValidation | null>(null);
    const [publishSummary, setPublishSummary] =
        useState<PublishSummary | null>(null);
    const [publishHistory, setPublishHistory] =
        useState<PublishRecord[]>([]);
    const [publishMessage, setPublishMessage] = useState("");
    const [publishValidating, setPublishValidating] =
        useState(false);
    const [publishRunning, setPublishRunning] = useState(false);
    const [searchablePdfRunning, setSearchablePdfRunning] =
        useState(false);
    const [searchablePdfPath, setSearchablePdfPath] =
        useState<string | null>(null);
    const [publicationProfiles, setPublicationProfiles] =
        useState<PublicationProfile[]>([]);
    const [publicationProfileName, setPublicationProfileName] =
        useState("");
    const [selectedPublicationProfileId, setSelectedPublicationProfileId] =
        useState<string | null>(null);
    const [publicationQueue, setPublicationQueue] =
        useState<PublicationQueueJob[]>([]);
    const [selectedQueueDocumentIds, setSelectedQueueDocumentIds] =
        useState<Set<number>>(new Set());
    const [publicationQueueMessage, setPublicationQueueMessage] =
        useState("");
    const [publicationQueueLoading, setPublicationQueueLoading] =
        useState(false);
    const [publicationWorkerCount, setPublicationWorkerCount] =
        useState(2);
    const [publicationQueuePaused, setPublicationQueuePaused] =
        useState(false);
    const [reviewCollaboration, setReviewCollaboration] =
        useState<ReviewCollaboration | null>(null);
    const [reviewerName, setReviewerName] = useState("");
    const [reviewerRole, setReviewerRole] =
        useState("Reviewer");
    const [assignmentReviewerId, setAssignmentReviewerId] =
        useState("");
    const [assignmentScope, setAssignmentScope] =
        useState<"document" | "pages">("document");
    const [assignmentPageStart, setAssignmentPageStart] =
        useState(1);
    const [assignmentPageEnd, setAssignmentPageEnd] =
        useState(1);
    const [assignmentPriority, setAssignmentPriority] =
        useState("Normal");
    const [assignmentNote, setAssignmentNote] =
        useState("");
    const [commentAuthor, setCommentAuthor] =
        useState("");
    const [reviewCommentText, setReviewCommentText] =
        useState("");
    const [reviewCollaborationMessage, setReviewCollaborationMessage] =
        useState("");
    const [reviewCollaborationReportPath, setReviewCollaborationReportPath] =
        useState<string | null>(null);

    const [publicationDashboard, setPublicationDashboard] =
        useState<PublicationDashboard | null>(null);
    const [publicationDashboardLoading, setPublicationDashboardLoading] =
        useState(false);
    const [publicationAuditPath, setPublicationAuditPath] =
        useState<string | null>(null);

    const [incrementalPreview, setIncrementalPreview] =
        useState<{
            hasPreviousSnapshot: boolean;
            changedPageNumbers: number[];
            unchangedPageNumbers: number[];
            previousPublishedAt: string | null;
            totalPages: number;
        } | null>(null);

    useEffect(() => {
        void loadPublicationDashboard(true);
        void loadPublicationQueue();
        void loadReviewCollaboration();

        const timer = window.setInterval(() => {
            void loadPublicationDashboard(true);
            void loadPublicationQueue();
        }, 3000);

        return () => {
            window.clearInterval(timer);
        };
    }, [projectPath]);

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
        setWordIndexPage(null);
        setSelectedWordId(null);
        setWordInspectorMessage("");
        setWordSearch("");
        setCorrectionDraft("");
        setWordReviewMessage("");
        setDocumentSearchQuery("");
        setDocumentSearchResults([]);
        setDocumentSearchMessage("");
        setDocumentSearchTotal(0);
        setDocumentSearchTruncated(false);
        setReviewQueue([]);
        setReviewQueueTotal(0);
        setPendingDocumentWordId(null);
        setIntelligentSuggestions([]);
        setSuggestionContext([]);
        setSuggestionMessage("");
        setCorrectionMemory([]);
        setBatchMatches([]);
        setSelectedBatchMatchIds(new Set());
        setBatchMessage("");
        setBatchTransactions([]);
        setCorrectionRules([]);
        setRuleMessage("");
        setPublishValidation(null);
        setPublishSummary(null);
        setPublishHistory([]);
        setPublishMessage("");
        setSearchablePdfPath(null);
        setPublicationQueueMessage("");
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
                    Number(item.documentId) === Number(selectedDocumentId)
            ),
        [wordIndexManifest, selectedDocumentId]
    );

    const selectedWordIndexJobs = useMemo(
        () =>
            wordIndexJobs
                .filter(
                    (job) =>
                        Number(job.documentId) === Number(selectedDocumentId)
                )
                .sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                ),
        [wordIndexJobs, selectedDocumentId]
    );

    const currentReviewPage = syncEnabled
        ? sharedPage
        : outputPage;

    useEffect(() => {
        let cancelled = false;

        async function loadWordPage() {
            if (
                selectedDocumentId === null ||
                !selectedWordIndex?.indexedPages.includes(
                    currentReviewPage
                )
            ) {
                setWordIndexPage(null);
                setSelectedWordId(null);
                setWordInspectorMessage(
                    selectedWordIndex
                        ? `Page ${currentReviewPage} has not been indexed yet.`
                        : "Build the OCR word database to inspect words."
                );
                return;
            }

            setWordInspectorLoading(true);
            setWordInspectorMessage("");

            try {
                const result =
                    await window.ocrStudio.getWordIndexPage({
                        projectPath:
                            projectPath,
                        documentId: selectedDocumentId,
                        pageNumber: currentReviewPage,
                    });

                if (cancelled) return;

                setWordIndexPage(result);
                setSelectedWordId(
                    result?.words
                        .slice()
                        .sort(
                            (a, b) =>
                                a.confidence - b.confidence
                        )[0]?.id ?? null
                );

                if (!result) {
                    setWordInspectorMessage(
                        `No word data was found for page ${currentReviewPage}.`
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    setWordIndexPage(null);
                    setSelectedWordId(null);
                    setWordInspectorMessage(
                        error instanceof Error
                            ? error.message
                            : "Could not load the word database page."
                    );
                }
            } finally {
                if (!cancelled) {
                    setWordInspectorLoading(false);
                }
            }
        }

        void loadWordPage();

        return () => {
            cancelled = true;
        };
    }, [
        selectedDocumentId,
        projectPath,
        selectedWordIndex,
        currentReviewPage,
    ]);

    const visibleWords = useMemo(() => {
        const query = normalizeWordSearch(wordSearch);
        const hasSearch = query.length > 0;

        return (wordIndexPage?.words || [])
            .filter((word) => {
                const normalizedWord = normalizeWordSearch(
                    word.correctedText || word.text
                );

                // A typed or pasted search always searches every word on the
                // active indexed page. Confidence filters apply only while
                // browsing without a search term.
                if (hasSearch) {
                    return normalizedWord.includes(query);
                }

                if (
                    wordFilter === "review" &&
                    word.confidence >= 60
                ) {
                    return false;
                }

                if (
                    wordFilter === "poor" &&
                    word.confidence >= 35
                ) {
                    return false;
                }

                return true;
            })
            .sort(
                (a, b) =>
                    a.confidence - b.confidence ||
                    a.lineNumber - b.lineNumber ||
                    a.wordNumber - b.wordNumber
            );
    }, [wordIndexPage, wordFilter, wordSearch]);

    const selectedWord = useMemo(
        () =>
            wordIndexPage?.words.find(
                (word) => word.id === selectedWordId
            ) ?? null,
        [wordIndexPage, selectedWordId]
    );

    useEffect(() => {
        setCorrectionDraft(
            selectedWord?.correctedText ||
                selectedWord?.text ||
                ""
        );
        setWordReviewMessage("");
        setIntelligentSuggestions([]);
        setSuggestionContext([]);
        setSuggestionMessage("");
        setBatchMatches([]);
        setSelectedBatchMatchIds(new Set());
        setBatchMessage("");
    }, [selectedWordId, selectedWord?.correctedText, selectedWord?.text]);

    const reviewSummary = useMemo(() => {
        const words = wordIndexPage?.words || [];

        return {
            unreviewed: words.filter(
                (word) => word.status === "Unreviewed"
            ).length,
            verified: words.filter(
                (word) => word.status === "Verified"
            ).length,
            corrected: words.filter(
                (word) => word.status === "Corrected"
            ).length,
            ignored: words.filter(
                (word) => word.status === "Ignored"
            ).length,
        };
    }, [wordIndexPage]);

    const runDocumentSearch = async () => {
        if (selectedDocumentId === null) return;

        setDocumentSearchLoading(true);
        setDocumentSearchMessage("");

        try {
            const result =
                await window.ocrStudio.searchWordIndexDocument({
                    projectPath,
                    documentId: selectedDocumentId,
                    query: documentSearchQuery,
                    mode: documentSearchMode,
                    limit: 500,
                });

            setDocumentSearchResults(result.results);
            setDocumentSearchTotal(result.totalMatches);
            setDocumentSearchTruncated(result.truncated);
            setDocumentSearchMessage(result.message);
        } catch (error) {
            setDocumentSearchResults([]);
            setDocumentSearchTotal(0);
            setDocumentSearchTruncated(false);
            setDocumentSearchMessage(
                error instanceof Error
                    ? error.message
                    : "Could not search the document word index."
            );
        } finally {
            setDocumentSearchLoading(false);
        }
    };

    const loadDocumentReviewQueue = async () => {
        if (selectedDocumentId === null) return;

        setReviewQueueLoading(true);

        try {
            const result =
                await window.ocrStudio.getWordIndexReviewQueue({
                    projectPath,
                    documentId: selectedDocumentId,
                    limit: 500,
                });

            setReviewQueue(result.results);
            setReviewQueueTotal(result.totalMatches);
        } catch {
            setReviewQueue([]);
            setReviewQueueTotal(0);
        } finally {
            setReviewQueueLoading(false);
        }
    };

    const openDocumentWord = (
        result: DocumentWordResult
    ) => {
        setPendingDocumentWordId(result.id);
        setWordFilter("all");
        setWordSearch("");

        if (syncEnabled) {
            changeSharedPage(result.pageNumber);
        } else {
            setOriginalPage(result.pageNumber);
            setOutputPage(result.pageNumber);
        }

        window.setTimeout(() => {
            document
                .querySelector(".word-inspector")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }, 120);
    };

    useEffect(() => {
        if (!pendingDocumentWordId || !wordIndexPage) return;

        const word = wordIndexPage.words.find(
            (item) => item.id === pendingDocumentWordId
        );

        if (!word) return;

        setSelectedWordId(word.id);
        setPendingDocumentWordId(null);
    }, [pendingDocumentWordId, wordIndexPage]);

    const loadReviewCollaboration = async () => {
        try {
            const result =
                await window.ocrStudio.getReviewCollaboration({
                    projectPath,
                });

            if (result.success && result.state) {
                setReviewCollaboration(result.state);

                if (
                    !assignmentReviewerId &&
                    result.state.reviewers.length > 0
                ) {
                    const firstActive =
                        result.state.reviewers.find(
                            (reviewer) =>
                                reviewer.isActive
                        );
                    setAssignmentReviewerId(
                        firstActive?.id || ""
                    );
                }
            }

            setReviewCollaborationMessage(result.message);
        } catch (error) {
            setReviewCollaborationMessage(
                error instanceof Error
                    ? error.message
                    : "Could not load collaborative review."
            );
        }
    };

    const addReviewCollaborator = async () => {
        if (!reviewerName.trim()) {
            setReviewCollaborationMessage(
                "Enter the reviewer name."
            );
            return;
        }

        const result =
            await window.ocrStudio.addReviewCollaborator({
                projectPath,
                name: reviewerName,
                role: reviewerRole,
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
        setReviewerName("");
    };

    const toggleReviewCollaborator = async (
        reviewerId: string
    ) => {
        const result =
            await window.ocrStudio.toggleReviewCollaborator({
                projectPath,
                reviewerId,
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
    };

    const createReviewAssignment = async () => {
        if (
            selectedDocumentId === null ||
            !selectedDocument ||
            !assignmentReviewerId
        ) {
            setReviewCollaborationMessage(
                "Select a document and reviewer."
            );
            return;
        }

        const result =
            await window.ocrStudio.createReviewAssignment({
                projectPath,
                documentId: selectedDocumentId,
                documentName:
                    selectedDocument.fileName ||
                    `Document ${selectedDocumentId}`,
                reviewerId: assignmentReviewerId,
                scope: assignmentScope,
                pageStart: assignmentPageStart,
                pageEnd: assignmentPageEnd,
                priority: assignmentPriority,
                note: assignmentNote,
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
        setAssignmentNote("");
    };

    const updateReviewAssignment = async (
        assignmentId: string,
        status: string
    ) => {
        const result =
            await window.ocrStudio.updateReviewAssignment({
                projectPath,
                assignmentId,
                status,
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
    };

    const addReviewComment = async () => {
        if (
            selectedDocumentId === null ||
            !selectedDocument ||
            !commentAuthor.trim() ||
            !reviewCommentText.trim()
        ) {
            setReviewCollaborationMessage(
                "Enter the comment author and comment."
            );
            return;
        }

        const result =
            await window.ocrStudio.addReviewComment({
                projectPath,
                documentId: selectedDocumentId,
                documentName:
                    selectedDocument.fileName ||
                    `Document ${selectedDocumentId}`,
                pageNumber: sharedPage,
                wordId: selectedWordId,
                author: commentAuthor,
                text: reviewCommentText,
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
        setReviewCommentText("");
    };

    const resolveReviewComment = async (
        commentId: string
    ) => {
        const result =
            await window.ocrStudio.resolveReviewComment({
                projectPath,
                commentId,
                resolvedBy:
                    commentAuthor.trim() || "Reviewer",
            });

        if (result.state) {
            setReviewCollaboration(result.state);
        }

        setReviewCollaborationMessage(result.message);
    };

    const exportReviewCollaborationReport = async () => {
        const result =
            await window.ocrStudio.exportReviewCollaborationReport({
                projectPath,
            });

        setReviewCollaborationMessage(result.message);
        setReviewCollaborationReportPath(result.filePath);
    };

    const formatDuration = (milliseconds: number) => {
        if (!milliseconds || milliseconds < 1) {
            return "—";
        }

        const totalSeconds = Math.round(milliseconds / 1000);

        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes < 60) {
            return `${minutes}m ${seconds}s`;
        }

        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes || bytes < 1) return "0 B";

        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(
            units.length - 1,
            Math.floor(Math.log(bytes) / Math.log(1024))
        );
        const value = bytes / 1024 ** index;

        return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    };

    const loadPublicationDashboard = async (
        quiet = false
    ) => {
        if (!quiet) {
            setPublicationDashboardLoading(true);
        }

        try {
            const result =
                await window.ocrStudio.getPublicationDashboard({
                    projectPath,
                });

            if (result.success && result.dashboard) {
                setPublicationDashboard(result.dashboard);
                setPublicationWorkerCount(
                    result.dashboard.settings.workerCount
                );
                setPublicationQueuePaused(
                    result.dashboard.settings.isPaused
                );
            }
        } catch (error) {
            if (!quiet) {
                setPublicationQueueMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load publishing dashboard."
                );
            }
        } finally {
            if (!quiet) {
                setPublicationDashboardLoading(false);
            }
        }
    };

    const exportPublicationAuditLog = async () => {
        try {
            const result =
                await window.ocrStudio.exportPublicationAuditLog({
                    projectPath,
                });

            setPublicationQueueMessage(result.message);
            setPublicationAuditPath(result.filePath);
        } catch (error) {
            setPublicationQueueMessage(
                error instanceof Error
                    ? error.message
                    : "Could not export the audit log."
            );
        }
    };

    const loadPublicationSettings = async () => {
        try {
            const settings =
                await window.ocrStudio.getPublicationSettings({
                    projectPath,
                });
            setPublicationWorkerCount(settings.workerCount);
            setPublicationQueuePaused(settings.isPaused);
        } catch {
            setPublicationWorkerCount(2);
            setPublicationQueuePaused(false);
        }
    };

    const updatePublicationWorkers = async (
        workerCount: number
    ) => {
        const result =
            await window.ocrStudio.updatePublicationSettings({
                projectPath,
                workerCount,
            });
        setPublicationWorkerCount(
            result.settings.workerCount
        );
        setPublicationQueuePaused(
            result.settings.isPaused
        );
        setPublicationQueueMessage(result.message);
    };

    const togglePublicationPause = async () => {
        const result =
            await window.ocrStudio.updatePublicationSettings({
                projectPath,
                isPaused: !publicationQueuePaused,
            });
        setPublicationWorkerCount(
            result.settings.workerCount
        );
        setPublicationQueuePaused(
            result.settings.isPaused
        );
        setPublicationQueueMessage(result.message);
        await loadPublicationQueue();
    };

    const previewIncrementalPublication = async () => {
        if (selectedDocumentId === null) return;

        try {
            const result =
                await window.ocrStudio.previewIncrementalPublication({
                    projectPath,
                    documentId: selectedDocumentId,
                    options: publishOptions,
                });
            setIncrementalPreview(result.preview);
            setPublicationQueueMessage(result.message);
        } catch (error) {
            setIncrementalPreview(null);
            setPublicationQueueMessage(
                error instanceof Error
                    ? error.message
                    : "Could not preview changed pages."
            );
        }
    };

    const loadPublicationProfiles = async () => {
        try {
            const profiles =
                await window.ocrStudio.listPublicationProfiles({
                    projectPath,
                });
            setPublicationProfiles(profiles);
        } catch {
            setPublicationProfiles([]);
        }
    };

    const savePublicationProfile = async () => {
        if (!publicationProfileName.trim()) {
            setPublicationQueueMessage(
                "Enter a publication profile name."
            );
            return;
        }

        try {
            const result =
                await window.ocrStudio.savePublicationProfile({
                    projectPath,
                    name: publicationProfileName,
                    options: publishOptions,
                });

            setPublicationProfiles(result.profiles);
            setPublicationQueueMessage(result.message);
            setPublicationProfileName("");
        } catch (error) {
            setPublicationQueueMessage(
                error instanceof Error
                    ? error.message
                    : "Could not save the publication profile."
            );
        }
    };

    const applyPublicationProfile = (
        profile: PublicationProfile
    ) => {
        setSelectedPublicationProfileId(profile.id);
        setPublishOptions((current) => ({
            ...current,
            ...profile.options,
        }));
        setPublicationQueueMessage(
            `Loaded publication profile “${profile.name}”.`
        );
    };

    const deletePublicationProfile = async (
        profileId: string
    ) => {
        try {
            const result =
                await window.ocrStudio.deletePublicationProfile({
                    projectPath,
                    profileId,
                });

            setPublicationProfiles(result.profiles);
            setPublicationQueueMessage(result.message);

            if (selectedPublicationProfileId === profileId) {
                setSelectedPublicationProfileId(null);
            }
        } catch {
            setPublicationQueueMessage(
                "Could not delete the publication profile."
            );
        }
    };

    const loadPublicationQueue = async () => {
        try {
            const jobs =
                await window.ocrStudio.listPublicationQueue({
                    projectPath,
                });
            setPublicationQueue(jobs);
        } catch {
            setPublicationQueue([]);
        }
    };

    const enqueuePublicationJobs = async () => {
        const selectedDocuments = reviewableDocuments
            .filter((document) =>
                selectedQueueDocumentIds.has(document.id)
            )
            .map((document) => ({
                documentId: document.id,
                documentName:
                    document.fileName ||
                    `document-${document.id}`,
                basePdf:
                    document.destinationPath ||
                    document.sourcePath ||
                    document.outputPath ||
                    document.searchablePath ||
                    null,
            }));

        if (selectedDocuments.length === 0) {
            setPublicationQueueMessage(
                "Select at least one document for the queue."
            );
            return;
        }

        const profile = publicationProfiles.find(
            (item) =>
                item.id === selectedPublicationProfileId
        );

        setPublicationQueueLoading(true);

        try {
            const result =
                await window.ocrStudio.enqueuePublicationJobs({
                    projectPath,
                    documents: selectedDocuments,
                    profileId: profile?.id || null,
                    profileName: profile?.name || null,
                    options: publishOptions,
                });

            setPublicationQueueMessage(result.message);
            setSelectedQueueDocumentIds(new Set());
            await loadPublicationQueue();
        } catch (error) {
            setPublicationQueueMessage(
                error instanceof Error
                    ? error.message
                    : "Could not queue publication jobs."
            );
        } finally {
            setPublicationQueueLoading(false);
        }
    };

    const retryPublicationJob = async (jobId: string) => {
        await window.ocrStudio.retryPublicationJob({
            projectPath,
            jobId,
        });
        await loadPublicationQueue();
    };

    const cancelPublicationJob = async (jobId: string) => {
        await window.ocrStudio.cancelPublicationJob({
            projectPath,
            jobId,
        });
        await loadPublicationQueue();
    };

    const removePublicationJob = async (jobId: string) => {
        await window.ocrStudio.removePublicationJob({
            projectPath,
            jobId,
        });
        await loadPublicationQueue();
    };

    const resumePublicationQueue = async () => {
        const result =
            await window.ocrStudio.resumePublicationQueue({
                projectPath,
            });
        setPublicationQueueMessage(result.message);
        await loadPublicationQueue();
    };

    const toggleQueueDocument = (documentId: number) => {
        setSelectedQueueDocumentIds((current) => {
            const next = new Set(current);

            if (next.has(documentId)) {
                next.delete(documentId);
            } else {
                next.add(documentId);
            }

            return next;
        });
    };

    const validatePublication = async () => {
        if (selectedDocumentId === null) return;

        setPublishValidating(true);
        setPublishMessage("");

        try {
            const result =
                await window.ocrStudio.validatePublishedDocument({
                    projectPath,
                    documentId: selectedDocumentId,
                    options: {
                        includeCorrected:
                            publishOptions.includeCorrected,
                        includeVerified:
                            publishOptions.includeVerified,
                        includeUnreviewed:
                            publishOptions.includeUnreviewed,
                        includeIgnored:
                            publishOptions.includeIgnored,
                    },
                });

            setPublishValidation(result.validation);
            setPublishSummary(result.summary);
            setPublishMessage(result.message);
        } catch (error) {
            setPublishValidation(null);
            setPublishSummary(null);
            setPublishMessage(
                error instanceof Error
                    ? error.message
                    : "Could not validate the publication."
            );
        } finally {
            setPublishValidating(false);
        }
    };

    const loadPublishHistory = async () => {
        if (selectedDocumentId === null) return;

        try {
            const history =
                await window.ocrStudio.listPublishHistory({
                    projectPath,
                    documentId: selectedDocumentId,
                });

            setPublishHistory(history);
        } catch {
            setPublishHistory([]);
        }
    };

    const publishCorrectedSearchablePdf = async () => {
        if (
            selectedDocumentId === null ||
            !selectedDocument
        ) {
            return;
        }

        const basePdf =
            selectedDocument.destinationPath ||
            selectedDocument.sourcePath ||
            selectedDocument.outputPath ||
            selectedDocument.searchablePath;

        if (!basePdf) {
            setPublishMessage(
                "No base PDF path is available for this document."
            );
            return;
        }

        setSearchablePdfRunning(true);
        setPublishMessage("");
        setSearchablePdfPath(null);

        try {
            const result =
                await window.ocrStudio.createCorrectedSearchablePdf({
                    projectPath,
                    documentId: selectedDocumentId,
                    documentName:
                        selectedDocument.fileName ||
                        `document-${selectedDocumentId}`,
                    basePdf,
                    options: {
                        includeCorrected:
                            publishOptions.includeCorrected,
                        includeVerified:
                            publishOptions.includeVerified,
                        includeUnreviewed:
                            publishOptions.includeUnreviewed,
                        includeIgnored:
                            publishOptions.includeIgnored,
                    },
                });

            setPublishMessage(result.message);

            if (result.success && result.outputPdf) {
                setSearchablePdfPath(result.outputPdf);
                await loadPublishHistory();
            }
        } catch (error) {
            setPublishMessage(
                error instanceof Error
                    ? error.message
                    : "Could not rebuild the searchable PDF."
            );
        } finally {
            setSearchablePdfRunning(false);
        }
    };

    const publishApprovedCorrections = async () => {
        if (
            selectedDocumentId === null ||
            !selectedDocument
        ) {
            return;
        }

        if (
            !publishOptions.exportTxt &&
            !publishOptions.exportJson &&
            !publishOptions.exportCsv &&
            !publishOptions.exportHtml &&
            !publishOptions.exportTsv &&
            !publishOptions.exportMarkdown &&
            !publishOptions.exportHocr &&
            !publishOptions.exportAlto &&
            !publishOptions.exportPageXml
        ) {
            setPublishMessage(
                "Select at least one export format."
            );
            return;
        }

        setPublishRunning(true);
        setPublishMessage("");

        try {
            const result =
                await window.ocrStudio.createPublishedBundle({
                    projectPath,
                    documentId: selectedDocumentId,
                    documentName:
                        selectedDocument.fileName ||
                        `document-${selectedDocumentId}`,
                    options: publishOptions,
                });

            setPublishMessage(result.message);

            if (result.success && result.record) {
                setPublishValidation(
                    result.record.validation
                );
                setPublishSummary(result.record.summary);
                await loadPublishHistory();
            }
        } catch (error) {
            setPublishMessage(
                error instanceof Error
                    ? error.message
                    : "Could not publish approved corrections."
            );
        } finally {
            setPublishRunning(false);
        }
    };

    const updatePublishOption = (
        key: keyof typeof publishOptions,
        value: boolean
    ) => {
        setPublishOptions((current) => ({
            ...current,
            [key]: value,
        }));
        setPublishValidation(null);
        setPublishSummary(null);
    };

    const loadBatchTransactions = async () => {
        if (selectedDocumentId === null) return;

        try {
            const transactions =
                await window.ocrStudio.listBatchCorrectionTransactions({
                    projectPath,
                    documentId: selectedDocumentId,
                });

            setBatchTransactions(transactions);
        } catch {
            setBatchTransactions([]);
        }
    };

    const undoBatchTransaction = async (
        transaction: BatchCorrectionTransaction
    ) => {
        setBatchUndoLoadingId(transaction.id);
        setBatchMessage("");

        try {
            const result =
                await window.ocrStudio.undoBatchCorrection({
                    projectPath,
                    transactionId: transaction.id,
                });

            setBatchMessage(result.message);

            if (result.success) {
                await loadBatchTransactions();
                await loadCorrectionMemory();
                await loadBatchTransactions();
                void loadDocumentReviewQueue();
                void runDocumentSearch();

                if (
                    selectedDocumentId !== null &&
                    wordIndexPage
                ) {
                    const refreshed =
                        await window.ocrStudio.getWordIndexPage({
                            projectPath,
                            documentId: selectedDocumentId,
                            pageNumber:
                                wordIndexPage.pageNumber,
                        });

                    if (refreshed) {
                        setWordIndexPage(refreshed);
                    }
                }
            }
        } catch (error) {
            setBatchMessage(
                error instanceof Error
                    ? error.message
                    : "Could not undo the batch correction."
            );
        } finally {
            setBatchUndoLoadingId(null);
        }
    };

    const loadCorrectionRules = async () => {
        if (selectedDocumentId === null) return;

        try {
            const rules =
                await window.ocrStudio.listCorrectionRules({
                    projectPath,
                    documentId: selectedDocumentId,
                });

            setCorrectionRules(rules);
        } catch {
            setCorrectionRules([]);
        }
    };

    const saveCurrentCorrectionRule = async () => {
        if (
            selectedDocumentId === null ||
            !selectedWord ||
            !correctionDraft.trim()
        ) {
            setRuleMessage(
                "Select a word and enter corrected text first."
            );
            return;
        }

        try {
            const result =
                await window.ocrStudio.saveCorrectionRule({
                    projectPath,
                    documentId: selectedDocumentId,
                    sourceText: selectedWord.text,
                    correctedText: correctionDraft,
                    maxConfidence: batchMaxConfidence,
                });

            setRuleMessage(result.message);
            setCorrectionRules(
                result.rules.filter(
                    (rule) =>
                        Number(rule.documentId) ===
                        selectedDocumentId
                )
            );
        } catch (error) {
            setRuleMessage(
                error instanceof Error
                    ? error.message
                    : "Could not save the correction rule."
            );
        }
    };

    const toggleCorrectionRule = async (
        rule: CorrectionRule
    ) => {
        try {
            const result =
                await window.ocrStudio.toggleCorrectionRule({
                    projectPath,
                    ruleId: rule.id,
                    isEnabled: !rule.isEnabled,
                });

            setRuleMessage(result.message);
            setCorrectionRules(
                result.rules.filter(
                    (item) =>
                        Number(item.documentId) ===
                        selectedDocumentId
                )
            );
        } catch {
            setRuleMessage(
                "Could not update the correction rule."
            );
        }
    };

    const deleteCorrectionRule = async (
        rule: CorrectionRule
    ) => {
        if (selectedDocumentId === null) return;

        try {
            const result =
                await window.ocrStudio.deleteCorrectionRule({
                    projectPath,
                    documentId: selectedDocumentId,
                    ruleId: rule.id,
                });

            setRuleMessage(result.message);
            setCorrectionRules(result.rules);
        } catch {
            setRuleMessage(
                "Could not delete the correction rule."
            );
        }
    };

    const useCorrectionRule = (
        rule: CorrectionRule
    ) => {
        setCorrectionDraft(rule.correctedText);
        setBatchMaxConfidence(rule.maxConfidence);
        setRuleMessage(
            `Loaded rule “${rule.sourceText}” → “${rule.correctedText}”.`
        );

        if (rule.isEnabled) {
            void previewBatchCorrection(
                rule.sourceText,
                rule.correctedText
            );
        }
    };

    const loadCorrectionMemory = async () => {
        if (selectedDocumentId === null) return;

        try {
            const result =
                await window.ocrStudio.getCorrectionMemory({
                    projectPath,
                    documentId: selectedDocumentId,
                });

            setCorrectionMemory(result.memory);
        } catch {
            setCorrectionMemory([]);
        }
    };

    const previewBatchCorrection = async (
        sourceText = selectedWord?.text || "",
        targetText = correctionDraft
    ) => {
        if (
            selectedDocumentId === null ||
            !sourceText.trim() ||
            !targetText.trim()
        ) {
            setBatchMessage(
                "Select a word and enter corrected text first."
            );
            return;
        }

        setBatchPreviewLoading(true);
        setBatchMessage("");

        try {
            const result =
                await window.ocrStudio.previewBatchCorrection({
                    projectPath,
                    documentId: selectedDocumentId,
                    sourceText,
                    correctedText: targetText,
                    maxConfidence: batchMaxConfidence,
                });

            setBatchMatches(result.matches);
            setSelectedBatchMatchIds(
                new Set(
                    result.matches.map(
                        (match) =>
                            `${match.pageNumber}:${match.wordId}`
                    )
                )
            );
            setBatchMessage(result.message);
        } catch (error) {
            setBatchMatches([]);
            setSelectedBatchMatchIds(new Set());
            setBatchMessage(
                error instanceof Error
                    ? error.message
                    : "Could not preview matching occurrences."
            );
        } finally {
            setBatchPreviewLoading(false);
        }
    };

    const applyBatchCorrections = async () => {
        if (
            selectedDocumentId === null ||
            selectedBatchMatchIds.size === 0 ||
            !correctionDraft.trim()
        ) {
            setBatchMessage(
                "Select at least one matching occurrence."
            );
            return;
        }

        setBatchApplyLoading(true);
        setBatchMessage("");

        try {
            const selectedMatches = batchMatches
                .filter((match) =>
                    selectedBatchMatchIds.has(
                        `${match.pageNumber}:${match.wordId}`
                    )
                )
                .map((match) => ({
                    pageNumber: match.pageNumber,
                    wordId: match.wordId,
                }));

            const result =
                await window.ocrStudio.applyBatchCorrection({
                    projectPath,
                    documentId: selectedDocumentId,
                    correctedText: correctionDraft,
                    matches: selectedMatches,
                });

            setBatchMessage(result.message);

            if (result.success) {
                setBatchMatches([]);
                setSelectedBatchMatchIds(new Set());
                await loadCorrectionMemory();
                void loadDocumentReviewQueue();
                void runDocumentSearch();

                if (wordIndexPage) {
                    const refreshed =
                        await window.ocrStudio.getWordIndexPage({
                            projectPath,
                            documentId: selectedDocumentId,
                            pageNumber:
                                wordIndexPage.pageNumber,
                        });

                    if (refreshed) {
                        setWordIndexPage(refreshed);
                    }
                }
            }
        } catch (error) {
            setBatchMessage(
                error instanceof Error
                    ? error.message
                    : "Could not apply batch corrections."
            );
        } finally {
            setBatchApplyLoading(false);
        }
    };

    const toggleBatchMatch = (match: BatchCorrectionMatch) => {
        const key = `${match.pageNumber}:${match.wordId}`;

        setSelectedBatchMatchIds((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    const useCorrectionMemory = (
        memory: CorrectionMemoryItem
    ) => {
        setCorrectionDraft(memory.correctedText);
        setBatchMessage(
            `Loaded learned correction “${memory.sourceText}” → “${memory.correctedText}”.`
        );
        void previewBatchCorrection(
            memory.sourceText,
            memory.correctedText
        );
    };

    const generateIntelligentSuggestions = async () => {
        if (
            !selectedWord ||
            selectedDocumentId === null ||
            !wordIndexPage
        ) {
            return;
        }

        setSuggestionLoading(true);
        setSuggestionMessage("");

        try {
            const result =
                await window.ocrStudio.suggestWordCorrections({
                    projectPath,
                    documentId: selectedDocumentId,
                    pageNumber: wordIndexPage.pageNumber,
                    wordId: selectedWord.id,
                    limit: 8,
                });

            setIntelligentSuggestions(result.suggestions);
            setSuggestionContext(result.context);
            setSuggestionMessage(result.message);
        } catch (error) {
            setIntelligentSuggestions([]);
            setSuggestionContext([]);
            setSuggestionMessage(
                error instanceof Error
                    ? error.message
                    : "Could not generate correction suggestions."
            );
        } finally {
            setSuggestionLoading(false);
        }
    };

    const applyIntelligentSuggestion = (
        suggestion: IntelligentSuggestion
    ) => {
        setCorrectionDraft(suggestion.text);
        setWordReviewMessage(
            `Suggestion “${suggestion.text}” loaded. Review it, then save the correction.`
        );
    };

    const saveWordReview = async (
        action: "correct" | "verify" | "ignore" | "reset"
    ) => {
        if (
            !selectedWord ||
            selectedDocumentId === null ||
            !wordIndexPage
        ) {
            return;
        }

        setWordReviewSaving(true);
        setWordReviewMessage("");

        try {
            const result =
                await window.ocrStudio.updateWordIndexWord({
                    projectPath,
                    documentId: selectedDocumentId,
                    pageNumber: wordIndexPage.pageNumber,
                    wordId: selectedWord.id,
                    action,
                    correctedText: correctionDraft,
                });

            if (!result.success || !result.page) {
                setWordReviewMessage(result.message);
                return;
            }

            setWordIndexPage(result.page);
            setWordReviewMessage(result.message);

            const updatedWord = result.page.words.find(
                (word) => word.id === selectedWord.id
            );

            if (updatedWord) {
                setCorrectionDraft(
                    updatedWord.correctedText ||
                        updatedWord.text
                );
            }

            void loadDocumentReviewQueue();
            void loadCorrectionMemory();

            if (
                documentSearchResults.length > 0 ||
                documentSearchQuery.trim()
            ) {
                void runDocumentSearch();
            }
        } catch (error) {
            setWordReviewMessage(
                error instanceof Error
                    ? error.message
                    : "Could not save the word review."
            );
        } finally {
            setWordReviewSaving(false);
        }
    };

    const goToNextReviewWord = () => {
        if (!wordIndexPage || !selectedWord) return;

        const candidates = wordIndexPage.words
            .filter(
                (word) =>
                    word.status === "Unreviewed" &&
                    word.confidence < 60
            )
            .sort(
                (a, b) =>
                    a.confidence - b.confidence ||
                    a.lineNumber - b.lineNumber ||
                    a.wordNumber - b.wordNumber
            );

        if (candidates.length === 0) {
            setWordReviewMessage(
                "No additional low-confidence unreviewed words remain on this page."
            );
            return;
        }

        const currentIndex = candidates.findIndex(
            (word) => word.id === selectedWord.id
        );
        const next =
            candidates[
                currentIndex >= 0
                    ? (currentIndex + 1) %
                      candidates.length
                    : 0
            ];

        setSelectedWordId(next.id);
    };

    const nearbyWords = useMemo(() => {
        if (!selectedWord || !wordIndexPage) return [];

        const sameLine = wordIndexPage.words.filter(
            (word) =>
                word.blockNumber === selectedWord.blockNumber &&
                word.paragraphNumber ===
                    selectedWord.paragraphNumber &&
                word.lineNumber === selectedWord.lineNumber
        );

        const selectedIndex = sameLine.findIndex(
            (word) => word.id === selectedWord.id
        );

        return sameLine.slice(
            Math.max(0, selectedIndex - 3),
            selectedIndex + 4
        );
    }, [selectedWord, wordIndexPage]);

    const overlayWords = useMemo(() => {
        const words = wordIndexPage?.words || [];

        if (confidenceOverlayFilter === "poor") {
            return words.filter(
                (word) => word.confidence < 35
            );
        }

        if (confidenceOverlayFilter === "review") {
            return words.filter(
                (word) => word.confidence < 60
            );
        }

        return words;
    }, [wordIndexPage, confidenceOverlayFilter]);

    const selectOverlayWord = (wordId: string) => {
        setSelectedWordId(wordId);
        setWordFilter("all");
        setWordSearch("");

        window.setTimeout(() => {
            document
                .querySelector(".word-inspector")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }, 0);
    };

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

            <section className="collaborative-review-panel">
                <div className="collaborative-review-header">
                    <div>
                        <span className="eyebrow">
                            Collaborative review
                        </span>
                        <strong>
                            Reviewers, assignments, comments, and audit activity
                        </strong>
                        <small>
                            Coordinate document or page-range review while
                            preserving a complete local activity history.
                        </small>
                    </div>

                    <div>
                        <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                                void loadReviewCollaboration()
                            }
                        >
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                                void exportReviewCollaborationReport()
                            }
                        >
                            Export report
                        </button>
                    </div>
                </div>

                <div className="collaboration-summary-grid">
                    <article>
                        <span>Reviewers</span>
                        <strong>
                            {reviewCollaboration?.reviewers.filter(
                                (reviewer) => reviewer.isActive
                            ).length || 0}
                        </strong>
                        <small>active contributors</small>
                    </article>
                    <article>
                        <span>Assignments</span>
                        <strong>
                            {reviewCollaboration?.assignments.filter(
                                (assignment) =>
                                    assignment.status !== "Completed"
                            ).length || 0}
                        </strong>
                        <small>open assignments</small>
                    </article>
                    <article>
                        <span>Comments</span>
                        <strong>
                            {reviewCollaboration?.comments.filter(
                                (comment) =>
                                    comment.status === "Open"
                            ).length || 0}
                        </strong>
                        <small>unresolved discussions</small>
                    </article>
                    <article>
                        <span>Completed</span>
                        <strong>
                            {reviewCollaboration?.assignments.filter(
                                (assignment) =>
                                    assignment.status === "Completed"
                            ).length || 0}
                        </strong>
                        <small>review assignments</small>
                    </article>
                </div>

                <div className="collaboration-workspace-grid">
                    <div className="collaboration-card">
                        <div className="collaboration-card-header">
                            <strong>Review team</strong>
                            <small>Add local reviewers and roles</small>
                        </div>

                        <div className="collaboration-form-row">
                            <input
                                value={reviewerName}
                                placeholder="Reviewer name"
                                onChange={(event) =>
                                    setReviewerName(
                                        event.target.value
                                    )
                                }
                            />
                            <select
                                value={reviewerRole}
                                onChange={(event) =>
                                    setReviewerRole(
                                        event.target.value
                                    )
                                }
                            >
                                <option>Reviewer</option>
                                <option>Senior Reviewer</option>
                                <option>Language Expert</option>
                                <option>Editor</option>
                                <option>Administrator</option>
                            </select>
                            <button
                                type="button"
                                className="small-button primary"
                                onClick={() =>
                                    void addReviewCollaborator()
                                }
                            >
                                Add reviewer
                            </button>
                        </div>

                        <div className="reviewer-list">
                            {reviewCollaboration?.reviewers.map(
                                (reviewer) => (
                                    <article key={reviewer.id}>
                                        <div>
                                            <strong>
                                                {reviewer.name}
                                            </strong>
                                            <small>
                                                {reviewer.role} ·{" "}
                                                {reviewer.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            className="small-button"
                                            onClick={() =>
                                                void toggleReviewCollaborator(
                                                    reviewer.id
                                                )
                                            }
                                        >
                                            {reviewer.isActive
                                                ? "Deactivate"
                                                : "Activate"}
                                        </button>
                                    </article>
                                )
                            )}
                        </div>
                    </div>

                    <div className="collaboration-card">
                        <div className="collaboration-card-header">
                            <strong>Create assignment</strong>
                            <small>
                                Assign the selected document or page range
                            </small>
                        </div>

                        <div className="assignment-form-grid">
                            <select
                                value={assignmentReviewerId}
                                onChange={(event) =>
                                    setAssignmentReviewerId(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="">
                                    Select reviewer
                                </option>
                                {reviewCollaboration?.reviewers
                                    .filter(
                                        (reviewer) =>
                                            reviewer.isActive
                                    )
                                    .map((reviewer) => (
                                        <option
                                            key={reviewer.id}
                                            value={reviewer.id}
                                        >
                                            {reviewer.name} —{" "}
                                            {reviewer.role}
                                        </option>
                                    ))}
                            </select>

                            <select
                                value={assignmentScope}
                                onChange={(event) =>
                                    setAssignmentScope(
                                        event.target.value as
                                            | "document"
                                            | "pages"
                                    )
                                }
                            >
                                <option value="document">
                                    Entire document
                                </option>
                                <option value="pages">
                                    Page range
                                </option>
                            </select>

                            <select
                                value={assignmentPriority}
                                onChange={(event) =>
                                    setAssignmentPriority(
                                        event.target.value
                                    )
                                }
                            >
                                <option>Low</option>
                                <option>Normal</option>
                                <option>High</option>
                                <option>Urgent</option>
                            </select>

                            {assignmentScope === "pages" && (
                                <>
                                    <input
                                        type="number"
                                        min={1}
                                        value={assignmentPageStart}
                                        onChange={(event) =>
                                            setAssignmentPageStart(
                                                Math.max(
                                                    1,
                                                    Number(
                                                        event.target.value
                                                    )
                                                )
                                            )
                                        }
                                        placeholder="Start page"
                                    />
                                    <input
                                        type="number"
                                        min={assignmentPageStart}
                                        value={assignmentPageEnd}
                                        onChange={(event) =>
                                            setAssignmentPageEnd(
                                                Math.max(
                                                    assignmentPageStart,
                                                    Number(
                                                        event.target.value
                                                    )
                                                )
                                            )
                                        }
                                        placeholder="End page"
                                    />
                                </>
                            )}

                            <input
                                value={assignmentNote}
                                placeholder="Assignment instructions"
                                onChange={(event) =>
                                    setAssignmentNote(
                                        event.target.value
                                    )
                                }
                            />

                            <button
                                type="button"
                                className="small-button primary"
                                onClick={() =>
                                    void createReviewAssignment()
                                }
                            >
                                Assign review
                            </button>
                        </div>
                    </div>
                </div>

                <div className="collaboration-lists-grid">
                    <div className="collaboration-card">
                        <div className="collaboration-card-header">
                            <strong>Assignments</strong>
                            <small>Track review progress</small>
                        </div>

                        <div className="assignment-list">
                            {reviewCollaboration?.assignments
                                .slice()
                                .reverse()
                                .map((assignment) => (
                                    <article key={assignment.id}>
                                        <div>
                                            <strong>
                                                {assignment.documentName}
                                            </strong>
                                            <small>
                                                {assignment.reviewerName} ·{" "}
                                                {assignment.scope ===
                                                "pages"
                                                    ? `Pages ${assignment.pageStart}-${assignment.pageEnd}`
                                                    : "Entire document"}{" "}
                                                · {assignment.priority}
                                            </small>
                                            {assignment.note && (
                                                <p>
                                                    {assignment.note}
                                                </p>
                                            )}
                                        </div>

                                        <select
                                            value={assignment.status}
                                            onChange={(event) =>
                                                void updateReviewAssignment(
                                                    assignment.id,
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <option>Assigned</option>
                                            <option>In Progress</option>
                                            <option>Blocked</option>
                                            <option>Completed</option>
                                        </select>
                                    </article>
                                ))}
                        </div>
                    </div>

                    <div className="collaboration-card">
                        <div className="collaboration-card-header">
                            <strong>Review comments</strong>
                            <small>
                                Current page {sharedPage}
                                {selectedWordId
                                    ? ` · Word ${selectedWordId}`
                                    : ""}
                            </small>
                        </div>

                        <div className="comment-compose">
                            <input
                                value={commentAuthor}
                                placeholder="Your name"
                                onChange={(event) =>
                                    setCommentAuthor(
                                        event.target.value
                                    )
                                }
                            />
                            <textarea
                                value={reviewCommentText}
                                placeholder="Add a review comment..."
                                onChange={(event) =>
                                    setReviewCommentText(
                                        event.target.value
                                    )
                                }
                            />
                            <button
                                type="button"
                                className="small-button primary"
                                onClick={() =>
                                    void addReviewComment()
                                }
                            >
                                Add comment
                            </button>
                        </div>

                        <div className="review-comment-list">
                            {reviewCollaboration?.comments
                                .filter(
                                    (comment) =>
                                        selectedDocumentId === null ||
                                        comment.documentId ===
                                            selectedDocumentId
                                )
                                .slice()
                                .reverse()
                                .map((comment) => (
                                    <article
                                        key={comment.id}
                                        className={
                                            comment.status ===
                                            "Resolved"
                                                ? "resolved"
                                                : ""
                                        }
                                    >
                                        <div>
                                            <strong>
                                                {comment.author}
                                            </strong>
                                            <small>
                                                Page{" "}
                                                {comment.pageNumber ||
                                                    "Document"}
                                                {comment.wordId
                                                    ? ` · ${comment.wordId}`
                                                    : ""}{" "}
                                                ·{" "}
                                                {new Date(
                                                    comment.createdAt
                                                ).toLocaleString()}
                                            </small>
                                            <p>{comment.text}</p>
                                        </div>

                                        <button
                                            type="button"
                                            className="small-button"
                                            onClick={() =>
                                                void resolveReviewComment(
                                                    comment.id
                                                )
                                            }
                                        >
                                            {comment.status ===
                                            "Resolved"
                                                ? "Reopen"
                                                : "Resolve"}
                                        </button>
                                    </article>
                                ))}
                        </div>
                    </div>
                </div>

                {reviewCollaboration?.activity.length ? (
                    <div className="collaboration-activity">
                        <strong>Recent review activity</strong>
                        {reviewCollaboration.activity
                            .slice(-8)
                            .reverse()
                            .map((activity) => (
                                <article key={activity.id}>
                                    <span>{activity.details}</span>
                                    <small>
                                        {new Date(
                                            activity.createdAt
                                        ).toLocaleString()}
                                    </small>
                                </article>
                            ))}
                    </div>
                ) : null}

                {reviewCollaborationMessage && (
                    <div className="collaboration-message">
                        {reviewCollaborationMessage}
                    </div>
                )}

                {reviewCollaborationReportPath && (
                    <div className="collaboration-report-result">
                        <span>
                            Collaborative review report is ready.
                        </span>
                        <button
                            type="button"
                            className="small-button primary"
                            onClick={() =>
                                onOpen(
                                    reviewCollaborationReportPath
                                )
                            }
                        >
                            Open report
                        </button>
                    </div>
                )}
            </section>

            <section className="publish-corrections-panel">
                <div className="publish-panel-header">
                    <div>
                        <span className="eyebrow">
                            Publish approved corrections
                        </span>
                        <strong>
                            Create a versioned publication bundle
                        </strong>
                        <small>
                            Export corrected OCR text, structured word
                            data, and a complete validation report.
                        </small>
                    </div>

                    <div className="publish-header-actions">
                        <button
                            type="button"
                            className="small-button"
                            disabled={
                                publishValidating ||
                                selectedDocumentId === null
                            }
                            onClick={() =>
                                void validatePublication()
                            }
                        >
                            {publishValidating
                                ? "Validating..."
                                : "Validate"}
                        </button>

                        <button
                            type="button"
                            className="small-button"
                            disabled={
                                selectedDocumentId === null
                            }
                            onClick={() =>
                                void loadPublishHistory()
                            }
                        >
                            Load history
                        </button>

                        <button
                            type="button"
                            className="small-button"
                            disabled={
                                searchablePdfRunning ||
                                selectedDocumentId === null
                            }
                            onClick={() =>
                                void publishCorrectedSearchablePdf()
                            }
                        >
                            {searchablePdfRunning
                                ? "Building PDF..."
                                : "Build searchable PDF"}
                        </button>

                        <button
                            type="button"
                            className="small-button primary"
                            disabled={
                                publishRunning ||
                                selectedDocumentId === null
                            }
                            onClick={() =>
                                void publishApprovedCorrections()
                            }
                        >
                            {publishRunning
                                ? "Publishing..."
                                : "Publish version"}
                        </button>
                    </div>
                </div>

                <div className="publish-options-grid">
                    <fieldset>
                        <legend>Word inclusion</legend>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.includeCorrected
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "includeCorrected",
                                        event.target.checked
                                    )
                                }
                            />
                            Corrected words
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.includeVerified
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "includeVerified",
                                        event.target.checked
                                    )
                                }
                            />
                            Verified words
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.includeUnreviewed
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "includeUnreviewed",
                                        event.target.checked
                                    )
                                }
                            />
                            Unreviewed OCR words
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.includeIgnored
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "includeIgnored",
                                        event.target.checked
                                    )
                                }
                            />
                            Ignored words
                        </label>
                    </fieldset>

                    <fieldset>
                        <legend>Export formats</legend>

                        <label>
                            <input
                                type="checkbox"
                                checked={publishOptions.exportTxt}
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportTxt",
                                        event.target.checked
                                    )
                                }
                            />
                            Clean corrected TXT
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.exportJson
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportJson",
                                        event.target.checked
                                    )
                                }
                            />
                            Structured JSON
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={publishOptions.exportCsv}
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportCsv",
                                        event.target.checked
                                    )
                                }
                            />
                            Word-level CSV
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.exportHtml
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportHtml",
                                        event.target.checked
                                    )
                                }
                            />
                            Readable HTML
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={publishOptions.exportTsv}
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportTsv",
                                        event.target.checked
                                    )
                                }
                            />
                            Word-level TSV
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.exportMarkdown
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportMarkdown",
                                        event.target.checked
                                    )
                                }
                            />
                            Markdown
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={publishOptions.exportHocr}
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportHocr",
                                        event.target.checked
                                    )
                                }
                            />
                            hOCR
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={publishOptions.exportAlto}
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportAlto",
                                        event.target.checked
                                    )
                                }
                            />
                            ALTO XML
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.exportPageXml
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "exportPageXml",
                                        event.target.checked
                                    )
                                }
                            />
                            PAGE XML
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={
                                    publishOptions.incrementalPublishing
                                }
                                onChange={(event) =>
                                    updatePublishOption(
                                        "incrementalPublishing",
                                        event.target.checked
                                    )
                                }
                            />
                            Changed pages only
                        </label>
                    </fieldset>
                </div>

                <div className="publication-profiles-panel">
                    <div className="publication-section-header">
                        <div>
                            <span>Publication profiles</span>
                            <strong>
                                Save and reuse export presets
                            </strong>
                        </div>

                        <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                                void loadPublicationProfiles()
                            }
                        >
                            Load profiles
                        </button>
                    </div>

                    <div className="publication-profile-create">
                        <input
                            value={publicationProfileName}
                            placeholder="Profile name, for example Archive"
                            onChange={(event) =>
                                setPublicationProfileName(
                                    event.target.value
                                )
                            }
                        />
                        <button
                            type="button"
                            className="small-button primary"
                            onClick={() =>
                                void savePublicationProfile()
                            }
                        >
                            Save current options
                        </button>
                    </div>

                    {publicationProfiles.length > 0 && (
                        <div className="publication-profile-list">
                            {publicationProfiles.map((profile) => (
                                <article
                                    key={profile.id}
                                    className={
                                        selectedPublicationProfileId ===
                                        profile.id
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    <button
                                        type="button"
                                        className="profile-main"
                                        onClick={() =>
                                            applyPublicationProfile(
                                                profile
                                            )
                                        }
                                    >
                                        <strong>{profile.name}</strong>
                                        <small>
                                            {
                                                Object.values(
                                                    profile.options
                                                ).filter(Boolean).length
                                            }{" "}
                                            enabled option(s)
                                        </small>
                                    </button>

                                    <button
                                        type="button"
                                        className="small-button danger"
                                        onClick={() =>
                                            void deletePublicationProfile(
                                                profile.id
                                            )
                                        }
                                    >
                                        Delete
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                <div className="publication-queue-panel">
                    <div className="publication-section-header">
                        <div>
                            <span>Publishing queue</span>
                            <strong>
                                Publish multiple indexed documents
                            </strong>
                        </div>

                        <div>
                            <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                    void loadPublicationQueue()
                                }
                            >
                                Refresh queue
                            </button>
                            <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                    void resumePublicationQueue()
                                }
                            >
                                Resume queue
                            </button>
                        </div>
                    </div>

                    <div className="publishing-dashboard">
                        <div className="publishing-dashboard-header">
                            <div>
                                <span className="eyebrow">
                                    Publishing dashboard
                                </span>
                                <strong>
                                    Queue health and production analytics
                                </strong>
                                <small>
                                    Auto-refreshes every three seconds and
                                    self-recovers stalled queued jobs.
                                </small>
                            </div>

                            <div>
                                <span
                                    className={`queue-engine-status ${(
                                        publicationDashboard?.engineStatus ||
                                        "Idle"
                                    ).toLowerCase()}`}
                                >
                                    Queue Engine:{" "}
                                    {publicationDashboard?.engineStatus ||
                                        "Idle"}
                                </span>

                                <button
                                    type="button"
                                    className="small-button"
                                    disabled={
                                        publicationDashboardLoading
                                    }
                                    onClick={() =>
                                        void loadPublicationDashboard()
                                    }
                                >
                                    {publicationDashboardLoading
                                        ? "Refreshing..."
                                        : "Refresh analytics"}
                                </button>

                                <button
                                    type="button"
                                    className="small-button"
                                    onClick={() =>
                                        void exportPublicationAuditLog()
                                    }
                                >
                                    Export audit log
                                </button>
                            </div>
                        </div>

                        {publicationDashboard && (
                            <>
                                <div className="publishing-kpi-grid">
                                    <article>
                                        <span>Running</span>
                                        <strong>
                                            {
                                                publicationDashboard.counts
                                                    .running
                                            }
                                        </strong>
                                        <small>
                                            {
                                                publicationDashboard
                                                    .workerUtilizationPercent
                                            }
                                            % worker utilization
                                        </small>
                                    </article>

                                    <article>
                                        <span>Queued</span>
                                        <strong>
                                            {
                                                publicationDashboard.counts
                                                    .queued
                                            }
                                        </strong>
                                        <small>
                                            ETA{" "}
                                            {formatDuration(
                                                publicationDashboard
                                                    .estimatedRemainingMs
                                            )}
                                        </small>
                                    </article>

                                    <article>
                                        <span>Completed</span>
                                        <strong>
                                            {
                                                publicationDashboard.counts
                                                    .completed
                                            }
                                        </strong>
                                        <small>
                                            {
                                                publicationDashboard
                                                    .recentCompleted
                                            }{" "}
                                            in the last 24 hours
                                        </small>
                                    </article>

                                    <article>
                                        <span>Failed</span>
                                        <strong>
                                            {
                                                publicationDashboard.counts
                                                    .failed
                                            }
                                        </strong>
                                        <small>
                                            {
                                                publicationDashboard.counts
                                                    .cancelled
                                            }{" "}
                                            cancelled
                                        </small>
                                    </article>

                                    <article>
                                        <span>Average job</span>
                                        <strong>
                                            {formatDuration(
                                                publicationDashboard
                                                    .averageDurationMs
                                            )}
                                        </strong>
                                        <small>
                                            based on completed jobs
                                        </small>
                                    </article>

                                    <article>
                                        <span>Generated</span>
                                        <strong>
                                            {
                                                publicationDashboard
                                                    .totalGeneratedFiles
                                            }
                                        </strong>
                                        <small>
                                            {formatFileSize(
                                                publicationDashboard
                                                    .totalGeneratedBytes
                                            )}{" "}
                                            on disk
                                        </small>
                                    </article>

                                    <article>
                                        <span>Changed pages</span>
                                        <strong>
                                            {
                                                publicationDashboard
                                                    .totalChangedPages
                                            }
                                        </strong>
                                        <small>
                                            incremental publications
                                        </small>
                                    </article>

                                    <article>
                                        <span>Skipped pages</span>
                                        <strong>
                                            {
                                                publicationDashboard
                                                    .totalUnchangedPages
                                            }
                                        </strong>
                                        <small>
                                            unchanged pages reused
                                        </small>
                                    </article>
                                </div>

                                <div className="worker-utilization-meter">
                                    <div>
                                        <span>Worker utilization</span>
                                        <strong>
                                            {
                                                publicationDashboard
                                                    .workerUtilizationPercent
                                            }
                                            %
                                        </strong>
                                    </div>
                                    <div className="worker-meter-track">
                                        <span
                                            style={{
                                                width: `${publicationDashboard.workerUtilizationPercent}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {publicationDashboard.recentJobs.length >
                                    0 && (
                                    <div className="publishing-recent-jobs">
                                        <strong>Recent activity</strong>

                                        {publicationDashboard.recentJobs
                                            .slice(0, 8)
                                            .map((job) => (
                                                <article key={job.id}>
                                                    <div>
                                                        <strong>
                                                            {
                                                                job.documentName
                                                            }
                                                        </strong>
                                                        <small>
                                                            {job.status} ·{" "}
                                                            {job.files} file(s)
                                                        </small>
                                                    </div>

                                                    <span>
                                                        {job.status ===
                                                        "Completed"
                                                            ? formatDuration(
                                                                  job.durationMs
                                                              )
                                                            : `${job.progress}%`}
                                                    </span>
                                                </article>
                                            ))}
                                    </div>
                                )}
                            </>
                        )}

                        {publicationAuditPath && (
                            <div className="audit-export-result">
                                <span>
                                    Comprehensive publishing audit is ready.
                                </span>
                                <button
                                    type="button"
                                    className="small-button primary"
                                    onClick={() =>
                                        onOpen(publicationAuditPath)
                                    }
                                >
                                    Open audit log
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="publication-performance-controls">
                        <div>
                            <label htmlFor="publication-workers">
                                Parallel workers
                            </label>
                            <select
                                id="publication-workers"
                                value={publicationWorkerCount}
                                onChange={(event) =>
                                    void updatePublicationWorkers(
                                        Number(event.target.value)
                                    )
                                }
                            >
                                <option value={1}>1 worker</option>
                                <option value={2}>2 workers</option>
                                <option value={3}>3 workers</option>
                                <option value={4}>4 workers</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            className={
                                publicationQueuePaused
                                    ? "small-button primary"
                                    : "small-button"
                            }
                            onClick={() =>
                                void togglePublicationPause()
                            }
                        >
                            {publicationQueuePaused
                                ? "Resume processing"
                                : "Pause after active jobs"}
                        </button>

                        <button
                            type="button"
                            className="small-button"
                            disabled={
                                selectedDocumentId === null
                            }
                            onClick={() =>
                                void previewIncrementalPublication()
                            }
                        >
                            Preview changed pages
                        </button>

                        <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                                void loadPublicationSettings()
                            }
                        >
                            Load settings
                        </button>
                    </div>

                    {incrementalPreview && (
                        <div className="incremental-preview-card">
                            <div>
                                <span>Changed</span>
                                <strong>
                                    {
                                        incrementalPreview
                                            .changedPageNumbers.length
                                    }
                                </strong>
                            </div>
                            <div>
                                <span>Unchanged</span>
                                <strong>
                                    {
                                        incrementalPreview
                                            .unchangedPageNumbers.length
                                    }
                                </strong>
                            </div>
                            <div>
                                <span>Total</span>
                                <strong>
                                    {incrementalPreview.totalPages}
                                </strong>
                            </div>
                            <small>
                                {incrementalPreview.hasPreviousSnapshot
                                    ? `Compared with ${
                                          incrementalPreview.previousPublishedAt
                                              ? new Date(
                                                    incrementalPreview.previousPublishedAt
                                                ).toLocaleString()
                                              : "the previous publication"
                                      }.`
                                    : "No prior snapshot: every page will be exported."}
                            </small>
                        </div>
                    )}

                    <div className="queue-document-picker">
                        {reviewableDocuments.map((document) => (
                            <label key={document.id}>
                                <input
                                    type="checkbox"
                                    checked={selectedQueueDocumentIds.has(
                                        document.id
                                    )}
                                    onChange={() =>
                                        toggleQueueDocument(
                                            document.id
                                        )
                                    }
                                />
                                <span>
                                    {document.fileName ||
                                        `Document ${document.id}`}
                                </span>
                            </label>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="small-button primary"
                        disabled={publicationQueueLoading}
                        onClick={() =>
                            void enqueuePublicationJobs()
                        }
                    >
                        {publicationQueueLoading
                            ? "Adding..."
                            : `Add ${selectedQueueDocumentIds.size || ""} to queue`}
                    </button>

                    {publicationQueueMessage && (
                        <div className="publication-queue-message">
                            {publicationQueueMessage}
                        </div>
                    )}

                    {publicationQueue.length > 0 && (
                        <div className="publication-queue-list">
                            {publicationQueue.map((job) => (
                                <article key={job.id}>
                                    <div className="queue-job-main">
                                        <div>
                                            <strong>
                                                {job.documentName}
                                            </strong>
                                            <small>
                                                {job.profileName ||
                                                    "Custom options"}{" "}
                                                · {job.status}
                                            </small>
                                        </div>

                                        <div className="queue-progress-track">
                                            <span
                                                style={{
                                                    width: `${Math.max(
                                                        0,
                                                        Math.min(
                                                            100,
                                                            job.progress
                                                        )
                                                    )}%`,
                                                }}
                                            />
                                        </div>

                                        <small>{job.message}</small>

                                        {job.incremental && (
                                            <small>
                                                Incremental:{" "}
                                                {
                                                    job.incremental
                                                        .changedPageNumbers
                                                        .length
                                                }{" "}
                                                changed ·{" "}
                                                {
                                                    job.incremental
                                                        .unchangedPageNumbers
                                                        .length
                                                }{" "}
                                                unchanged
                                            </small>
                                        )}

                                        {job.error && (
                                            <em>{job.error}</em>
                                        )}
                                    </div>

                                    <div className="queue-job-actions">
                                        {job.status === "Completed" &&
                                            job.folderPath && (
                                                <button
                                                    type="button"
                                                    className="small-button"
                                                    onClick={() =>
                                                        onOpen(
                                                            job.folderPath!
                                                        )
                                                    }
                                                >
                                                    Open
                                                </button>
                                            )}

                                        {(job.status === "Failed" ||
                                            job.status ===
                                                "Cancelled") && (
                                            <button
                                                type="button"
                                                className="small-button"
                                                onClick={() =>
                                                    void retryPublicationJob(
                                                        job.id
                                                    )
                                                }
                                            >
                                                Retry
                                            </button>
                                        )}

                                        {(job.status === "Queued" ||
                                            job.status ===
                                                "Running") && (
                                            <button
                                                type="button"
                                                className="small-button danger"
                                                onClick={() =>
                                                    void cancelPublicationJob(
                                                        job.id
                                                    )
                                                }
                                            >
                                                Cancel
                                            </button>
                                        )}

                                        {job.status !== "Running" && (
                                            <button
                                                type="button"
                                                className="small-button danger"
                                                onClick={() =>
                                                    void removePublicationJob(
                                                        job.id
                                                    )
                                                }
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                {publishMessage && (
                    <div className="publish-message">
                        {publishMessage}
                    </div>
                )}
                {searchablePdfPath && (
                    <div className="searchable-pdf-result">
                        <div>
                            <strong>
                                Corrected searchable PDF ready
                            </strong>
                            <small>
                                The original page appearance is retained
                                with a new invisible Unicode text layer.
                            </small>
                        </div>

                        <button
                            type="button"
                            className="small-button primary"
                            onClick={() =>
                                onOpen(searchablePdfPath)
                            }
                        >
                            Open PDF
                        </button>
                    </div>
                )}

                {publishSummary && publishValidation && (
                    <div className="publish-summary-grid">
                        <article>
                            <span>Pages</span>
                            <strong>
                                {publishSummary.pages}
                            </strong>
                        </article>
                        <article>
                            <span>Published words</span>
                            <strong>
                                {publishSummary.publishedWords}
                            </strong>
                        </article>
                        <article>
                            <span>Corrected</span>
                            <strong>
                                {publishSummary.corrected}
                            </strong>
                        </article>
                        <article>
                            <span>Verified</span>
                            <strong>
                                {publishSummary.verified}
                            </strong>
                        </article>
                        <article>
                            <span>Unreviewed</span>
                            <strong>
                                {publishSummary.unreviewed}
                            </strong>
                        </article>
                        <article
                            className={
                                publishValidation.valid
                                    ? "valid"
                                    : "warning"
                            }
                        >
                            <span>Validation</span>
                            <strong>
                                {publishValidation.valid
                                    ? "Passed"
                                    : "Review"}
                            </strong>
                        </article>
                    </div>
                )}

                {publishValidation &&
                    !publishValidation.valid && (
                        <div className="publish-validation-issues">
                            <strong>
                                Validation findings
                            </strong>
                            <span>
                                Missing pages:{" "}
                                {
                                    publishValidation
                                        .missingPages.length
                                }
                            </span>
                            <span>
                                Empty pages:{" "}
                                {
                                    publishValidation
                                        .emptyPages.length
                                }
                            </span>
                            <span>
                                Malformed words:{" "}
                                {
                                    publishValidation
                                        .malformedWords
                                }
                            </span>
                            <span>
                                Invalid boxes:{" "}
                                {
                                    publishValidation
                                        .invalidBoxes
                                }
                            </span>
                            <span>
                                Duplicate IDs:{" "}
                                {
                                    publishValidation
                                        .duplicateWordIds
                                }
                            </span>
                        </div>
                    )}

                {publishHistory.length > 0 && (
                    <div className="publish-history">
                        <div>
                            <strong>Publication history</strong>
                            <span>
                                {publishHistory.length} version(s)
                            </span>
                        </div>

                        <div className="publish-history-list">
                            {publishHistory.map((record) => (
                                <article key={record.id}>
                                    <div>
                                        <strong>
                                            Version {record.version}
                                        </strong>
                                        <small>
                                            {new Date(
                                                record.publishedAt
                                            ).toLocaleString()}
                                        </small>
                                    </div>

                                    <div>
                                        <span>
                                            {
                                                record.summary
                                                    .publishedWords
                                            }{" "}
                                            words
                                        </span>
                                        <span>
                                            {
                                                record.summary
                                                    .corrected
                                            }{" "}
                                            corrected
                                        </span>
                                        <span>
                                            {record.files.length}{" "}
                                            files
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className="small-button"
                                        onClick={() =>
                                            onOpen(
                                                record.folderPath
                                            )
                                        }
                                    >
                                        Open folder
                                    </button>
                                </article>
                            ))}
                        </div>
                    </div>
                )}

                <small className="publish-storage-note">
                    Versions are stored under Export/Published.
                    Publication never modifies the OCR source or word
                    database.
                </small>
            </section>

            <section className="document-word-review">
                <div className="document-word-review-header">
                    <div>
                        <span className="eyebrow">
                            Document-wide word review
                        </span>
                        <strong>
                            Search every indexed page
                        </strong>
                        <small>
                            Find words throughout the PDF or build a
                            low-confidence review queue.
                        </small>
                    </div>

                    <button
                        type="button"
                        className="small-button"
                        disabled={
                            reviewQueueLoading ||
                            selectedDocumentId === null
                        }
                        onClick={() =>
                            void loadDocumentReviewQueue()
                        }
                    >
                        {reviewQueueLoading
                            ? "Loading queue..."
                            : "Load review queue"}
                    </button>
                </div>

                <div className="document-search-controls">
                    <input
                        type="search"
                        placeholder="Search all indexed pages"
                        value={documentSearchQuery}
                        onChange={(event) =>
                            setDocumentSearchQuery(
                                event.target.value
                            )
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void runDocumentSearch();
                            }
                        }}
                    />

                    <select
                        value={documentSearchMode}
                        onChange={(event) =>
                            setDocumentSearchMode(
                                event.target.value as
                                    | "all"
                                    | "review"
                                    | "poor"
                                    | "unreviewed"
                            )
                        }
                    >
                        <option value="all">
                            All indexed words
                        </option>
                        <option value="review">
                            Confidence below 60%
                        </option>
                        <option value="poor">
                            Confidence below 35%
                        </option>
                        <option value="unreviewed">
                            Unreviewed words
                        </option>
                    </select>

                    <button
                        type="button"
                        className="small-button primary"
                        disabled={
                            documentSearchLoading ||
                            selectedDocumentId === null
                        }
                        onClick={() =>
                            void runDocumentSearch()
                        }
                    >
                        {documentSearchLoading
                            ? "Searching..."
                            : "Search document"}
                    </button>
                </div>

                {(documentSearchMessage ||
                    documentSearchResults.length > 0) && (
                    <div className="document-search-status">
                        <span>
                            {documentSearchMessage ||
                                `${documentSearchTotal} result(s)`}
                        </span>
                        {documentSearchTruncated && (
                            <strong>
                                Showing first{" "}
                                {
                                    documentSearchResults.length
                                }
                            </strong>
                        )}
                    </div>
                )}

                {documentSearchResults.length > 0 && (
                    <div className="document-word-results">
                        {documentSearchResults.map((result) => (
                            <button
                                type="button"
                                key={`search-${result.pageNumber}-${result.id}`}
                                onClick={() =>
                                    openDocumentWord(result)
                                }
                            >
                                <span className="document-word-result-text">
                                    <strong>
                                        {result.correctedText ||
                                            result.text}
                                    </strong>
                                    {result.correctedText && (
                                        <small>
                                            OCR: {result.text}
                                        </small>
                                    )}
                                </span>

                                <span className="document-word-result-meta">
                                    <em>
                                        Page {result.pageNumber}
                                    </em>
                                    <em>
                                        {result.confidence.toFixed(
                                            1
                                        )}
                                        %
                                    </em>
                                    <em>{result.status}</em>
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {reviewQueueTotal > 0 && (
                    <div className="document-review-queue">
                        <div>
                            <strong>
                                Low-confidence review queue
                            </strong>
                            <span>
                                {reviewQueueTotal} unreviewed
                                issue(s) across indexed pages
                            </span>
                        </div>

                        <div className="review-queue-chips">
                            {reviewQueue
                                .slice(0, 40)
                                .map((result) => (
                                    <button
                                        type="button"
                                        key={`queue-${result.pageNumber}-${result.id}`}
                                        onClick={() =>
                                            openDocumentWord(
                                                result
                                            )
                                        }
                                        title={`Page ${result.pageNumber} — ${result.confidence.toFixed(
                                            1
                                        )}%`}
                                    >
                                        <span>
                                            {result.correctedText ||
                                                result.text}
                                        </span>
                                        <small>
                                            p.{result.pageNumber}
                                        </small>
                                    </button>
                                ))}
                        </div>

                        {reviewQueue.length > 40 && (
                            <small>
                                Showing the first 40 highest-priority
                                issues. Use document search for the
                                complete loaded result set.
                            </small>
                        )}
                    </div>
                )}
            </section>

            <section className="word-inspector">
                <div className="word-inspector-header">
                    <div>
                        <span className="eyebrow">
                            Interactive word inspector
                        </span>
                        <strong>
                            Page {currentReviewPage}
                        </strong>
                        <small>
                            {wordIndexPage
                                ? wordSearch.trim()
                                    ? `${visibleWords.length} search result(s) on this indexed page`
                                    : `${wordIndexPage.summary.totalWords} words, ${wordIndexPage.summary.lowConfidenceWords} needing review`
                                : wordInspectorMessage}
                        </small>
                    </div>

                    <div className="word-inspector-filters">
                        <input
                            type="search"
                            placeholder="Search current indexed page"
                            value={wordSearch}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                setWordSearch(nextValue);

                                // Show an immediate result when pasted text
                                // matches a high-confidence word that would
                                // otherwise be hidden by the default filter.
                                if (nextValue.trim()) {
                                    setWordFilter("all");
                                }
                            }}
                        />

                        <select
                            value={wordFilter}
                            onChange={(event) =>
                                setWordFilter(
                                    event.target.value as
                                        | "all"
                                        | "review"
                                        | "poor"
                                )
                            }
                        >
                            <option value="all">All words</option>
                            <option value="review">
                                Below 60%
                            </option>
                            <option value="poor">
                                Below 35%
                            </option>
                        </select>
                    </div>
                </div>

                {wordIndexPage && (
                    <div className="word-review-summary">
                        <div>
                            <span>Unreviewed</span>
                            <strong>
                                {reviewSummary.unreviewed}
                            </strong>
                        </div>
                        <div>
                            <span>Verified</span>
                            <strong>
                                {reviewSummary.verified}
                            </strong>
                        </div>
                        <div>
                            <span>Corrected</span>
                            <strong>
                                {reviewSummary.corrected}
                            </strong>
                        </div>
                        <div>
                            <span>Ignored</span>
                            <strong>
                                {reviewSummary.ignored}
                            </strong>
                        </div>
                    </div>
                )}

                {wordInspectorLoading && (
                    <div className="inline-message">
                        Loading word data for page{" "}
                        {currentReviewPage}...
                    </div>
                )}

                {!wordInspectorLoading &&
                    wordIndexPage &&
                    visibleWords.length === 0 && (
                        <div className="pdf-empty">
                            {wordSearch.trim()
                                ? `No indexed word matching “${wordSearch.trim()}” was found on page ${currentReviewPage}. Search currently applies to the active page only.`
                                : "No words match the selected confidence filter."}
                        </div>
                    )}

                {wordIndexPage && visibleWords.length > 0 && (
                    <div className="word-inspector-layout">
                        <div className="word-list">
                            {visibleWords.map((word) => (
                                <button
                                    type="button"
                                    key={word.id}
                                    className={
                                        selectedWordId === word.id
                                            ? "selected"
                                            : ""
                                    }
                                    onClick={() =>
                                        setSelectedWordId(word.id)
                                    }
                                >
                                    <span>
                                        {word.correctedText ||
                                            word.text}
                                        {word.correctedText && (
                                            <small>
                                                original: {word.text}
                                            </small>
                                        )}
                                    </span>
                                    <div className="word-list-metadata">
                                        <em
                                            className={`word-status ${word.status.toLowerCase()}`}
                                        >
                                            {word.status}
                                        </em>
                                    <strong
                                        className={
                                            word.confidence >= 85
                                                ? "excellent"
                                                : word.confidence >= 75
                                                  ? "good"
                                                  : word.confidence >= 60
                                                    ? "review"
                                                    : "poor"
                                        }
                                    >
                                        {word.confidence.toFixed(1)}%
                                    </strong>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <aside className="word-detail">
                            {selectedWord ? (
                                <>
                                    <div className="word-detail-title">
                                        <span>
                                            {selectedWord.status ===
                                            "Corrected"
                                                ? "Corrected word"
                                                : "Detected word"}
                                        </span>
                                        <strong>
                                            {selectedWord.correctedText ||
                                                selectedWord.text}
                                        </strong>
                                        {selectedWord.correctedText && (
                                            <small>
                                                OCR detected:{" "}
                                                {selectedWord.text}
                                            </small>
                                        )}
                                    </div>

                                    <dl>
                                        <div>
                                            <dt>Confidence</dt>
                                            <dd>
                                                {selectedWord.confidence.toFixed(
                                                    1
                                                )}
                                                %
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Page</dt>
                                            <dd>
                                                {
                                                    selectedWord.pageNumber
                                                }
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Block / line</dt>
                                            <dd>
                                                {
                                                    selectedWord.blockNumber
                                                }{" "}
                                                /{" "}
                                                {
                                                    selectedWord.lineNumber
                                                }
                                            </dd>
                                        </div>
                                        <div>
                                            <dt>Word position</dt>
                                            <dd>
                                                {
                                                    selectedWord.wordNumber
                                                }
                                            </dd>
                                        </div>
                                        <div className="wide">
                                            <dt>Bounding box</dt>
                                            <dd>
                                                x=
                                                {
                                                    selectedWord.box.left
                                                }
                                                , y=
                                                {selectedWord.box.top},
                                                w=
                                                {
                                                    selectedWord.box.width
                                                }
                                                , h=
                                                {
                                                    selectedWord.box.height
                                                }
                                            </dd>
                                        </div>
                                        <div className="wide">
                                            <dt>Review status</dt>
                                            <dd>
                                                {
                                                    selectedWord.status
                                                }
                                            </dd>
                                        </div>
                                    </dl>

                                    <div className="nearby-words">
                                        <span>Nearby words</span>
                                        <div>
                                            {nearbyWords.map(
                                                (word) => (
                                                    <button
                                                        type="button"
                                                        key={`near-${word.id}`}
                                                        className={
                                                            word.id ===
                                                            selectedWord.id
                                                                ? "current"
                                                                : ""
                                                        }
                                                        onClick={() =>
                                                            setSelectedWordId(
                                                                word.id
                                                            )
                                                        }
                                                    >
                                                        {word.text}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="intelligent-suggestions">
                                        <div className="intelligent-suggestions-header">
                                            <div>
                                                <span>
                                                    Intelligent OCR suggestions
                                                </span>
                                                <strong>
                                                    Document-learned candidates
                                                </strong>
                                            </div>

                                            <button
                                                type="button"
                                                className="small-button primary"
                                                disabled={
                                                    suggestionLoading ||
                                                    wordReviewSaving
                                                }
                                                onClick={() =>
                                                    void generateIntelligentSuggestions()
                                                }
                                            >
                                                {suggestionLoading
                                                    ? "Analyzing..."
                                                    : "Suggest corrections"}
                                            </button>
                                        </div>

                                        {suggestionContext.length > 0 && (
                                            <div className="suggestion-context">
                                                <span>Line context</span>
                                                <div>
                                                    {suggestionContext.map(
                                                        (item) => (
                                                            <em
                                                                key={`suggestion-context-${item.id}`}
                                                                className={
                                                                    item.selected
                                                                        ? "selected"
                                                                        : ""
                                                                }
                                                            >
                                                                {item.text}
                                                            </em>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {suggestionMessage && (
                                            <div className="suggestion-message">
                                                {suggestionMessage}
                                            </div>
                                        )}

                                        {intelligentSuggestions.length > 0 && (
                                            <div className="suggestion-list">
                                                {intelligentSuggestions.map(
                                                    (suggestion) => (
                                                        <button
                                                            type="button"
                                                            key={`${suggestion.text}-${suggestion.score}`}
                                                            onClick={() =>
                                                                applyIntelligentSuggestion(
                                                                    suggestion
                                                                )
                                                            }
                                                        >
                                                            <span className="suggestion-main">
                                                                <strong>
                                                                    {
                                                                        suggestion.text
                                                                    }
                                                                </strong>
                                                                <small>
                                                                    {
                                                                        suggestion.reason
                                                                    }
                                                                </small>
                                                            </span>

                                                            <span className="suggestion-metrics">
                                                                <em>
                                                                    Score{" "}
                                                                    {
                                                                        suggestion.score
                                                                    }
                                                                </em>
                                                                <em>
                                                                    Similarity{" "}
                                                                    {
                                                                        suggestion.similarity
                                                                    }
                                                                    %
                                                                </em>
                                                                <em>
                                                                    {
                                                                        suggestion.occurrences
                                                                    }{" "}
                                                                    occurrence(s)
                                                                </em>
                                                            </span>
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        <small>
                                            Suggestions are learned locally
                                            from trusted, verified, corrected,
                                            and high-confidence words in this
                                            document. Nothing is sent online.
                                        </small>
                                    </div>

                                    <div className="correction-memory-panel">
                                        <div className="correction-memory-header">
                                            <div>
                                                <span>
                                                    Correction memory
                                                </span>
                                                <strong>
                                                    Reuse and apply learned corrections
                                                </strong>
                                            </div>

                                            <button
                                                type="button"
                                                className="small-button"
                                                onClick={() =>
                                                    void loadCorrectionMemory()
                                                }
                                            >
                                                Load memory
                                            </button>
                                        </div>

                                        {correctionMemory.length > 0 && (
                                            <div className="correction-memory-list">
                                                {correctionMemory
                                                    .slice(0, 12)
                                                    .map((memory) => (
                                                        <button
                                                            type="button"
                                                            key={`${memory.normalizedSource}-${memory.correctedText}`}
                                                            onClick={() =>
                                                                useCorrectionMemory(
                                                                    memory
                                                                )
                                                            }
                                                        >
                                                            <span>
                                                                <del>
                                                                    {
                                                                        memory.sourceText
                                                                    }
                                                                </del>
                                                                <strong>
                                                                    {
                                                                        memory.correctedText
                                                                    }
                                                                </strong>
                                                            </span>
                                                            <small>
                                                                Used{" "}
                                                                {
                                                                    memory.timesApplied
                                                                }{" "}
                                                                time(s)
                                                            </small>
                                                        </button>
                                                    ))}
                                            </div>
                                        )}

                                        <div className="batch-correction-controls">
                                            <label>
                                                <span>
                                                    Include matches up to
                                                </span>
                                                <select
                                                    value={
                                                        batchMaxConfidence
                                                    }
                                                    onChange={(event) =>
                                                        setBatchMaxConfidence(
                                                            Number(
                                                                event
                                                                    .target
                                                                    .value
                                                            )
                                                        )
                                                    }
                                                >
                                                    <option value={35}>
                                                        35% confidence
                                                    </option>
                                                    <option value={60}>
                                                        60% confidence
                                                    </option>
                                                    <option value={75}>
                                                        75% confidence
                                                    </option>
                                                    <option value={100}>
                                                        Any confidence
                                                    </option>
                                                </select>
                                            </label>

                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={
                                                    batchPreviewLoading ||
                                                    !selectedWord ||
                                                    !correctionDraft.trim()
                                                }
                                                onClick={() =>
                                                    void previewBatchCorrection()
                                                }
                                            >
                                                {batchPreviewLoading
                                                    ? "Finding..."
                                                    : "Find matching occurrences"}
                                            </button>
                                        </div>

                                        {batchMessage && (
                                            <div className="batch-correction-message">
                                                {batchMessage}
                                            </div>
                                        )}

                                        {batchMatches.length > 0 && (
                                            <div className="batch-correction-preview">
                                                <div className="batch-preview-header">
                                                    <strong>
                                                        {
                                                            selectedBatchMatchIds.size
                                                        }{" "}
                                                        of{" "}
                                                        {
                                                            batchMatches.length
                                                        }{" "}
                                                        selected
                                                    </strong>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            className="small-button"
                                                            onClick={() =>
                                                                setSelectedBatchMatchIds(
                                                                    new Set(
                                                                        batchMatches.map(
                                                                            (
                                                                                match
                                                                            ) =>
                                                                                `${match.pageNumber}:${match.wordId}`
                                                                        )
                                                                    )
                                                                )
                                                            }
                                                        >
                                                            Select all
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="small-button"
                                                            onClick={() =>
                                                                setSelectedBatchMatchIds(
                                                                    new Set()
                                                                )
                                                            }
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="batch-match-list">
                                                    {batchMatches.map(
                                                        (match) => {
                                                            const key = `${match.pageNumber}:${match.wordId}`;

                                                            return (
                                                                <label
                                                                    key={
                                                                        key
                                                                    }
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedBatchMatchIds.has(
                                                                            key
                                                                        )}
                                                                        onChange={() =>
                                                                            toggleBatchMatch(
                                                                                match
                                                                            )
                                                                        }
                                                                    />
                                                                    <span>
                                                                        Page{" "}
                                                                        {
                                                                            match.pageNumber
                                                                        }
                                                                    </span>
                                                                    <strong>
                                                                        {
                                                                            match.text
                                                                        }
                                                                    </strong>
                                                                    <em>
                                                                        {match.confidence.toFixed(
                                                                            1
                                                                        )}
                                                                        %
                                                                    </em>
                                                                </label>
                                                            );
                                                        }
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    className="small-button primary"
                                                    disabled={
                                                        batchApplyLoading ||
                                                        selectedBatchMatchIds.size ===
                                                            0
                                                    }
                                                    onClick={() =>
                                                        void applyBatchCorrections()
                                                    }
                                                >
                                                    {batchApplyLoading
                                                        ? "Applying..."
                                                        : `Apply correction to ${selectedBatchMatchIds.size} occurrence(s)`}
                                                </button>
                                            </div>
                                        )}

                                        <div className="correction-rule-library">
                                            <div className="rule-library-header">
                                                <div>
                                                    <span>
                                                        Correction rules
                                                    </span>
                                                    <strong>
                                                        Save reusable document rules
                                                    </strong>
                                                </div>

                                                <div>
                                                    <button
                                                        type="button"
                                                        className="small-button"
                                                        onClick={() =>
                                                            void loadCorrectionRules()
                                                        }
                                                    >
                                                        Load rules
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="small-button primary"
                                                        disabled={
                                                            !selectedWord ||
                                                            !correctionDraft.trim()
                                                        }
                                                        onClick={() =>
                                                            void saveCurrentCorrectionRule()
                                                        }
                                                    >
                                                        Save current rule
                                                    </button>
                                                </div>
                                            </div>

                                            {ruleMessage && (
                                                <div className="rule-message">
                                                    {ruleMessage}
                                                </div>
                                            )}

                                            {correctionRules.length > 0 && (
                                                <div className="rule-list">
                                                    {correctionRules.map(
                                                        (rule) => (
                                                            <article
                                                                key={
                                                                    rule.id
                                                                }
                                                                className={
                                                                    rule.isEnabled
                                                                        ? "enabled"
                                                                        : "disabled"
                                                                }
                                                            >
                                                                <button
                                                                    type="button"
                                                                    className="rule-main"
                                                                    onClick={() =>
                                                                        useCorrectionRule(
                                                                            rule
                                                                        )
                                                                    }
                                                                >
                                                                    <span>
                                                                        <del>
                                                                            {
                                                                                rule.sourceText
                                                                            }
                                                                        </del>
                                                                        <strong>
                                                                            {
                                                                                rule.correctedText
                                                                            }
                                                                        </strong>
                                                                    </span>
                                                                    <small>
                                                                        Up to{" "}
                                                                        {
                                                                            rule.maxConfidence
                                                                        }
                                                                        %
                                                                    </small>
                                                                </button>

                                                                <div>
                                                                    <button
                                                                        type="button"
                                                                        className="small-button"
                                                                        onClick={() =>
                                                                            void toggleCorrectionRule(
                                                                                rule
                                                                            )
                                                                        }
                                                                    >
                                                                        {rule.isEnabled
                                                                            ? "Disable"
                                                                            : "Enable"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="small-button danger"
                                                                        onClick={() =>
                                                                            void deleteCorrectionRule(
                                                                                rule
                                                                            )
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </article>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="batch-transaction-history">
                                            <div className="batch-history-header">
                                                <div>
                                                    <span>
                                                        Batch history
                                                    </span>
                                                    <strong>
                                                        Undo a complete batch safely
                                                    </strong>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="small-button"
                                                    onClick={() =>
                                                        void loadBatchTransactions()
                                                    }
                                                >
                                                    Load history
                                                </button>
                                            </div>

                                            {batchTransactions.length > 0 && (
                                                <div className="batch-history-list">
                                                    {batchTransactions
                                                        .slice(0, 10)
                                                        .map(
                                                            (
                                                                transaction
                                                            ) => (
                                                                <article
                                                                    key={
                                                                        transaction.id
                                                                    }
                                                                >
                                                                    <div>
                                                                        <span>
                                                                            <del>
                                                                                {
                                                                                    transaction.sourceText
                                                                                }
                                                                            </del>
                                                                            <strong>
                                                                                {
                                                                                    transaction.correctedText
                                                                                }
                                                                            </strong>
                                                                        </span>
                                                                        <small>
                                                                            {
                                                                                transaction.applied
                                                                            }{" "}
                                                                            change(s) ·{" "}
                                                                            {new Date(
                                                                                transaction.createdAt
                                                                            ).toLocaleString()}
                                                                        </small>
                                                                    </div>

                                                                    {transaction.undoneAt ? (
                                                                        <em>
                                                                            Undone
                                                                        </em>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="small-button danger"
                                                                            disabled={
                                                                                batchUndoLoadingId ===
                                                                                transaction.id
                                                                            }
                                                                            onClick={() =>
                                                                                void undoBatchTransaction(
                                                                                    transaction
                                                                                )
                                                                            }
                                                                        >
                                                                            {batchUndoLoadingId ===
                                                                            transaction.id
                                                                                ? "Undoing..."
                                                                                : "Undo batch"}
                                                                        </button>
                                                                    )}
                                                                </article>
                                                            )
                                                        )}
                                                </div>
                                            )}
                                        </div>

                                        <small>
                                            Batch changes require preview and
                                            explicit selection. Every change
                                            is recorded and can be undone as
                                            one transaction.
                                        </small>
                                    </div>

                                    <div className="word-correction-editor">
                                        <div className="word-correction-header">
                                            <div>
                                                <span>
                                                    Correction and verification
                                                </span>
                                                <strong>
                                                    Status:{" "}
                                                    {selectedWord.status}
                                                </strong>
                                            </div>

                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={
                                                    wordReviewSaving
                                                }
                                                onClick={
                                                    goToNextReviewWord
                                                }
                                            >
                                                Next issue
                                            </button>
                                        </div>

                                        <label>
                                            <span>
                                                Corrected text
                                            </span>
                                            <textarea
                                                rows={3}
                                                value={
                                                    correctionDraft
                                                }
                                                disabled={
                                                    wordReviewSaving
                                                }
                                                onChange={(event) =>
                                                    setCorrectionDraft(
                                                        event.target
                                                            .value
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.ctrlKey &&
                                                        event.key ===
                                                            "Enter"
                                                    ) {
                                                        event.preventDefault();
                                                        void saveWordReview(
                                                            "correct"
                                                        );
                                                    }
                                                }}
                                            />
                                        </label>

                                        <div className="word-correction-actions">
                                            <button
                                                type="button"
                                                className="small-button primary"
                                                disabled={
                                                    wordReviewSaving ||
                                                    !correctionDraft.trim()
                                                }
                                                onClick={() =>
                                                    void saveWordReview(
                                                        "correct"
                                                    )
                                                }
                                            >
                                                Save correction
                                            </button>

                                            <button
                                                type="button"
                                                className="small-button success"
                                                disabled={
                                                    wordReviewSaving
                                                }
                                                onClick={() =>
                                                    void saveWordReview(
                                                        "verify"
                                                    )
                                                }
                                            >
                                                Verify OCR
                                            </button>

                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={
                                                    wordReviewSaving
                                                }
                                                onClick={() =>
                                                    void saveWordReview(
                                                        "ignore"
                                                    )
                                                }
                                            >
                                                Ignore
                                            </button>

                                            <button
                                                type="button"
                                                className="small-button danger"
                                                disabled={
                                                    wordReviewSaving ||
                                                    selectedWord.status ===
                                                        "Unreviewed"
                                                }
                                                onClick={() =>
                                                    void saveWordReview(
                                                        "reset"
                                                    )
                                                }
                                            >
                                                Reset review
                                            </button>
                                        </div>

                                        <small>
                                            Press Ctrl+Enter to save a
                                            correction. Changes are stored
                                            in the page word database and
                                            correction history.
                                        </small>

                                        {wordReviewMessage && (
                                            <div className="word-review-message">
                                                {
                                                    wordReviewMessage
                                                }
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="pdf-empty">
                                    Select a word to inspect it.
                                </div>
                            )}
                        </aside>
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

            <div className="confidence-overlay-toolbar">
                <label className="overlay-toggle">
                    <input
                        type="checkbox"
                        checked={confidenceOverlayEnabled}
                        disabled={!wordIndexPage}
                        onChange={(event) =>
                            setConfidenceOverlayEnabled(
                                event.target.checked
                            )
                        }
                    />
                    <span>Confidence overlay</span>
                </label>

                <select
                    value={confidenceOverlayFilter}
                    disabled={
                        !confidenceOverlayEnabled ||
                        !wordIndexPage
                    }
                    onChange={(event) =>
                        setConfidenceOverlayFilter(
                            event.target.value as
                                | "poor"
                                | "review"
                                | "all"
                        )
                    }
                >
                    <option value="poor">
                        Critical only — below 35%
                    </option>
                    <option value="review">
                        Needs review — below 60%
                    </option>
                    <option value="all">All OCR words</option>
                </select>

                <div className="overlay-legend">
                    <span className="poor">Below 35%</span>
                    <span className="review">35–59%</span>
                    <span className="good">60–74%</span>
                    <span className="excellent">75%+</span>
                </div>

                <small>
                    {wordIndexPage
                        ? `${overlayWords.length} box(es) on page ${currentReviewPage}`
                        : "Index this page to enable word boxes."}
                </small>
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
                    overlayEnabled={
                        confidenceOverlayEnabled &&
                        Boolean(wordIndexPage)
                    }
                    overlayWords={overlayWords}
                    overlayImageWidth={
                        wordIndexPage?.imageWidth || 0
                    }
                    overlayImageHeight={
                        wordIndexPage?.imageHeight || 0
                    }
                    selectedOverlayWordId={selectedWordId}
                    onOverlayWordSelect={selectOverlayWord}
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
