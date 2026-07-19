type ProjectToolbarProps = {
    outputType: string;
    compression: string;
    selectedCount: number;
    allowReprocess: boolean;
    ocrRunning: boolean;
    analysisRunning: boolean;
    queueUpdating: boolean;
    hasDocuments: boolean;
    onOutputTypeChange: (value: string) => void;
    onCompressionChange: (value: string) => void;
    onAllowReprocessChange: (enabled: boolean) => void;
    onOpenInputFolder: () => void;
    onImport: () => void;
    onAnalyze: () => void;
    onAddToQueue: () => void;
    onRunOcr: () => void;
    onCancelOcr: () => void;
};

export default function ProjectToolbar({
    outputType,
    compression,
    selectedCount,
    allowReprocess,
    ocrRunning,
    analysisRunning,
    queueUpdating,
    hasDocuments,
    onOutputTypeChange,
    onCompressionChange,
    onAllowReprocessChange,
    onOpenInputFolder,
    onImport,
    onAnalyze,
    onAddToQueue,
    onRunOcr,
    onCancelOcr,
}: ProjectToolbarProps) {
    return (
        <section className="workspace-toolbar">
            <div className="workspace-toolbar-primary">
                <button className="secondary" onClick={onOpenInputFolder}>
                    Open Input Folder
                </button>
                <button className="secondary" onClick={onImport}>
                    Import Files
                </button>
                <button
                    className="secondary"
                    onClick={onAnalyze}
                    disabled={analysisRunning || selectedCount === 0}
                >
                    {analysisRunning ? "Analyzing..." : "Analyze Selected"}
                </button>
                <button
                    className="secondary"
                    onClick={onAddToQueue}
                    disabled={
                        queueUpdating || ocrRunning || selectedCount === 0
                    }
                >
                    {queueUpdating ? "Updating Queue..." : "Add to Queue"}
                </button>
                {ocrRunning ? (
                    <button className="danger-button" onClick={onCancelOcr}>
                        Cancel OCR
                    </button>
                ) : (
                    <button
                        className="primary run-ocr-button"
                        onClick={onRunOcr}
                        disabled={!hasDocuments || selectedCount === 0}
                    >
                        Run OCR
                    </button>
                )}
            </div>

            <div className="workspace-toolbar-options">
                <label className="toolbar-field">
                    <span>Output</span>
                    <select
                        value={outputType}
                        onChange={(event) =>
                            onOutputTypeChange(event.target.value)
                        }
                        disabled={ocrRunning}
                    >
                        <option value="searchable_pdf">Searchable PDF</option>
                        <option value="searchable_pdf_txt">
                            Searchable PDF + TXT
                        </option>
                    </select>
                </label>

                <label className="toolbar-field">
                    <span>Compression</span>
                    <select
                        value={compression}
                        onChange={(event) =>
                            onCompressionChange(event.target.value)
                        }
                        disabled={ocrRunning}
                    >
                        <option value="low">Low — Best Quality</option>
                        <option value="medium">Medium — Balanced</option>
                        <option value="high">High — Smaller PDF</option>
                        <option value="maximum">Maximum — Smallest PDF</option>
                    </select>
                </label>

                <label className="toolbar-check">
                    <input
                        type="checkbox"
                        checked={allowReprocess}
                        onChange={(event) =>
                            onAllowReprocessChange(event.target.checked)
                        }
                        disabled={ocrRunning}
                    />
                    <span>Allow reprocessing converted PDFs</span>
                </label>

                <span className="selection-pill">
                    {selectedCount} selected
                </span>
            </div>
        </section>
    );
}
