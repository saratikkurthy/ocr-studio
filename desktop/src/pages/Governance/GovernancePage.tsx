import { useEffect, useMemo, useState } from "react";
import "./GovernancePage.css";

type ProjectSummary = {
  projectId: number; projectName: string; projectPath: string; assignments: number;
  signatures: number; invalidSignatures: number; publications: number; ready: number;
};
type Assignment = {
  id: string; documentName: string; reviewerName: string; status: string; priority: string;
  signatures: Array<{ id: string; reviewer: string; signedAt: string; valid: boolean }>;
  blockers: string[];
};
type Policy = { requiredApprovals: number; blockUnresolvedComments: boolean; requireVerifiedStatus: boolean; requirePublicationNote: boolean; lockAfterPublication: boolean };

export default function GovernancePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [policy, setPolicy] = useState<Policy>({ requiredApprovals: 1, blockUnresolvedComments: true, requireVerifiedStatus: true, requirePublicationNote: true, lockAfterPublication: true });
  const [totals, setTotals] = useState({ projects: 0, ready: 0, signatures: 0, invalid: 0, published: 0 });
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [actor, setActor] = useState("Editor"); const [note, setNote] = useState("");
  const selected = useMemo(() => projects.find(p => p.projectPath === selectedPath), [projects, selectedPath]);

  async function loadWorkspace() {
    setBusy(true);
    try {
      const result = await window.ocrStudio.getGovernanceWorkspace();
      if (!result.success) throw new Error(result.message);
      setProjects(result.projects || []); setTotals(result.totals);
      const next = selectedPath || result.projects?.[0]?.projectPath || ""; setSelectedPath(next);
      if (next) await loadProject(next);
      setMessage(result.message);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load governance."); }
    finally { setBusy(false); }
  }
  async function loadProject(projectPath: string) {
    const result = await window.ocrStudio.getProjectGovernance({ projectPath });
    if (!result.success) throw new Error(result.message);
    setAssignments(result.assignments || []); setPolicy(result.state.policy);
  }
  useEffect(() => { void loadWorkspace(); }, []);
  async function choose(path: string) { setSelectedPath(path); setBusy(true); try { await loadProject(path); } catch (e) { setMessage(String(e)); } finally { setBusy(false); } }
  async function savePolicy() {
    setBusy(true); const result = await window.ocrStudio.saveGovernancePolicy({ projectPath: selectedPath, policy });
    setMessage(result.message); setBusy(false);
  }
  async function sign(item: Assignment) {
    setBusy(true); const reviewer = window.prompt("Reviewer name", item.reviewerName || actor) || "";
    if (reviewer) { const comment = window.prompt("Approval comment", "Reviewed and approved.") || ""; const result = await window.ocrStudio.signGovernanceApproval({ projectPath: selectedPath, assignmentId: item.id, reviewer, role: "Reviewer", comment }); setMessage(result.message); await loadProject(selectedPath); }
    setBusy(false);
  }
  async function publish(item: Assignment) {
    setBusy(true); const result = await window.ocrStudio.publishGovernedAssignment({ projectPath: selectedPath, assignmentId: item.id, actor, note });
    setMessage(result.success ? result.message : `${result.message} ${(result.blockers || []).join(" ")}`); await loadProject(selectedPath); setBusy(false);
  }
  async function scan() {
    setBusy(true); const result = await window.ocrStudio.scanGovernanceIntegrity({ projectPath: selectedPath }); setMessage(`${result.message} Health score: ${result.report?.score ?? "—"}`); await loadWorkspace(); setBusy(false);
  }
  return <div className="governance-page">
    <div className="gov-header"><div><p className="eyebrow">SCHOLARLY GOVERNANCE</p><h2>Governance, Signatures & Publication</h2><p>Protect approved OCR revisions with tamper-evident signatures, publication rules, integrity scans, and auditable releases.</p></div><button className="primary" onClick={() => void loadWorkspace()} disabled={busy}>{busy ? "Working…" : "Refresh"}</button></div>
    <div className="gov-metrics"><article><strong>{totals.projects}</strong><span>Governed projects</span></article><article><strong>{totals.ready}</strong><span>Ready to publish</span></article><article><strong>{totals.signatures}</strong><span>Valid signatures</span></article><article><strong>{totals.invalid}</strong><span>Invalid signatures</span></article><article><strong>{totals.published}</strong><span>Published records</span></article></div>
    <div className="gov-grid">
      <aside className="project-list"><h3>Projects</h3>{projects.map(p => <button className={p.projectPath === selectedPath ? "active" : ""} onClick={() => void choose(p.projectPath)} key={p.projectPath}><b>{p.projectName}</b><span>{p.signatures} signatures · {p.publications} published</span></button>)}</aside>
      <main className="gov-main">
        {selected && <><section className="policy-card"><div className="section-title"><div><h3>Publication policy</h3><p>{selected.projectName}</p></div><button onClick={() => void scan()} disabled={busy}>Run integrity scan</button></div>
          <div className="policy-grid"><label>Required approvals<input type="number" min="1" max="5" value={policy.requiredApprovals} onChange={e => setPolicy({ ...policy, requiredApprovals: Number(e.target.value) })}/></label>
          <label><input type="checkbox" checked={policy.blockUnresolvedComments} onChange={e => setPolicy({ ...policy, blockUnresolvedComments: e.target.checked })}/> Block unresolved comments</label>
          <label><input type="checkbox" checked={policy.requireVerifiedStatus} onChange={e => setPolicy({ ...policy, requireVerifiedStatus: e.target.checked })}/> Require Verified status</label>
          <label><input type="checkbox" checked={policy.requirePublicationNote} onChange={e => setPolicy({ ...policy, requirePublicationNote: e.target.checked })}/> Require publication note</label>
          <label><input type="checkbox" checked={policy.lockAfterPublication} onChange={e => setPolicy({ ...policy, lockAfterPublication: e.target.checked })}/> Lock after publication</label></div><button className="primary small" onClick={() => void savePolicy()}>Save policy</button></section>
          <section className="publication-card"><h3>Publication identity</h3><div className="publication-inputs"><input value={actor} onChange={e => setActor(e.target.value)} placeholder="Editor name"/><input value={note} onChange={e => setNote(e.target.value)} placeholder="Publication note"/></div></section>
          <section className="assignment-card"><h3>Approval assignments</h3>{assignments.length === 0 ? <p className="empty">No review assignments exist in this project.</p> : assignments.map(a => <article className="assignment" key={a.id}><div><h4>{a.documentName}</h4><p>{a.reviewerName || "Unassigned"} · {a.status} · {a.priority}</p><div className="signature-row">{a.signatures.map(s => <span className={s.valid ? "valid" : "invalid"} key={s.id}>{s.valid ? "✓" : "!"} {s.reviewer}</span>)}</div>{a.blockers.length > 0 && <ul>{a.blockers.map(b => <li key={b}>{b}</li>)}</ul>}</div><div className="assignment-actions"><button onClick={() => void sign(a)} disabled={busy}>Sign approval</button><button className="primary" onClick={() => void publish(a)} disabled={busy}>Publish</button></div></article>)}</section></>}
      </main>
    </div>{message && <div className="gov-message">{message}</div>}
  </div>;
}
