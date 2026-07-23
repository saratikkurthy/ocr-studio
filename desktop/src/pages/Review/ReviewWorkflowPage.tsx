import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ReviewWorkflowPage.css";

type Project = { id: number; name: string; projectPath: string };
type Assignment = {
  id: string; documentId: number; documentName: string; reviewerName: string;
  status: string; priority: string; scope: string; pageStart: number | null;
  pageEnd: number | null; note: string; createdAt: string; updatedAt: string;
};
type Comment = { id: string; status: string; documentName: string; author: string; text: string; pageNumber: number | null };
type Row = Assignment & { projectId: number; projectName: string; projectPath: string; openComments: number };

const statuses = ["Assigned", "In Progress", "Needs Changes", "Completed", "Verified", "Published"];

export default function ReviewWorkflowPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true); setMessage("");
    try {
      const recent = await window.ocrStudio.listRecentProjects() as Project[];
      setProjects(recent);
      const all: Row[] = [];
      for (const project of recent) {
        const result = await window.ocrStudio.getReviewCollaboration({ projectPath: project.projectPath });
        const state = result?.state;
        if (!state) continue;
        for (const assignment of state.assignments || []) {
          const openComments = (state.comments || []).filter((c: Comment) =>
            c.status !== "Resolved" && c.documentId === assignment.documentId
          ).length;
          all.push({ ...assignment, projectId: project.id, projectName: project.name, projectPath: project.projectPath, openComments });
        }
      }
      all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      setRows(all);
      setMessage(all.length ? `Loaded ${all.length} review assignments across ${recent.length} projects.` : "No review assignments found yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load review workflow.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => rows.filter(row => {
    const statusMatch = filter === "All" || row.status === filter;
    const q = query.trim().toLowerCase();
    const textMatch = !q || `${row.projectName} ${row.documentName} ${row.reviewerName} ${row.priority}`.toLowerCase().includes(q);
    return statusMatch && textMatch;
  }), [rows, filter, query]);

  const metrics = useMemo(() => ({
    total: rows.length,
    active: rows.filter(r => ["Assigned", "In Progress", "Needs Changes"].includes(r.status)).length,
    completed: rows.filter(r => ["Completed", "Verified", "Published"].includes(r.status)).length,
    comments: rows.reduce((n, r) => n + r.openComments, 0),
  }), [rows]);

  async function changeStatus(row: Row, status: string) {
    setBusy(true);
    try {
      const result = await window.ocrStudio.updateReviewAssignment({ projectPath: row.projectPath, assignmentId: row.id, status });
      if (!result.success) throw new Error(result.message);
      setRows(current => current.map(item => item.id === row.id && item.projectPath === row.projectPath ? { ...item, status, updatedAt: new Date().toISOString() } : item));
      setMessage(`${row.documentName} changed to ${status}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Status update failed."); }
    finally { setBusy(false); }
  }

  async function exportProject(projectPath: string) {
    const result = await window.ocrStudio.exportReviewCollaborationReport({ projectPath });
    setMessage(result.message || (result.success ? "Review report exported." : "Export failed."));
  }

  return <div className="review-workflow-page">
    <div className="review-header">
      <div><p className="eyebrow">SCHOLARLY WORKFLOW</p><h2>Review Queue & Approvals</h2><p>Track assignments, reviewer progress, unresolved comments, and publication readiness across every project.</p></div>
      <button className="primary" onClick={() => void load()} disabled={busy}>{busy ? "Refreshing…" : "Refresh queue"}</button>
    </div>

    <div className="metric-grid">
      <article><strong>{metrics.total}</strong><span>Total assignments</span></article>
      <article><strong>{metrics.active}</strong><span>Awaiting action</span></article>
      <article><strong>{metrics.completed}</strong><span>Completed or approved</span></article>
      <article><strong>{metrics.comments}</strong><span>Open comments</span></article>
    </div>

    <div className="review-toolbar">
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search project, document, reviewer…" />
      <select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}</select>
    </div>

    {message && <div className="review-message">{message}</div>}

    <div className="review-table-wrap">
      <table className="review-table"><thead><tr><th>Project / Document</th><th>Reviewer</th><th>Scope</th><th>Priority</th><th>Comments</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{visible.map(row => <tr key={`${row.projectPath}-${row.id}`}>
        <td><b>{row.projectName}</b><span>{row.documentName}</span></td>
        <td>{row.reviewerName || "Unassigned"}</td>
        <td>{row.scope === "pages" ? `Pages ${row.pageStart}-${row.pageEnd}` : "Whole document"}</td>
        <td><span className={`priority ${String(row.priority).toLowerCase()}`}>{row.priority}</span></td>
        <td>{row.openComments}</td>
        <td><select value={row.status} onChange={e => void changeStatus(row, e.target.value)} disabled={busy}>{statuses.map(s => <option key={s}>{s}</option>)}</select></td>
        <td><div className="actions"><button onClick={() => navigate(`/projects/${row.projectId}`)}>Open</button><button onClick={() => void exportProject(row.projectPath)}>Export</button></div></td>
      </tr>)}</tbody></table>
      {!visible.length && <div className="empty-review">No assignments match the current filter. Create assignments from a project's Review tab.</div>}
    </div>

    <section className="workflow-guide"><h3>Approval workflow</h3><div><span>Assigned</span><i>→</i><span>In Progress</span><i>→</i><span>Needs Changes</span><i>or</i><span>Completed</span><i>→</i><span>Verified</span><i>→</i><span>Published</span></div></section>
  </div>;
}
