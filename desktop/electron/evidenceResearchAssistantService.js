import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import crypto from "crypto";
import { searchManuscriptPassages } from "./manuscriptIndexService.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:3b";

function readJson(filePath, fallback) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : fallback; }
  catch { return fallback; }
}
function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function storePath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "ai", "research-assistant.json"); }
function settingsPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "assistant-settings.json"); }
function notebookPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "research", "notebooks.json"); }
function canvasPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "research-canvases", "canvases.json"); }
function loadStore(workspacePath) {
  const raw = readJson(storePath(workspacePath), { version: 1, sessions: [] });
  return { version: 1, sessions: Array.isArray(raw?.sessions) ? raw.sessions : [] };
}
function saveStore(workspacePath, store) {
  const target = storePath(workspacePath); ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(store, null, 2), "utf-8");
}
function loadSettings(workspacePath) {
  return { endpoint: DEFAULT_ENDPOINT, model: DEFAULT_MODEL, temperature: 0.15, evidenceLimit: 12, ...readJson(settingsPath(workspacePath), {}) };
}
function requestJson(urlString, body, timeout = 240000) {
  return new Promise((resolve, reject) => {
    let url; try { url = new URL(urlString); } catch { reject(new Error("Invalid Ollama endpoint.")); return; }
    const payload = JSON.stringify(body); const transport = url.protocol === "https:" ? https : http;
    const req = transport.request({ protocol:url.protocol, hostname:url.hostname, port:url.port || (url.protocol === "https:" ? 443 : 80), path:`${url.pathname}${url.search}`, method:"POST", timeout,
      headers:{ Accept:"application/json", "Content-Type":"application/json", "Content-Length":Buffer.byteLength(payload) } }, res => {
      let raw=""; res.setEncoding("utf-8"); res.on("data", c => raw += c); res.on("end", () => {
        if ((res.statusCode || 500) >= 400) return reject(new Error(`Ollama returned HTTP ${res.statusCode}: ${raw.slice(0,300)}`));
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Ollama returned invalid JSON.")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Research assistant request timed out.")));
    req.on("error", reject); req.write(payload); req.end();
  });
}
function compactSession(session) {
  return { id:session.id, title:session.title, scope:session.scope, createdAt:session.createdAt, updatedAt:session.updatedAt, messageCount:session.messages?.length || 0 };
}
function loadScopeContext(workspacePath, scope, scopeId) {
  if (scope === "notebook" && scopeId) {
    const raw = readJson(notebookPath(workspacePath), { notebooks: [] });
    const item = (raw.notebooks || []).find(n => n.id === scopeId);
    if (item) return { label:`Notebook: ${item.title}`, text:[item.description, item.content, ...(item.evidence || []).map(e => `${e.title || e.type}: ${e.excerpt || e.notes || ""}`)].filter(Boolean).join("\n").slice(0,12000) };
  }
  if (scope === "canvas" && scopeId) {
    const raw = readJson(canvasPath(workspacePath), { canvases: [] });
    const item = (raw.canvases || []).find(c => c.id === scopeId);
    if (item) return { label:`Canvas: ${item.title}`, text:(item.cards || []).map(c => `${c.title || c.type}: ${c.content || c.excerpt || ""}`).join("\n").slice(0,12000) };
  }
  return { label:"Entire workspace", text:"" };
}
function evidenceText(items) {
  return items.map((r,i)=>`[${i+1}] ${r.projectName} > ${r.documentName} > Page ${r.pageNumber}\nLanguage: ${r.language || "unknown"}; OCR confidence: ${Number(r.averageConfidence || 0).toFixed(1)}%\n${r.snippet}`).join("\n\n");
}
function calculateConfidence(items, answer) {
  const cited = new Set([...String(answer).matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])).filter(n => n >= 1 && n <= items.length));
  const averageOcr = items.length ? items.reduce((s,x)=>s+Number(x.averageConfidence || 0),0)/items.length : 0;
  const coverage = items.length ? cited.size / Math.min(items.length, 8) : 0;
  const score = Math.max(5, Math.min(98, Math.round((Math.min(items.length,12)/12)*35 + (averageOcr/100)*35 + Math.min(1,coverage)*30)));
  return { score, label: score >= 80 ? "High" : score >= 55 ? "Medium" : "Low", citedEvidenceCount:cited.size, totalEvidenceCount:items.length, averageOcrConfidence:Number(averageOcr.toFixed(1)) };
}
function suggestionsFromEvidence(items) {
  const projects=[...new Set(items.map(x=>x.projectName).filter(Boolean))];
  const docs=[...new Set(items.map(x=>x.documentName).filter(Boolean))];
  const result=[];
  if(projects.length>1) result.push(`Where do ${projects.slice(0,2).join(" and ")} agree or differ?`);
  if(docs.length) result.push(`What themes recur in ${docs[0]}?`);
  result.push("Which claims are weakly supported or ambiguous in the retrieved evidence?");
  result.push("Create a chronological outline from the cited passages.");
  return result.slice(0,4);
}

