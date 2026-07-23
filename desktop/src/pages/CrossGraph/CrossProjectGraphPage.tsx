import { useEffect, useMemo, useState } from "react";
import "./CrossProjectGraphPage.css";

type Project = { id: number; name: string; projectPath: string; language?: string; graphExists?: boolean };
type Workspace = { projects: Project[]; store: any; analytics: any; workspacePath?: string };

export default function CrossProjectGraphPage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("Loading cross-project graph…");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"entities" | "variants" | "relationships" | "notes">("entities");
  const [filter, setFilter] = useState("");

  const load = async () => {
    const result = await window.ocrStudio.getCrossProjectGraphWorkspace();
    if (result?.success) { setData(result); setMessage("Ready"); }
    else setMessage(result?.message || "Could not load workspace graph.");
  };
  useEffect(() => { load(); }, []);

  const compare = async () => {
    setBusy(true);
    const result = await window.ocrStudio.compareCrossProjectGraphs({ projectIds: selected });
    setBusy(false);
    setMessage(result?.message || "Comparison finished.");
    if (result?.success) setData(result);
  };

  const decideLink = async (linkId: string, decision: string) => {
    const result = await window.ocrStudio.decideCrossProjectEntityLink({ linkId, decision, note: "" });
    setMessage(result?.message || "Updated."); if (result?.success) setData(result);
  };
  const reviewVariant = async (variantId: string, decision: string) => {
    const note = window.prompt("Optional scholarly note:", "") || "";
    const result = await window.ocrStudio.reviewCrossProjectVariant({ variantId, decision, note });
    setMessage(result?.message || "Updated."); if (result?.success) setData(result);
  };
  const addNote = async () => {
    const title = window.prompt("Note title:", "Comparison observation") || "";
    if (!title.trim()) return;
    const body = window.prompt("Scholarly note:", "") || "";
    const result = await window.ocrStudio.addCrossProjectComparisonNote({ title, body, comparisonId: data?.store?.comparisons?.[0]?.id || null });
    setMessage(result?.message || "Saved."); if (result?.success) setData(result);
  };
  const exportReport = async (format: "json" | "html") => {
    const result = await window.ocrStudio.exportCrossProjectComparison({ format });
    setMessage(result?.message || "Export finished.");
    if (result?.success && result.filePath) await window.ocrStudio.openCrossProjectComparisonFile(result.filePath);
  };

  const canonical = useMemo(() => {
    const q = filter.toLocaleLowerCase();
    return (data?.store?.canonicalEntities || []).filter((x: any) => !q || x.name?.toLocaleLowerCase().includes(q) || (x.aliases || []).some((a: string) => a.toLocaleLowerCase().includes(q)));
  }, [data, filter]);
  const linksByCanonical = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const link of data?.store?.projectLinks || []) { if (!map.has(link.canonicalId)) map.set(link.canonicalId, []); map.get(link.canonicalId)!.push(link); }
    return map;
  }, [data]);
  const latest = data?.store?.comparisons?.[0];

  return <div className="cross-page">
    <div className="cross-hero">
      <div><p className="eyebrow">PHASE 7.0D</p><h1>Cross-Project Graph & Manuscript Comparison</h1><p>Unify multilingual entities, compare evidence, and review variants across manuscripts.</p></div>
      <div className="hero-actions"><button onClick={() => exportReport("html")}>Export HTML</button><button onClick={() => exportReport("json")}>Export JSON</button></div>
    </div>

    <div className="metric-grid">
      <Metric label="Canonical entities" value={data?.analytics?.canonicalEntities || 0} />
      <Metric label="Project links" value={data?.analytics?.links || 0} />
      <Metric label="Shared entities" value={data?.analytics?.sharedEntities || 0} />
      <Metric label="Pending variants" value={data?.analytics?.pendingVariants || 0} />
    </div>

    <section className="panel project-picker">
      <div><h2>Select manuscripts</h2><p>Choose at least two projects that already contain knowledge-graph data.</p></div>
      <div className="project-list">
        {(data?.projects || []).map((project) => <label key={project.id} className={!project.graphExists ? "disabled" : ""}>
          <input type="checkbox" disabled={!project.graphExists} checked={selected.includes(project.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, project.id] : selected.filter((id) => id !== project.id))} />
          <span><strong>{project.name}</strong><small>{project.language || "Language not set"} · {project.graphExists ? "Graph ready" : "No graph yet"}</small></span>
        </label>)}
      </div>
      <button className="primary" disabled={busy || selected.length < 2} onClick={compare}>{busy ? "Comparing…" : `Compare ${selected.length} projects`}</button>
      <p className="status">{message}</p>
    </section>

    {latest && <div className="comparison-banner"><strong>Latest comparison:</strong> {latest.projectNames.join(" ↔ ")} · {latest.summary.canonicalEntities} entities · {latest.summary.variants} issues</div>}

    <div className="tabs">
      <button className={tab === "entities" ? "active" : ""} onClick={() => setTab("entities")}>Canonical Registry</button>
      <button className={tab === "relationships" ? "active" : ""} onClick={() => setTab("relationships")}>Relationship Evidence</button>
      <button className={tab === "variants" ? "active" : ""} onClick={() => setTab("variants")}>Variant Queue</button>
      <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Research Notes</button>
    </div>

    {tab === "entities" && <section className="panel"><div className="section-head"><div><h2>Canonical entity registry</h2><p>One identity can link aliases from several projects and languages.</p></div><input placeholder="Search entities or aliases" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
      <div className="entity-grid">{canonical.map((entity: any) => <article className="entity-card" key={entity.id}><div className="entity-title"><span>{entity.type}</span><h3>{entity.name}</h3></div><p className="aliases">{(entity.aliases || []).join(" · ") || "No aliases recorded"}</p><div className="source-links">{(linksByCanonical.get(entity.id) || []).map((link: any) => <div key={link.id}><div><strong>{link.entityName}</strong><small>{link.projectName} · score {Math.round((link.score || 0) * 100)}%</small></div><span className={`pill ${String(link.status).toLowerCase()}`}>{link.status}</span>{link.status === "Suggested" && <div className="inline-actions"><button onClick={() => decideLink(link.id, "Confirmed")}>Same entity</button><button onClick={() => decideLink(link.id, "Rejected")}>Different</button></div>}</div>)}</div></article>)}</div>
    </section>}

    {tab === "relationships" && <section className="panel"><h2>Side-by-side relationship evidence</h2><p>Claims are grouped by canonical entity pair while preserving their source manuscript evidence.</p><div className="relationship-list">{(latest?.relationshipGroups || []).map((group: any, i: number) => <article key={group.pair}><h3>Relationship group {i + 1}</h3>{group.evidence.map((e: any) => <div className="evidence" key={`${e.projectPath}-${e.id}`}><div><strong>{e.type}</strong><span>{e.projectName}</span></div><p>{e.evidence?.excerpt || e.evidence?.evidenceQuote || "No excerpt stored"}</p><small>{e.evidence?.documentName || "Document"} · page {e.evidence?.pageNumber || "?"} · {e.status}</small></div>)}</article>)}</div></section>}

    {tab === "variants" && <section className="panel"><h2>Variant and contradiction review</h2><div className="variant-list">{(data?.store?.variants || []).map((v: any) => <article key={v.id}><div><span className={`severity ${v.severity?.toLowerCase()}`}>{v.severity}</span><h3>{v.kind}</h3><p>{v.summary}</p>{v.note && <blockquote>{v.note}</blockquote>}</div><div><span className={`pill ${String(v.status).toLowerCase()}`}>{v.status}</span>{v.status === "Pending" && <div className="stack-actions"><button onClick={() => reviewVariant(v.id, "Confirmed Variant")}>Confirm variant</button><button onClick={() => reviewVariant(v.id, "Rejected")}>Reject</button><button onClick={() => reviewVariant(v.id, "Uncertain")}>Uncertain</button></div>}</div></article>)}</div></section>}

    {tab === "notes" && <section className="panel"><div className="section-head"><div><h2>Comparison notes</h2><p>Record editorial conclusions without altering source evidence.</p></div><button className="primary" onClick={addNote}>Add note</button></div><div className="notes">{(data?.store?.notes || []).map((n: any) => <article key={n.id}><h3>{n.title}</h3><p>{n.body || "No details"}</p><small>{new Date(n.createdAt).toLocaleString()}</small></article>)}</div></section>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
