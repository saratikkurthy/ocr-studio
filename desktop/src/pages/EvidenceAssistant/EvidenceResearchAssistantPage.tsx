import { useEffect, useMemo, useState } from "react";
import { getProjects } from "../../services/projectStorage";
import type { Collection } from "../../types/Collection";
import "./EvidenceResearchAssistantPage.css";

type Evidence={id:string;projectName:string;documentName:string;pageNumber:number;language?:string;averageConfidence?:number;snippet:string;projectPath?:string};
type Confidence={score:number;label:"High"|"Medium"|"Low";citedEvidenceCount:number;totalEvidenceCount:number;averageOcrConfidence:number};
type Message={id:string;role:"user"|"assistant";content:string;createdAt:string;evidence?:Evidence[];confidence?:Confidence;model?:string;suggestions?:string[]};
type Session={id:string;title:string;scope:string;scopeId?:string|null;createdAt:string;updatedAt:string;messages:Message[]};
type SessionSummary={id:string;title:string;scope:string;updatedAt:string;messageCount:number};
type ScopeItem={id:string;title:string};

export default function EvidenceResearchAssistantPage(){
 const [workspaces,setWorkspaces]=useState<string[]>([]),[workspacePath,setWorkspacePath]=useState("");
 const [collections,setCollections]=useState<Collection[]>([]),[collectionId,setCollectionId]=useState("");
 const [scope,setScope]=useState<"workspace"|"notebook"|"canvas">("workspace"),[scopeId,setScopeId]=useState("");
 const [notebooks,setNotebooks]=useState<ScopeItem[]>([]),[canvases,setCanvases]=useState<ScopeItem[]>([]);
 const [sessions,setSessions]=useState<SessionSummary[]>([]),[session,setSession]=useState<Session|null>(null);
 const [question,setQuestion]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("Ask a question grounded only in your indexed manuscript evidence."),[exportPath,setExportPath]=useState("");
 const activeScopeItems=useMemo(()=>scope==="notebook"?notebooks:scope==="canvas"?canvases:[],[scope,notebooks,canvases]);
 useEffect(()=>{void getProjects().then(ps=>{const ws=[...new Set(ps.map(p=>p.workspacePath).filter(Boolean))] as string[];setWorkspaces(ws);if(ws[0])setWorkspacePath(ws[0]);});},[]);
 const refresh=async(ws=workspacePath)=>{if(!ws)return;const [c,s,sc]=await Promise.all([window.ocrStudio.listCollections({workspacePath:ws}),window.ocrStudio.listEvidenceResearchSessions({workspacePath:ws}),window.ocrStudio.listEvidenceResearchScopes({workspacePath:ws})]);setCollections(c.collections||[]);setSessions(s.sessions||[]);setNotebooks(sc.notebooks||[]);setCanvases(sc.canvases||[])};
 useEffect(()=>{setSession(null);setScope("workspace");setScopeId("");setExportPath("");void refresh(workspacePath)},[workspacePath]);
 useEffect(()=>{if(scope==="workspace")setScopeId("");else if(!activeScopeItems.some(x=>x.id===scopeId))setScopeId(activeScopeItems[0]?.id||"")},[scope,activeScopeItems,scopeId]);
 const ask=async(text=question)=>{const q=text.trim();if(!q||!workspacePath)return;setBusy(true);setMessage("Retrieving manuscript evidence and asking the local model…");const history=session?.messages.map(m=>({role:m.role,content:m.content}))||[];const r=await window.ocrStudio.askEvidenceResearchAssistant({workspacePath,collectionId:collectionId||null,sessionId:session?.id||null,scope,scopeId:scopeId||null,question:q,history});setMessage(r.message);if(r.session){setSession(r.session);setQuestion("");await refresh()}setBusy(false)};
 const open=async(id:string)=>{const r=await window.ocrStudio.getEvidenceResearchSession({workspacePath,sessionId:id});if(r.session)setSession(r.session)};
 const remove=async(id:string)=>{await window.ocrStudio.deleteEvidenceResearchSession({workspacePath,sessionId:id});if(session?.id===id)setSession(null);await refresh()};
 const exportSession=async()=>{if(!session)return;const r=await window.ocrStudio.exportEvidenceResearchSession({workspacePath,sessionId:session.id});setMessage(r.message);if(r.filePath)setExportPath(r.filePath)};
 return <div className="era-page">
  <header className="era-hero"><div><span>Phase 8.0D · Local AI</span><h2>Evidence-Grounded Research Assistant</h2><p>Answers are restricted to indexed OCR evidence and every factual claim must cite its source.</p></div><div className="era-shield">🛡 Hallucination guard</div></header>
  <section className="era-toolbar"><label>Workspace<select value={workspacePath} onChange={e=>setWorkspacePath(e.target.value)}>{workspaces.map(w=><option key={w}>{w}</option>)}</select></label><label>Collection<select value={collectionId} onChange={e=>setCollectionId(e.target.value)}><option value="">Entire workspace</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Scope<select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="workspace">Entire workspace</option><option value="notebook">Research notebook</option><option value="canvas">Research canvas</option></select></label>{scope!=="workspace"&&<label>Selected {scope}<select value={scopeId} onChange={e=>setScopeId(e.target.value)}>{activeScopeItems.length===0?<option value="">No {scope}s found</option>:activeScopeItems.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>}</section>
  <div className="era-grid">
   <aside className="era-sessions"><div className="era-side-title"><h3>Research sessions</h3><button onClick={()=>setSession(null)}>＋</button></div>{sessions.length===0?<p>No saved sessions yet.</p>:sessions.map(s=><div className={`era-session ${session?.id===s.id?"active":""}`} key={s.id}><button onClick={()=>open(s.id)}><strong>{s.title}</strong><small>{s.scope} · {s.messageCount} messages</small></button><button onClick={()=>remove(s.id)}>×</button></div>)}</aside>
   <main className="era-chat">
    <section className="era-messages">{!session?<div className="era-empty"><div>✦</div><h3>Ask your verified corpus</h3><p>Try: “Compare how two editions describe Dharma” or “Which passages contradict one another?”</p></div>:session.messages.map(m=><article className={`era-message ${m.role}`} key={m.id}><header><b>{m.role==="user"?"Researcher":"OCR Studio Assistant"}</b>{m.model&&<span>{m.model}</span>}</header><div className="era-content">{m.content}</div>{m.confidence&&<div className={`era-confidence ${m.confidence.label.toLowerCase()}`}><strong>{m.confidence.score}% {m.confidence.label} confidence</strong><span>{m.confidence.citedEvidenceCount} cited of {m.confidence.totalEvidenceCount} retrieved · OCR average {m.confidence.averageOcrConfidence}%</span></div>}{m.evidence&&m.evidence.length>0&&<details><summary>Evidence dossier ({m.evidence.length})</summary>{m.evidence.map((e,i)=><div className="era-evidence" key={`${e.id}-${i}`}><b>[{i+1}] {e.projectName} › {e.documentName} › Page {e.pageNumber}</b><span>{e.language||"Unknown language"} · OCR {Number(e.averageConfidence||0).toFixed(1)}%</span><p>{e.snippet}</p>{e.projectPath&&<button onClick={()=>window.ocrStudio.openPath(e.projectPath!)}>Open source project</button>}</div>)}</details>}{m.suggestions&&m.suggestions.length>0&&<div className="era-suggestions">{m.suggestions.map(s=><button key={s} disabled={busy} onClick={()=>ask(s)}>{s}</button>)}</div>}</article>)}</section>
    <section className="era-composer"><textarea value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();void ask()}}} placeholder="Ask a corpus question. Ctrl+Enter to send."/><div><span>{message}</span><button disabled={busy||!workspacePath||!question.trim()} onClick={()=>ask()}>{busy?"Analyzing…":"Ask with evidence"}</button></div></section>
    {session&&<div className="era-export"><button onClick={exportSession}>Export session as Markdown</button>{exportPath&&<button onClick={()=>window.ocrStudio.openEvidenceResearchExport(exportPath)}>Open export</button>}</div>}
   </main>
  </div>
 </div>
}
