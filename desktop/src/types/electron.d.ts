export { };
type OcrQueueItem = {
    id: number;
    documentId: number;
    fileName: string;
    inputPath: string;

    status:
    | "Waiting"
    | "Processing"
    | "Completed"
    | "Failed"
    | "Cancelled";

    position: number;

    language: string;
    compression: string;
    outputType: string;

    addedAt: string;
    startedAt?: string;
    completedAt?: string;

    error?: string;
    outputPath?: string;
};


type WordIndexBackgroundJob = {
    id: string;
    type: "WordIndex";
    documentId: number;
    fileName: string;
    mode: "quick" | "full";
    language: string;
    status: "Queued" | "Running" | "Completed" | "Failed" | "Cancelled";
    progress: number;
    currentPage: number;
    totalPages: number;
    pageNumber: number;
    message: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
    attempt: number;
};

type OcrIndexedWord = {
    id: string;
    pageNumber: number;
    blockNumber: number;
    paragraphNumber: number;
    lineNumber: number;
    wordNumber: number;
    text: string;
    confidence: number;
    box: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    status: "Unreviewed" | "Verified" | "Corrected" | "Ignored";
    correctedText: string | null;
    verifiedAt: string | null;
};

type OcrWordIndexPage = {
    version: number;
    documentId: number;
    pageNumber: number;
    sourceFile: string;
    language: string;
    imageWidth: number;
    imageHeight: number;
    indexedAt: string;
    updatedAt?: string;
    reviewSummary?: {
        unreviewed: number;
        verified: number;
        corrected: number;
        ignored: number;
    };
    summary: {
        totalWords: number;
        lowConfidenceWords: number;
        veryLowConfidenceWords: number;
        averageConfidence: number;
    };
    words: OcrIndexedWord[];
};

type OcrWordIndexDocument = {
    documentId: number;
    fileName: string;
    language: string;
    mode: "quick" | "full";
    pageCount: number;
    indexedPageCount: number;
    failedPageCount: number;
    indexedPages: number[];
    failedPages: Array<{
        pageNumber: number;
        error: string;
    }>;
    totalWords: number;
    lowConfidenceWords: number;
    veryLowConfidenceWords: number;
    averageConfidence: number;
    startedAt: string;
    completedAt: string;
    status: "Completed" | "CompletedWithErrors" | "Cancelled";
};

type OcrWordIndexManifest = {
    version: number;
    documents: OcrWordIndexDocument[];
    updatedAt: string | null;
};

type PageConfidenceRecord = {
    documentId: number;
    fileName: string;
    pageNumber: number;
    language: string;
    confidence: number;
    confidenceLabel: string;
    wordCount: number;
    lowConfidenceWordCount: number;
    veryLowConfidenceWordCount: number;
    suspiciousWords: Array<{
        text: string;
        confidence: number;
    }>;
    status: "Completed" | "Failed";
    analyzedAt: string;
    error?: string;
};

type PdfAnalysis = {
    documentId: number;
    fileName: string;
    filePath: string;
    fileSize: number;

    pageCount: number;
    pageSize: string;
    pdfVersion: string;
    encrypted: string;
    tagged: string;

    title: string;
    author: string;
    creator: string;
    producer: string;

    searchable: boolean;
    characterCount: number;
    wordCount: number;
    sampleText: string;

    imageCount: number;
    containsImages: boolean;
    estimatedDocumentType: string;

    qualityScore: number;
    qualityLabel: string;

    recommendation: "RUN_OCR" | "SKIP_OCR" | "REVIEW";
    recommendationLabel: string;
    recommendationReason: string;

    analysisStatus: "Completed" | "Failed";
    analyzedAt: string;
    error?: string;
};
type DocumentStatus =
    | "Imported"
    | "Processing"
    | "Converted"
    | "Failed"
    | "Cancelled";

