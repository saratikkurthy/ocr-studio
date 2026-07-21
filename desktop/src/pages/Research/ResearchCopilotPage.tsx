import { useEffect, useMemo, useState } from "react";
import { getProjects } from "../../services/projectStorage";
import type { Collection } from "../../types/Collection";
import "./ResearchCopilotPage.css";

type Mode="research"|"compare"|"character"|"place"|"timeline"|"themes";
type Evidence={id:string;projectId:number;projectName:string;documentName:string;pageNumber:number;language:string;averageConfidence:number;snippet:string};
type Report={id:string;title:string;mode:Mode;question:string;content:string;evidence:Evidence[];model:string;createdAt:string};
type Summary={id:string;title:string;mode:Mode;createdAt:string;sourceCount:number};
const MODES:{id:Mode;icon:string;title:string;description:string;placeholder:string}[]=[
 {id:"research",icon:"⌘",title:"Research Brief",description:"Evidence-backed scholarly analysis",placeholder:"Explain Bhishma's teachings on kingship."},
 {id:"compare",icon:"⇄",title:"Compare Editions",description:"Find agreements, variants and omissions",placeholder:"Compare the Telugu and Sanskrit editions of this episode."},
 {id:"character",icon:"♙",title:"Character Profile",description:"Roles, speeches, relationships and themes",placeholder:"Build a source-backed profile of Vidura."},
 {id:"place",icon:"⌖",title:"Place Explorer",description:"Events, people and meanings tied to a place",placeholder:"Explain the importance of Kurukshetra across the manuscripts."},
 {id:"timeline",icon:"↦",title:"Timeline Builder",description:"Chronology with explicit confidence labels",placeholder:"Create a timeline of Arjuna's exile and return."},
 {id:"themes",icon:"✣",title:"Theme Analysis",description:"Recurring concepts and contrasting passages",placeholder:"Analyze surrender, duty and compassion across the library."},
];
export default function ResearchCopilotPage(){
 const [workspaces,setWorkspaces]=useState<string[]>([]),[workspacePath,setWorkspacePath]=useState("");
 const [collections,setCollections]=useState<Collection[]>([]),[collectionId,setCollectionId]=useState("");
 const [mode,setMode]=useState<Mode>("research"),[question,setQuestion]=useState("");
 const [reports,setReports]=useState<Summary[]>([]),[report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("Select a research tool and ask a manuscript question."),[exportPath,setExportPath]=useState("");
 const current=useMemo(()=>MODES.find(m=>m.id===mode)!,[mode]);
 useEffect(()=>{void getProjects().then(ps=>{const ws=[...new Set(ps.map(p=>p.workspacePath).filter(Boolean))] as string[];setWorkspaces(ws);if(ws[0])setWorkspacePath(ws[0]);});},[]);
 const refresh=async(ws=workspacePath)=>{if(!ws)return;const [c,r]=await Promise.all([window.ocrStudio.listCollections({workspacePath:ws}),window.ocrStudio.listResearchReports({workspacePath:ws})]);setCollections(c.collections||[]);setReports(r.reports||[])};
 useEffect(()=>{setReport(null);setExportPath("");void refresh(workspacePath)},[workspacePath]);
 const run=async()=>{if(!question.trim())return;setBusy(true);setMessage("Searching the manuscript index and composing a cited research report…");const r=await window.ocrStudio.runResearchCopilot({workspacePath,collectionId:collectionId||null,mode,question});setMessage(r.message);if(r.report){setReport(r.report);setQuestion("");await refresh()}setBusy(false)};
 const open=async(id:string)=>{const r=await window.ocrStudio.getResearchReport({workspacePath,reportId:id});if(r.report)setReport(r.report)};
 const remove=async(id:string)=>{await window.ocrStudio.deleteResearchReport({workspacePath,reportId:id});if(report?.id===id)setReport(null);await refresh()};
 const exportReport=async(format:"markdown"|"html"|"json")=>{if(!report)return;const r=await window.ocrStudio.exportResearchReport({workspacePath,reportId:report.id,format});setMessage(r.message);if(r.filePath)setExportPath(r.filePath)};
 return <div className="research-page">
  <header className="research-hero"><div><span>Phase 6E.2.5C · Scholarly Tools</span><h2>AI Research Copilot</h2><p>Turn indexed OCR evidence into rigorous briefs, comparisons, profiles and timelines.</p></div><div className="research-badge">Local-first · Citation backed</div></header>
  <section className="research-toolbar"><label>Workspace<select value={workspacePath} onChange={e=>setWorkspacePath(e.target.value)}>{workspaces.map(w=><option key={w}>{w}</option>)}</select></label><label>Collection<select value={collectionId} onChange={e=>setCollectionId(e.target.value)}><option value="">Entire workspace</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></section>
  <div className="research-grid">
   <aside className="research-tools"><h3>Research tools</h3>{MODES.map(m=><button key={m.id} className={mode===m.id?"active":""} onClick={()=>setMode(m.id)}><span>{m.icon}</span><div><strong>{m.title}</strong><small>{m.description}</small></div></button>)}</aside>
   <main className="research-workbench">
    <section className="research-query"><div className="query-heading"><span>{current.icon}</span><div><h3>{current.title}</h3><p>{current.description}</p></div></div><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder={current.placeholder}/><button disabled={busy||!workspacePath||!question.trim()} onClick={run}>{busy?"Researching…":"Generate cited report"}</button><p className="research-status">{message}</p></section>
    {report?<article className="research-report"><header><div><span>{MODES.find(m=>m.id===report.mode)?.title}</span><h2>{report.title}</h2><p>{report.model} · {report.evidence.length} sources · {new Date(report.createdAt).toLocaleString()}</p></div><div className="report-actions"><button onClick={()=>exportReport("markdown")}>Markdown</button><button onClick={()=>exportReport("html")}>HTML</button><button onClick={()=>exportReport("json")}>JSON</button></div></header><div className="report-content">{report.content}</div><details open><summary>Evidence dossier ({report.evidence.length})</summary>{report.evidence.map((e,i)=><div className="research-source" key={e.id}><b>[{i+1}] {e.projectName} › {e.documentName} › Page {e.pageNumber}</b><span>{e.language||"Unknown language"} · OCR {Number(e.averageConfidence||0).toFixed(1)}%</span><p>{e.snippet}</p></div>)}</details>{exportPath&&<button className="open-export" onClick={()=>window.ocrStudio.openResearchExport(exportPath)}>Open latest export</button>}</article>:<div className="research-empty"><div>✦</div><h3>Your research report will appear here</h3><p>The copilot retrieves manuscript passages first, then asks your local Ollama model to analyze only that evidence.</p></div>}
   </main>
   <aside className="research-library"><div className="library-title"><h3>Saved research</h3><span>{reports.length}</span></div>{reports.length===0?<p className="no-reports">No saved reports yet.</p>:reports.map(r=><div className={`saved-report ${report?.id===r.id?"active":""}`} key={r.id}><button onClick={()=>open(r.id)}><strong>{r.title}</strong><small>{MODES.find(m=>m.id===r.mode)?.title} · {r.sourceCount} sources</small></button><button className="delete-report" onClick={()=>remove(r.id)}>×</button></div>)}</aside>
  </div>
 </div>
}
