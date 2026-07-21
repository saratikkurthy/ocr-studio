import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateProjectModal from "../../components/CreateProjectModal";
import { addProject, getProjects } from "../../services/projectStorage";
import type { Project } from "../../services/projectStorage";
import "./DashboardPage.css";

type Dashboard = {
  generatedAt: string;
  workspacePath: string;
  summary: Record<string, number>;
  projects: Array<Record<string, any>>;
  activities: Array<{ type: string; projectId: number; projectName: string; detail: string; timestamp: string }>;
  riskProjects: Array<Record<string, any>>;
  languages: Array<{ language: string; count: number }>;
  throughput: Array<{ date: string; completed: number }>;
};

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
function healthTone(score = 0) { return score >= 80 ? "good" : score >= 60 ? "watch" : "risk"; }

export default function DashboardPage() {
  const navigate = useNavigate();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const workspaces = useMemo(() => Array.from(new Set(projects.map(p => p.workspacePath).filter(Boolean))) as string[], [projects]);

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
    setWorkspacePath(current => current || data.find(p => p.workspacePath)?.workspacePath || "");
  };

  const loadDashboard = async (target = workspacePath) => {
    if (!window.ocrStudio?.getWorkspaceIntelligence) { setLoading(false); return; }
    setLoading(true);
    const result = await window.ocrStudio.getWorkspaceIntelligence({ workspacePath: target });
    if (result.success) setDashboard(result.dashboard);
    else setMessage(result.message || "Could not load workspace intelligence.");
    setLoading(false);
  };

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (workspacePath) loadDashboard(workspacePath); else if (projects.length === 0) setLoading(false); }, [workspacePath, projects.length]);

  const handleCreateProject = async (project: any) => { await addProject(project); await loadProjects(); };
  const exportSnapshot = async () => {
    if (!workspacePath) return;
    const result = await window.ocrStudio.exportWorkspaceIntelligence({ workspacePath });
    setMessage(result.message);
  };

  const s = dashboard?.summary || {};
  const maxThroughput = Math.max(1, ...(dashboard?.throughput || []).map(item => item.completed));

  return (
    <div className="intel-page">
      <section className="intel-heading">
        <div>
          <span className="intel-kicker">PHASE 6E.2.4 · WORKSPACE INTELLIGENCE</span>
          <h1>Digitization Mission Control</h1>
          <p>Live health, OCR quality, review progress, publishing, storage, and risk signals across your library.</p>
        </div>
        <div className="intel-actions">
          {workspaces.length > 0 && <select value={workspacePath} onChange={e => setWorkspacePath(e.target.value)}>{workspaces.map(item => <option key={item} value={item}>{item}</option>)}</select>}
          <button className="secondary" onClick={() => loadDashboard()}>↻ Refresh</button>
          <button className="secondary" onClick={exportSnapshot}>⇩ Snapshot</button>
          <button className="primary" onClick={() => setShowCreateProject(true)}>＋ New Project</button>
        </div>
      </section>

      {message && <div className="intel-message" onClick={() => setMessage("")}>{message}</div>}
      {loading ? <div className="intel-loading">Building workspace intelligence…</div> : !dashboard ? (
        <div className="intel-empty"><h2>Your mission control is ready</h2><p>Create a project or choose a workspace to activate live analytics.</p><button className="primary" onClick={() => setShowCreateProject(true)}>Create first project</button></div>
      ) : <>
        <section className="health-banner">
          <div className={`health-ring ${healthTone(s.healthScore)}`} style={{ "--score": `${s.healthScore * 3.6}deg` } as React.CSSProperties}><div><strong>{s.healthScore}</strong><span>Health</span></div></div>
          <div className="health-copy"><h2>{s.healthScore >= 80 ? "Workspace is healthy" : s.healthScore >= 60 ? "Workspace needs attention" : "Critical issues need review"}</h2><p>{s.projects} projects · {s.documents} documents · {compact.format(s.totalWords || 0)} indexed words</p></div>
          <div className="health-signals">
            <button onClick={() => navigate("/duplicates")}><strong>{s.duplicateMatches}</strong><span>Duplicate matches</span></button>
            <button onClick={() => navigate("/jobs")}><strong>{s.runningJobs + s.pendingJobs}</strong><span>Active queue</span></button>
            <button onClick={() => navigate("/projects")}><strong>{s.failedDocuments}</strong><span>Failed documents</span></button>
          </div>
        </section>

        <section className="intel-cards">
          <article><span>📚 Library</span><strong>{s.projects}</strong><p>{s.collections} collections · {s.documents} documents</p></article>
          <article><span>⚙ OCR Throughput</span><strong>{s.conversionRate}%</strong><p>{s.converted} converted · {s.pendingJobs} waiting</p></article>
          <article><span>◎ OCR Quality</span><strong>{s.averageConfidence}%</strong><p>{compact.format(s.lowConfidenceWords || 0)} low-confidence words</p></article>
          <article><span>✓ Human Review</span><strong>{s.reviewProgress}%</strong><p>{compact.format(s.reviewedWords || 0)} of {compact.format(s.totalWords || 0)} words</p></article>
          <article><span>⇧ Publishing</span><strong>{s.publishedItems}</strong><p>{s.pendingPublications} awaiting publication</p></article>
          <article><span>◫ Storage</span><strong>{formatBytes(s.storageBytes)}</strong><p>{s.indexedPages} indexed pages</p></article>
        </section>

        <section className="intel-grid">
          <article className="intel-panel throughput-panel">
            <header><div><h2>7-day OCR throughput</h2><p>Completed OCR activity</p></div><button onClick={() => navigate("/jobs")}>Open jobs →</button></header>
            <div className="throughput-chart">{dashboard.throughput.map(item => <div className="throughput-day" key={item.date}><span className="bar-value">{item.completed}</span><div className="bar-track"><div style={{ height: `${Math.max(5, item.completed / maxThroughput * 100)}%` }} /></div><small>{new Date(item.date).toLocaleDateString(undefined,{weekday:"short"})}</small></div>)}</div>
          </article>

          <article className="intel-panel quality-panel">
            <header><div><h2>Quality and review</h2><p>Word-level readiness</p></div><button onClick={() => navigate("/search")}>Search library →</button></header>
            <div className="progress-row"><span>Average confidence</span><strong>{s.averageConfidence}%</strong><div><i style={{ width: `${s.averageConfidence}%` }} /></div></div>
            <div className="progress-row"><span>Review completion</span><strong>{s.reviewProgress}%</strong><div><i style={{ width: `${s.reviewProgress}%` }} /></div></div>
            <div className="quality-numbers"><div><strong>{compact.format(s.correctedWords || 0)}</strong><span>Corrected</span></div><div><strong>{s.openComments}</strong><span>Open comments</span></div><div><strong>{s.activeAssignments}</strong><span>Assignments</span></div></div>
          </article>

          <article className="intel-panel projects-panel">
            <header><div><h2>Project health</h2><p>Prioritized by recent activity</p></div><button onClick={() => navigate("/projects")}>All projects →</button></header>
            <div className="project-health-list">{dashboard.projects.slice(0,6).map(project => <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><div className={`mini-score ${healthTone(project.healthScore)}`}>{project.healthScore}</div><div><strong>{project.name}</strong><span>{project.documentCount} docs · {project.averageConfidence}% confidence · {formatBytes(project.storageBytes)}</span></div><em>{project.failed ? `${project.failed} failed` : "Healthy"}</em></button>)}</div>
          </article>

          <article className="intel-panel activity-panel">
            <header><div><h2>Recent activity</h2><p>Across the workspace</p></div><span>Updated {new Date(dashboard.generatedAt).toLocaleTimeString()}</span></header>
            <div className="activity-list">{dashboard.activities.length === 0 ? <p className="muted">No activity recorded yet.</p> : dashboard.activities.map((item,index) => <button key={`${item.timestamp}-${index}`} onClick={() => navigate(`/projects/${item.projectId}`)}><i>{item.type === "ocr" ? "⚙" : item.type === "publish" ? "⇧" : "▤"}</i><div><strong>{item.projectName}</strong><span>{item.detail}</span></div><time>{new Date(item.timestamp).toLocaleString()}</time></button>)}</div>
          </article>

          <article className="intel-panel risk-panel">
            <header><div><h2>Attention required</h2><p>Projects with quality or workflow risks</p></div></header>
            {dashboard.riskProjects.length === 0 ? <div className="all-clear">✓ No critical workspace risks detected.</div> : <div className="risk-list">{dashboard.riskProjects.map(project => <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><strong>{project.name}</strong><span>{project.failed ? `${project.failed} failed documents` : project.averageConfidence < 60 ? `Low confidence: ${project.averageConfidence}%` : `${project.openComments} unresolved comments`}</span><em>Review →</em></button>)}</div>}
          </article>

          <article className="intel-panel language-panel">
            <header><div><h2>Language portfolio</h2><p>Project distribution</p></div></header>
            <div className="language-list">{dashboard.languages.map(item => <div key={item.language}><span>{item.language || "Unknown"}</span><div><i style={{ width: `${item.count / Math.max(1,s.projects) * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div>
          </article>
        </section>
      </>}

      <CreateProjectModal open={showCreateProject} onClose={() => setShowCreateProject(false)} onCreate={handleCreateProject} />
    </div>
  );
}