type ImportedDocument = {
    id: number;
    fileName: string;
    sourcePath: string;
    destinationPath: string;
    status: DocumentStatus;
    importedAt: string;

    processingStartedAt?: string;
    completedAt?: string;
    failedAt?: string;

    outputPath?: string;
    searchablePath?: string;
    compressedPath?: string;
    sidecarTxtPath?: string;

    inputSize?: number;
    outputSize?: number;
    reductionPercent?: number;
    lastError?: string;
};

type ProjectInfo = {
    id: number;
    name: string;
    description: string;
    language: string;
    workflow: string;
    status: string;
    workspacePath: string;
    projectPath: string;
    createdAt: string;
    updatedAt: string;
    compression: string;
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
    documentId?: number;
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

type OcrResultItem = {
    documentId?: number;
    fileName: string;
    success: boolean;
    message?: string;
    outputPath?: string;
    searchablePath?: string;
    compressedPath?: string;
    sidecarTxtPath?: string;
    inputSize?: number;
    ocrSize?: number;
    outputSize?: number;
    reductionPercent?: number;
};

declare global {
    interface Window {
        ocrStudio: {
            selectWorkspaceFolder: () => Promise<string | null>;
            listOcrQueue: (data: {
                projectPath: string;
            }) => Promise<OcrQueueItem[]>;

            addToOcrQueue: (data: {
                projectPath: string;
                documentIds: number[];
                language: string;
                compression?: string;
                outputType?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                queue: OcrQueueItem[];
            }>;

            removeFromOcrQueue: (data: {
                projectPath: string;
                queueItemId: number;
            }) => Promise<{
                success: boolean;
                message: string;
                queue: OcrQueueItem[];
            }>;

            clearCompletedQueueItems: (data: {
                projectPath: string;
            }) => Promise<OcrQueueItem[]>;

            createProject: (data: {
                name: string;
                description: string;
                language: string;
                workflow: string;
                workspacePath: string;
                compression?: string;
            }) => Promise<ProjectInfo>;

            listRecentProjects: () => Promise<ProjectInfo[]>;

            openInputFolder: (projectPath: string) => Promise<string>;

            openPath: (filePath: string) => Promise<string>;

            checkOcrTools: () => Promise<{
                tesseract: {
                    installed: boolean;
                    output: string;
                };
                ocrmypdf: {
                    installed: boolean;
                    output: string;
                };
            }>;

            importFilesToProject: (data: {
                projectPath: string;
            }) => Promise<ImportedDocument[]>;

            listProjectDocuments: (data: {
                projectPath: string;
            }) => Promise<ImportedDocument[]>;

            listOcrJobs: (data: {
                projectPath: string;
            }) => Promise<OcrJob[]>;

            runOcrForProject: (data: {
                projectPath: string;
                language: string;
                compression?: string;
                outputType?: string;
                documentIds?: number[];
                allowReprocess?: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                outputPath?: string;
                inputSize?: number;
                ocrSize?: number;
                outputSize?: number;
                reductionPercent?: number;
                results?: OcrResultItem[];
            }>;

            listProjectExports: (data: {
                projectPath: string;
            }) => Promise<ProjectExport[]>;

            getPdfPreviewUrl: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                url: string | null;
            }>;

            listWordIndexJobs: (data: {
                projectPath: string;
            }) => Promise<WordIndexBackgroundJob[]>;

            enqueueWordIndexJob: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
                job?: WordIndexBackgroundJob;
            }>;

            cancelWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            retryWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            removeWordIndexJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: WordIndexBackgroundJob[];
            }>;

            onWordIndexQueueUpdated: (
                callback: (data: {
                    projectPath: string;
                    jobs: WordIndexBackgroundJob[];
                }) => void
            ) => void;

            getWordIndexManifest: (data: {
                projectPath: string;
            }) => Promise<OcrWordIndexManifest>;

            getWordIndexPage: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
            }) => Promise<OcrWordIndexPage | null>;

            updateWordIndexWord: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                action: "correct" | "verify" | "ignore" | "reset";
                correctedText?: string;
            }) => Promise<{
                success: boolean;
                message: string;
                page: OcrWordIndexPage | null;
                word?: OcrIndexedWord;
            }>;

            getWordCorrectionHistory: (data: {
                projectPath: string;
                documentId?: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                action: string;
                originalText: string;
                previousStatus: string;
                previousCorrectedText: string | null;
                status: string;
                correctedText: string | null;
                changedAt: string;
            }>>;

            getCorrectionMemory: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<{
                success: boolean;
                message: string;
                memory: Array<{
                    sourceText: string;
                    normalizedSource: string;
                    correctedText: string;
                    timesApplied: number;
                    lastUsedAt: string | null;
                }>;
            }>;

            previewBatchCorrection: (data: {
                projectPath: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                maxConfidence?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                totalMatches: number;
                matches: Array<{
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
                }>;
            }>;

            getPublicationSettings: (data: {
                projectPath: string;
            }) => Promise<{
                workerCount: number;
                isPaused: boolean;
            }>;

            updatePublicationSettings: (data: {
                projectPath: string;
                workerCount?: number;
                isPaused?: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                settings: {
                    workerCount: number;
                    isPaused: boolean;
                };
            }>;

            previewIncrementalPublication: (data: {
                projectPath: string;
                documentId: number;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                preview: {
                    hasPreviousSnapshot: boolean;
                    changedPageNumbers: number[];
                    unchangedPageNumbers: number[];
                    previousPublishedAt: string | null;
                    totalPages: number;
                } | null;
            }>;

            listPublicationProfiles: (data: {
                projectPath: string;
            }) => Promise<Array<{
                id: string;
                name: string;
                options: Record<string, boolean>;
                createdAt: string;
                updatedAt: string;
            }>>;

            savePublicationProfile: (data: {
                projectPath: string;
                name: string;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                profiles: Array<{
                    id: string;
                    name: string;
                    options: Record<string, boolean>;
                    createdAt: string;
                    updatedAt: string;
                }>;
            }>;

            deletePublicationProfile: (data: {
                projectPath: string;
                profileId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                profiles: Array<{
                    id: string;
                    name: string;
                    options: Record<string, boolean>;
                    createdAt: string;
                    updatedAt: string;
                }>;
            }>;

            listPublicationQueue: (data: {
                projectPath: string;
            }) => Promise<Array<{
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
            }>>;

            enqueuePublicationJobs: (data: {
                projectPath: string;
                documents: Array<{
                    documentId: number;
                    documentName: string;
                    basePdf?: string | null;
                }>;
                profileId?: string | null;
                profileName?: string | null;
                options: Record<string, boolean>;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            retryPublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            cancelPublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            removePublicationJob: (data: {
                projectPath: string;
                jobId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                jobs: Array<Record<string, unknown>>;
            }>;

            resumePublicationQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            validatePublishedDocument: (data: {
                projectPath: string;
                documentId: number;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                validation: {
                    valid: boolean;
                    missingPages: number[];
                    emptyPages: number[];
                    malformedWords: number;
                    invalidBoxes: number;
                    duplicateWordIds: number;
                } | null;
                summary: {
                    pages: number;
                    words: number;
                    corrected: number;
                    verified: number;
                    ignored: number;
                    unreviewed: number;
                    publishedWords: number;
                } | null;
            }>;

            createPublishedBundle: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                    exportTxt: boolean;
                    exportJson: boolean;
                    exportCsv: boolean;
                    exportHtml: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                files: Array<{
                    type: string;
                    fileName: string;
                    filePath: string;
                }>;
                record: {
                    id: string;
                    documentId: number;
                    documentName: string;
                    version: number;
                    publishedAt: string;
                    durationMs: number;
                    folderPath: string;
                    summary: {
                        pages: number;
                        words: number;
                        corrected: number;
                        verified: number;
                        ignored: number;
                        unreviewed: number;
                        publishedWords: number;
                    };
                    validation: {
                        valid: boolean;
                        missingPages: number[];
                        emptyPages: number[];
                        malformedWords: number;
                        invalidBoxes: number;
                        duplicateWordIds: number;
                    };
                    files: Array<{
                        type: string;
                        fileName: string;
                        filePath: string;
                    }>;
                } | null;
            }>;

            createCorrectedSearchablePdf: (data: {
                projectPath: string;
                documentId: number;
                documentName: string;
                basePdf: string;
                options: {
                    includeCorrected: boolean;
                    includeVerified: boolean;
                    includeUnreviewed: boolean;
                    includeIgnored: boolean;
                };
            }) => Promise<{
                success: boolean;
                message: string;
                outputPdf: string | null;
                record: {
                    id: string;
                    version: number;
                    folderPath: string;
                    searchablePdf: {
                        fileName: string;
                        filePath: string;
                        size: number;
                        extractedCharacters: number;
                        fontPath: string | null;
                        missingIndexPages: number[];
                    };
                } | null;
            }>;

            listPublishHistory: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
                id: string;
                documentId: number;
                documentName: string;
                version: number;
                publishedAt: string;
                durationMs: number;
                folderPath: string;
                summary: {
                    pages: number;
                    words: number;
                    corrected: number;
                    verified: number;
                    ignored: number;
                    unreviewed: number;
                    publishedWords: number;
                };
                validation: {
                    valid: boolean;
                    missingPages: number[];
                    emptyPages: number[];
                    malformedWords: number;
                    invalidBoxes: number;
                    duplicateWordIds: number;
                };
                files: Array<{
                    type: string;
                    fileName: string;
                    filePath: string;
                }>;
            }>>;

            listBatchCorrectionTransactions: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
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
            }>>;

            undoBatchCorrection: (data: {
                projectPath: string;
                transactionId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                restored: number;
                failed: number;
            }>;

            listCorrectionRules: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<Array<{
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
            }>>;

            saveCorrectionRule: (data: {
                projectPath: string;
                documentId: number;
                sourceText: string;
                correctedText: string;
                maxConfidence: number;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
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
                }>;
            }>;

            toggleCorrectionRule: (data: {
                projectPath: string;
                ruleId: string;
                isEnabled: boolean;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
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
                }>;
            }>;

            deleteCorrectionRule: (data: {
                projectPath: string;
                documentId: number;
                ruleId: string;
            }) => Promise<{
                success: boolean;
                message: string;
                rules: Array<{
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
                }>;
            }>;

            applyBatchCorrection: (data: {
                projectPath: string;
                documentId: number;
                correctedText: string;
                matches: Array<{
                    pageNumber: number;
                    wordId: string;
                }>;
            }) => Promise<{
                success: boolean;
                message: string;
                applied: number;
                failed: number;
            }>;

            suggestWordCorrections: (data: {
                projectPath: string;
                documentId: number;
                pageNumber: number;
                wordId: string;
                limit?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                sourceText?: string;
                scannedPages: number;
                context: Array<{
                    id: string;
                    text: string;
                    selected: boolean;
                    confidence: number;
                }>;
                suggestions: Array<{
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
                }>;
            }>;

            searchWordIndexDocument: (data: {
                projectPath: string;
                documentId: number;
                query: string;
                mode: "all" | "review" | "poor" | "unreviewed";
                limit?: number;
            }) => Promise<{
                success: boolean;
                message: string;
                results: Array<
                    OcrIndexedWord & {
                        documentId: number;
                        sourceFile: string;
                    }
                >;
                scannedPages: number;
                totalMatches: number;
                truncated: boolean;
            }>;

            getWordIndexReviewQueue: (data: {
                projectPath: string;
                documentId: number;
                limit?: number;
            }) => Promise<{
                success: boolean;
                results: Array<
                    OcrIndexedWord & {
                        documentId: number;
                        sourceFile: string;
                    }
                >;
                scannedPages: number;
                totalMatches: number;
                truncated: boolean;
            }>;

            buildWordIndex: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                cancelled?: boolean;
                message: string;
                manifest: OcrWordIndexManifest;
            }>;

            cancelWordIndex: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            clearWordIndex: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<OcrWordIndexManifest>;

            onWordIndexProgress: (
                callback: (data: {
                    projectPath: string;
                    documentId: number;
                    fileName: string;
                    pageNumber: number;
                    current: number;
                    total: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            listPageConfidence: (data: {
                projectPath: string;
            }) => Promise<PageConfidenceRecord[]>;

            analyzePageConfidence: (data: {
                projectPath: string;
                documentId: number;
                language: string;
                mode: "quick" | "full";
            }) => Promise<{
                success: boolean;
                cancelled?: boolean;
                message: string;
                records: PageConfidenceRecord[];
            }>;

            cancelPageConfidence: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
            }>;

            clearPageConfidence: (data: {
                projectPath: string;
                documentId?: number;
            }) => Promise<PageConfidenceRecord[]>;

            onPageConfidenceProgress: (
                callback: (data: {
                    projectPath: string;
                    documentId: number;
                    fileName: string;
                    pageNumber: number;
                    current: number;
                    total: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            getPdfInfo: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                pageCount: number;
                pageWidth?: number;
                pageHeight?: number;
            }>;

            renderPdfPage: (data: {
                filePath: string;
                pageNumber: number;
                scalePercent: number;
            }) => Promise<{
                success: boolean;
                message: string;
                dataUrl: string | null;
                pageNumber: number;
                scalePercent: number;
            }>;

            readPdfFile: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                data: Uint8Array | null;
            }>;

            verifyPdfTextLayer: (data: {
                filePath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                characterCount: number;
                sampleText: string;
            }>;

            deleteProject: (data: {
                projectId: number;
                projectPath?: string;
                deleteFiles: boolean;
            }) => Promise<ProjectInfo[]>;

            deleteProjectDocument: (data: {
                projectPath: string;
                documentId: number;
            }) => Promise<ImportedDocument[]>;

            deleteProjectExport: (data: {
                projectPath: string;
                filePath: string;
            }) => Promise<ProjectExport[]>;

            cancelOcr: () => Promise<{
                success: boolean;
                message: string;
            }>;

            onOcrProgress: (
                callback: (data: {
                    fileName: string;
                    currentPage?: number;
                    totalPages?: number;
                    percent?: number;
                    message: string;
                }) => void
            ) => void;

            onOcrDocumentStatus: (
                callback: (data: {
                    documentId: number;
                    status: DocumentStatus;
                }) => void
            ) => void;


            startOcrQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                status: "Running" | "Idle" | "Stopping" | "Stopped";
                queue: OcrQueueItem[];
            }>;

            stopOcrQueue: (data: {
                projectPath: string;
            }) => Promise<{
                success: boolean;
                message: string;
                status: "Running" | "Idle" | "Stopping" | "Stopped";
                queue: OcrQueueItem[];
            }>;

            getOcrQueueStatus: (data: {
                projectPath: string;
            }) => Promise<{
                status: "Running" | "Idle";
                running: boolean;
                queue: OcrQueueItem[];
            }>;

            onOcrQueueUpdated: (
                callback: (data: {
                    projectPath: string;
                    queue: OcrQueueItem[];
                }) => void
            ) => void;

            onOcrQueueWorkerStatus: (
                callback: (data: {
                    projectPath: string;
                    status: "Running" | "Idle" | "Stopping" | "Stopped";
                    message: string;
                    queueItemId?: number;
                }) => void
            ) => void;

            analyzeProject: (data: {
                projectPath: string;
                documentIds?: number[];
            }) => Promise<{
                success: boolean;
                message: string;
                analyses: PdfAnalysis[];
                completedCount?: number;
                failedCount?: number;
            }>;

            listProjectAnalysis: (data: {
                projectPath: string;
            }) => Promise<PdfAnalysis[]>;

            onAnalysisProgress: (
                callback: (data: {
                    documentId: number;
                    fileName: string;
                    current: number;
                    total: number;
                    percent: number;
                    message: string;
                }) => void
            ) => void;
        };
    }
}