export function registerEvidenceResearchAssistantIpc({ ipcMain, shell }) {
  ipcMain.handle("evidenceAssistant:listSessions", async (_e, data) => {
    const store=loadStore(String(data?.workspacePath||""));
    return { success:true, sessions:store.sessions.map(compactSession).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))) };
  });
  ipcMain.handle("evidenceAssistant:getSession", async (_e, data) => {
    const session=loadStore(String(data?.workspacePath||"")).sessions.find(s=>s.id===String(data?.sessionId||"")) || null;
    return { success:Boolean(session), session };
  });
  ipcMain.handle("evidenceAssistant:deleteSession", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const store=loadStore(workspacePath);
    store.sessions=store.sessions.filter(s=>s.id!==String(data?.sessionId||"")); saveStore(workspacePath,store);
    return { success:true, message:"Research session deleted." };
  });
  ipcMain.handle("evidenceAssistant:listScopes", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||"");
    const notebooks=readJson(notebookPath(workspacePath),{notebooks:[]}).notebooks || [];
    const canvases=readJson(canvasPath(workspacePath),{canvases:[]}).canvases || [];
    return { success:true, notebooks:notebooks.map(x=>({id:x.id,title:x.title})), canvases:canvases.map(x=>({id:x.id,title:x.title})) };
  });
  ipcMain.handle("evidenceAssistant:ask", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const question=String(data?.question||"").trim();
    if(!workspacePath || !question) return {success:false,message:"Workspace and question are required."};
    const scope=String(data?.scope||"workspace"); const scopeId=data?.scopeId ? String(data.scopeId) : null;
    const settings={...loadSettings(workspacePath),...(data?.settings||{})};
    const search=searchManuscriptPassages({workspacePath,collectionId:data?.collectionId?String(data.collectionId):null,query:question,limit:Math.min(Math.max(Number(settings.evidenceLimit)||12,5),20)});
    const evidence=search.success ? (search.results || []).slice(0,20) : [];
    if(!evidence.length) return {success:false,refused:true,message:"I could not find sufficient indexed manuscript evidence to answer this question. Build or refresh the manuscript index, or ask a narrower question.",evidence:[]};
    const scopeContext=loadScopeContext(workspacePath,scope,scopeId);
    const previous=Array.isArray(data?.history) ? data.history.slice(-6).map(m=>({role:m.role,content:String(m.content||"").slice(0,2500)})) : [];
    const system=`You are OCR Studio's evidence-grounded research assistant. Use ONLY the supplied manuscript evidence and optional notebook/canvas context. Every factual claim must cite one or more evidence numbers like [1]. Never invent a source. Distinguish explicit evidence from inference. Mention OCR ambiguity. If the evidence is insufficient, say so directly. End with a short section titled \"Evidence limits\".`;
    const user=`Research scope: ${scopeContext.label}\n\nQuestion:\n${question}\n\nOptional scope context:\n${scopeContext.text || "No additional notebook or canvas context."}\n\nIndexed manuscript evidence:\n${evidenceText(evidence)}`;
    try {
      const response=await requestJson(`${String(settings.endpoint||DEFAULT_ENDPOINT).replace(/\/$/,"")}/api/chat`,{model:settings.model||DEFAULT_MODEL,stream:false,messages:[{role:"system",content:system},...previous,{role:"user",content:user}],options:{temperature:Number(settings.temperature??0.15),num_ctx:8192}});
      const answer=String(response?.message?.content||"").trim(); if(!answer) throw new Error("The model returned an empty answer.");
      const confidence=calculateConfidence(evidence,answer); const now=new Date().toISOString();
      const store=loadStore(workspacePath); let session=store.sessions.find(s=>s.id===String(data?.sessionId||""));
      if(!session){session={id:crypto.randomUUID(),title:question.length>64?question.slice(0,64)+"…":question,scope,scopeId,createdAt:now,updatedAt:now,messages:[]};store.sessions.push(session);}
      session.scope=scope; session.scopeId=scopeId; session.updatedAt=now;
      session.messages.push({id:crypto.randomUUID(),role:"user",content:question,createdAt:now});
      session.messages.push({id:crypto.randomUUID(),role:"assistant",content:answer,createdAt:now,evidence,confidence,model:settings.model||DEFAULT_MODEL,suggestions:suggestionsFromEvidence(evidence)});
      saveStore(workspacePath,store);
      return {success:true,message:"Evidence-grounded answer generated.",session,answer,evidence,confidence,suggestions:suggestionsFromEvidence(evidence)};
    } catch(error) { return {success:false,message:`Research assistant could not answer. ${error instanceof Error?error.message:String(error)}`,evidence}; }
  });
  ipcMain.handle("evidenceAssistant:exportSession", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const session=loadStore(workspacePath).sessions.find(s=>s.id===String(data?.sessionId||""));
    if(!session) return {success:false,message:"Research session not found."};
    const dir=path.join(workspacePath,".ocr-studio","ai","exports");ensureDir(dir);
    const safe=session.title.replace(/[^a-z0-9\-_]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,80)||"research-session";
    const filePath=path.join(dir,`${safe}.md`);
    const body=session.messages.map(m=>`## ${m.role === "user" ? "Researcher" : "Assistant"}\n\n${m.content}\n${m.confidence?`\n**Confidence:** ${m.confidence.score}% (${m.confidence.label})\n`:""}${m.evidence?.length?`\n### Evidence\n${m.evidence.map((e,i)=>`${i+1}. ${e.projectName} — ${e.documentName}, page ${e.pageNumber}\n   ${e.snippet}`).join("\n")}\n`:""}`).join("\n\n");
    fs.writeFileSync(filePath,`# ${session.title}\n\nScope: ${session.scope}\n\n${body}\n`,"utf-8");
    return {success:true,message:"Research session exported.",filePath};
  });
  ipcMain.handle("evidenceAssistant:open", async (_e, filePath) => {
    const result=await shell.openPath(String(filePath||"")); return {success:!result,message:result||"Opened."};
  });
}
