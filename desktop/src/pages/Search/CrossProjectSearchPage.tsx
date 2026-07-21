import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects } from "../../services/projectStorage";
import type { Collection } from "../../types/Collection";
import "./CrossProjectSearchPage.css";

type SearchResult = {
  id: string;
  projectId: number;
  projectName: string;
  projectPath: string;
  documentId: number;
  documentName: string;
  pageNumber: number;
  wordId: string | null;
  text: string;
  originalText: string;
  correctedText: string | null;
  confidence: number;
  status: string;
  language: string;
  context: Array<{
    id: string | null;
    text: string;
    selected: boolean;
    confidence: number;
  }>;
};

type SearchResponse = {
  success: boolean;
  message: string;
  results: SearchResult[];
  summary: {
    projects: number;
    matchedProjects: number;
    documents: number;
    pages: number;
    words: number;
    matches: number;
  };
  truncated: boolean;
  scope?: {
    type: string;
    id: string | null;
    name: string;
  };
};

const fmt = (value: number) =>
  new Intl.NumberFormat().format(value || 0);

export default function CrossProjectSearchPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [limit, setLimit] = useState(500);
  const [response, setResponse] =
    useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [exportPath, setExportPath] =
    useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  useEffect(() => {
    void getProjects().then((projects) => {
      const values = [
        ...new Set(
          projects
            .map((project) => project.workspacePath)
            .filter(Boolean)
        ),
      ] as string[];
      setWorkspaces(values);
      if (values[0]) setWorkspacePath(values[0]);
    });
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      setCollections([]);
      return;
    }

    void window.ocrStudio
      .listCollections({ workspacePath })
      .then((result) => {
        setCollections(result.collections || []);
        setCollectionId("");
      });
  }, [workspacePath]);

  const runSearch = async () => {
    if (!workspacePath) {
      setMessage("Select a workspace.");
      return;
    }

    setLoading(true);
    setMessage("");
    setExportPath(null);

    try {
      const result =
        await window.ocrStudio.searchAcrossProjects({
          workspacePath,
          collectionId: collectionId || null,
          query,
          mode,
          limit,
        });
      setResponse(result);
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cross-project search failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async () => {
    if (!response?.results.length) return;

    const result =
      await window.ocrStudio.exportCrossProjectSearch({
        workspacePath,
        query,
        results: response.results,
      });

    setMessage(result.message);
    setExportPath(result.filePath);
  };

  const filteredResults = useMemo(() => {
    const projectNeedle = projectFilter.toLocaleLowerCase();
    const languageNeedle = languageFilter.toLocaleLowerCase();

    return (response?.results || []).filter((result) => {
      if (
        projectNeedle &&
        !result.projectName
          .toLocaleLowerCase()
          .includes(projectNeedle)
      ) {
        return false;
      }

      if (
        languageNeedle &&
        !result.language
          .toLocaleLowerCase()
          .includes(languageNeedle)
      ) {
        return false;
      }

      return true;
    });
  }, [response, projectFilter, languageFilter]);

  return (
    <div className="cross-search-page">
      <header className="cross-search-hero">
        <div>
          <span className="eyebrow">Phase 6E.2.2</span>
          <h2>Cross-Project Search</h2>
          <p>
            Search corrected and original OCR words across an entire
            workspace or inside one collection.
          </p>
        </div>
      </header>

      <section className="cross-search-controls">
        <div className="search-scope-grid">
          <label>
            Workspace
            <select
              value={workspacePath}
              onChange={(event) =>
                setWorkspacePath(event.target.value)
              }
            >
              <option value="">Select workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace} value={workspace}>
                  {workspace}
                </option>
              ))}
            </select>
          </label>

          <label>
            Collection scope
            <select
              value={collectionId}
              onChange={(event) =>
                setCollectionId(event.target.value)
              }
            >
              <option value="">Entire workspace</option>
              {collections.map((collection) => (
                <option
                  key={collection.id}
                  value={collection.id}
                >
                  {collection.icon} {collection.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Result mode
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value)
              }
            >
              <option value="all">All matching words</option>
              <option value="review">
                Confidence below 60%
              </option>
              <option value="poor">
                Confidence below 35%
              </option>
              <option value="unreviewed">
                Unreviewed words
              </option>
              <option value="corrected">
                Corrected words
              </option>
            </select>
          </label>

          <label>
            Result limit
            <select
              value={limit}
              onChange={(event) =>
                setLimit(Number(event.target.value))
              }
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={2500}>2,500</option>
              <option value={5000}>5,000</option>
            </select>
          </label>
        </div>

        <div className="search-query-row">
          <input
            value={query}
            placeholder="Search Telugu, Sanskrit, Hindi, English, or corrected text..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runSearch();
            }}
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search library"}
          </button>
        </div>
      </section>

      {response && (
        <>
          <section className="cross-search-summary">
            <article>
              <span>Scope</span>
              <strong>
                {response.scope?.name || "Workspace"}
              </strong>
            </article>
            <article>
              <span>Matches</span>
              <strong>{fmt(response.summary.matches)}</strong>
            </article>
            <article>
              <span>Matched projects</span>
              <strong>
                {fmt(response.summary.matchedProjects)}
              </strong>
            </article>
            <article>
              <span>Documents</span>
              <strong>{fmt(response.summary.documents)}</strong>
            </article>
            <article>
              <span>Pages scanned</span>
              <strong>{fmt(response.summary.pages)}</strong>
            </article>
            <article>
              <span>Words scanned</span>
              <strong>{fmt(response.summary.words)}</strong>
            </article>
          </section>

          <section className="cross-search-results-panel">
            <div className="results-toolbar">
              <div>
                <strong>Search results</strong>
                <small>
                  Showing {fmt(filteredResults.length)}
                  {response.truncated
                    ? " results; additional matches were truncated."
                    : " results."}
                </small>
              </div>

              <div className="results-filter-row">
                <input
                  value={projectFilter}
                  placeholder="Filter project"
                  onChange={(event) =>
                    setProjectFilter(event.target.value)
                  }
                />
                <input
                  value={languageFilter}
                  placeholder="Filter language"
                  onChange={(event) =>
                    setLanguageFilter(event.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={() => void exportResults()}
                  disabled={!response.results.length}
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="cross-search-results">
              {filteredResults.map((result) => (
                <article key={result.id}>
                  <div className="result-heading">
                    <div>
                      <strong>{result.text}</strong>
                      <small>
                        {result.projectName} ·{" "}
                        {result.documentName} · Page{" "}
                        {result.pageNumber}
                      </small>
                    </div>

                    <div className="result-badges">
                      <span>{result.language}</span>
                      <span
                        className={
                          result.confidence < 35
                            ? "danger"
                            : result.confidence < 60
                            ? "warning"
                            : "good"
                        }
                      >
                        {result.confidence.toFixed(1)}%
                      </span>
                      <span>{result.status}</span>
                    </div>
                  </div>

                  <p className="result-context">
                    {result.context.map((item, index) => (
                      <span
                        key={`${result.id}-${index}`}
                        className={
                          item.selected ? "selected" : ""
                        }
                      >
                        {item.text}{" "}
                      </span>
                    ))}
                  </p>

                  {result.correctedText &&
                    result.correctedText !==
                      result.originalText && (
                      <div className="correction-comparison">
                        <span>
                          Original: {result.originalText}
                        </span>
                        <span>
                          Corrected: {result.correctedText}
                        </span>
                      </div>
                    )}

                  <div className="result-actions">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/projects/${result.projectId}`,
                          {
                            state: {
                              documentId:
                                result.documentId,
                              pageNumber:
                                result.pageNumber,
                              wordId: result.wordId,
                              source:
                                "cross-project-search",
                            },
                          }
                        )
                      }
                    >
                      Open project
                    </button>
                  </div>
                </article>
              ))}

              {!filteredResults.length && (
                <div className="empty-search-results">
                  No results match the current search and filters.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {message && (
        <div className="cross-search-message">{message}</div>
      )}

      {exportPath && (
        <div className="cross-search-export">
          <span>Search results exported.</span>
          <button
            type="button"
            onClick={() =>
              void window.ocrStudio.openPath(exportPath)
            }
          >
            Open CSV
          </button>
        </div>
      )}
    </div>
  );
}
