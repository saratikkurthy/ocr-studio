import { useEffect, useMemo, useState } from "react";
import { getProjects } from "../../services/projectStorage";
import type { Collection } from "../../types/Collection";
import "./DuplicateDetectionPage.css";

type DocumentRef = {
  projectId: number;
  projectName: string;
  projectPath: string;
  documentId: number;
  fileName: string;
  filePath: string | null;
  fileSize: number;
  pageCount: number;
  wordCount: number;
};

type DuplicateMatch = {
  id: string;
  score: number;
  type: string;
  left: DocumentRef;
  right: DocumentRef;
  metrics: {
    fileHash: number;
    ocrText: number;
    filename: number;
    pageCount: number;
    fileSize: number;
  };
};

type DuplicateRegistry = {
  scannedAt: string;
  threshold: number;
  collectionId: string | null;
  summary: {
    projectCount: number;
    documentCount: number;
    matchCount: number;
    exactCount: number;
    highlySimilarCount: number;
    possibleCount: number;
  };
  matches: DuplicateMatch[];
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export default function DuplicateDetectionPage() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [threshold, setThreshold] = useState(75);
  const [registry, setRegistry] = useState<DuplicateRegistry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);

  useEffect(() => {
    void getProjects().then((projects) => {
      const values = [...new Set(projects.map((project) => project.workspacePath).filter(Boolean))] as string[];
      setWorkspaces(values);
      if (values[0]) setWorkspacePath(values[0]);
    });
  }, []);

  useEffect(() => {
    if (!workspacePath) return;
    setMessage("");
    setExportedFiles([]);
    void Promise.all([
      window.ocrStudio.listCollections({ workspacePath }),
      window.ocrStudio.getDuplicateRegistry({ workspacePath }),
    ]).then(([collectionsResult, registryResult]) => {
      setCollections(collectionsResult.collections || []);
      setCollectionId("");
      setRegistry(registryResult.registry || null);
    });
  }, [workspacePath]);

  const scan = async () => {
    if (!workspacePath) {
      setMessage("Select a workspace first.");
      return;
    }
    setLoading(true);
    setMessage("Fingerprinting documents and comparing OCR text…");
    setExportedFiles([]);
    try {
      const result = await window.ocrStudio.scanDuplicates({
        workspacePath,
        collectionId: collectionId || null,
        threshold,
      });
      setRegistry(result.registry);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Duplicate scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    const result = await window.ocrStudio.exportDuplicateReport({ workspacePath });
    setMessage(result.message);
    setExportedFiles(result.files || []);
  };

  const matches = useMemo(() => {
    const all = registry?.matches || [];
    if (filter === "exact") return all.filter((item) => item.score >= 99);
    if (filter === "high") return all.filter((item) => item.score >= 90 && item.score < 99);
    if (filter === "possible") return all.filter((item) => item.score < 90);
    return all;
  }, [registry, filter]);

  return (
    <div className="duplicate-page">
      <header className="duplicate-hero">
        <div>
          <span className="duplicate-eyebrow">Phase 6E.2.3</span>
          <h2>Duplicate Detection</h2>
          <p>Find exact copies and similar editions using SHA-256 fingerprints, corrected OCR text, filenames, page counts, and file sizes.</p>
        </div>
        <button className="duplicate-primary" onClick={scan} disabled={loading || !workspacePath}>
          {loading ? "Scanning…" : "Find Duplicates"}
        </button>
      </header>

      <section className="duplicate-controls">
        <label>Workspace
          <select value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)}>
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => <option key={workspace} value={workspace}>{workspace}</option>)}
          </select>
        </label>
        <label>Scope
          <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">Entire workspace</option>
            {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.icon} {collection.name}</option>)}
          </select>
        </label>
        <label>Minimum similarity
          <div className="threshold-control">
            <input type="range" min="50" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
            <strong>{threshold}%</strong>
          </div>
        </label>
      </section>

      {message && <div className="duplicate-message">{message}</div>}

      {registry && (
        <>
          <section className="duplicate-stats">
            <article><span>Documents scanned</span><strong>{registry.summary.documentCount}</strong></article>
            <article><span>Exact duplicates</span><strong>{registry.summary.exactCount}</strong></article>
            <article><span>Highly similar</span><strong>{registry.summary.highlySimilarCount}</strong></article>
            <article><span>Possible matches</span><strong>{registry.summary.possibleCount}</strong></article>
          </section>

          <section className="duplicate-toolbar">
            <div className="duplicate-filter-buttons">
              {[["all", "All"], ["exact", "Exact"], ["high", "Highly similar"], ["possible", "Possible"]].map(([value, label]) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <button onClick={exportReport} disabled={!registry.matches.length}>Export JSON, CSV & HTML</button>
          </section>

          {exportedFiles.length > 0 && (
            <div className="duplicate-exports">
              {exportedFiles.map((file) => <button key={file} onClick={() => window.ocrStudio.openDuplicateReport(file)}>Open {file.split(/[\\/]/).pop()}</button>)}
            </div>
          )}

          <section className="duplicate-results">
            {matches.length === 0 ? (
              <div className="duplicate-empty">No matches in this category.</div>
            ) : matches.map((match) => (
              <article className="duplicate-card" key={match.id}>
                <div className="duplicate-card-header">
                  <div className={`score-badge ${match.score >= 99 ? "exact" : match.score >= 90 ? "high" : "possible"}`}>{match.score}%</div>
                  <div><strong>{match.type}</strong><span>{match.left.projectName} ↔ {match.right.projectName}</span></div>
                  <button onClick={() => setExpanded(expanded === match.id ? null : match.id)}>{expanded === match.id ? "Hide details" : "Compare"}</button>
                </div>
                <div className="document-pair">
                  {[match.left, match.right].map((document, index) => (
                    <div className="document-box" key={`${match.id}-${index}`}>
                      <small>DOCUMENT {index === 0 ? "A" : "B"}</small>
                      <strong>{document.fileName}</strong>
                      <span>{document.projectName}</span>
                      <div>{formatBytes(document.fileSize)} · {document.pageCount || "?"} pages · {document.wordCount.toLocaleString()} OCR words</div>
                      {document.filePath && <button onClick={() => window.ocrStudio.openPath(document.filePath!)}>Open file</button>}
                    </div>
                  ))}
                </div>
                {expanded === match.id && (
                  <div className="metric-grid">
                    <div><span>File hash</span><strong>{match.metrics.fileHash}%</strong></div>
                    <div><span>OCR text</span><strong>{match.metrics.ocrText}%</strong></div>
                    <div><span>Filename</span><strong>{match.metrics.filename}%</strong></div>
                    <div><span>Page count</span><strong>{match.metrics.pageCount}%</strong></div>
                    <div><span>File size</span><strong>{match.metrics.fileSize}%</strong></div>
                  </div>
                )}
              </article>
            ))}
          </section>
          <p className="duplicate-timestamp">Last scan: {new Date(registry.scannedAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}
