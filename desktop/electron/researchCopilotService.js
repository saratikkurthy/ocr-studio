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
function reportsPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "research-reports.json"); }
function settingsPath(workspacePath) { return path.join(workspacePath, ".ocr-studio", "assistant-settings.json"); }
function loadSettings(workspacePath) {
  return { endpoint: DEFAULT_ENDPOINT, model: DEFAULT_MODEL, temperature: 0.2, evidenceLimit: 10, ...readJson(settingsPath(workspacePath), {}) };
}
function loadStore(workspacePath) {
  const data = readJson(reportsPath(workspacePath), { version: 1, reports: [] });
  return { version: 1, reports: Array.isArray(data?.reports) ? data.reports : [] };
}
function saveStore(workspacePath, store) {
  const target = reportsPath(workspacePath); ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(store, null, 2), "utf-8");
}
function requestJson(urlString, body, timeout = 240000) {
  return new Promise((resolve, reject) => {
    let url; try { url = new URL(urlString); } catch { reject(new Error("Invalid Ollama endpoint.")); return; }
    const payload = JSON.stringify(body);
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request({ protocol:url.protocol, hostname:url.hostname, port:url.port || (url.protocol === "https:" ? 443 : 80), path:`${url.pathname}${url.search}`, method:"POST", timeout,
      headers:{ Accept:"application/json", "Content-Type":"application/json", "Content-Length":Buffer.byteLength(payload) } }, (res) => {
      let raw=""; res.setEncoding("utf-8"); res.on("data", c => raw += c); res.on("end", () => {
        if ((res.statusCode || 500) >= 400) { reject(new Error(`Ollama returned HTTP ${res.statusCode}: ${raw.slice(0,300)}`)); return; }
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Ollama returned invalid JSON.")); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Research request timed out."))); req.on("error", reject); req.write(payload); req.end();
  });
}
function modeLabel(mode) {
  return ({ research:"Research brief", compare:"Edition comparison", character:"Character profile", place:"Place profile", timeline:"Timeline", themes:"Theme analysis" })[mode] || "Research brief";
}
function promptFor(mode, question) {
  const common = `Use only the supplied OCR manuscript evidence. Cite every factual claim with bracketed source numbers such as [1]. Never invent citations. Clearly identify uncertainty and OCR ambiguity. Preserve original-language names and terms.`;
  const instructions = {
    research: `Write a scholarly research brief with: Executive Summary, Key Findings, Evidence Discussion, Interpretive Cautions, and Sources Used.`,
    compare: `Compare the manuscripts or editions named by the user. Organize findings under Agreements, Differences, Missing or Additional Material, OCR/Spelling Variants, and Research Conclusion. Do not claim a difference unless the evidence supports it.`,
    character: `Build a character profile with Identity, Roles and Relationships, Important Actions or Speeches, Themes, Chronological Clues, and Evidence Gaps.`,
    place: `Build a place profile with Description, Associated Events, Connected Characters, Symbolic or Thematic Importance, Occurrence Patterns, and Evidence Gaps.`,
    timeline: `Create a chronological timeline. Each event must include an evidence citation and a confidence label (High, Medium, or Low). Separate explicit chronology from inferred ordering.`,
    themes: `Identify major themes, supporting passages, contrasting passages, recurring vocabulary, and interpretation limits. Rank themes by strength of evidence.`,
  };
  return `${common}\n\n${instructions[mode] || instructions.research}\n\nUser research request:\n${question}`;
}
function evidenceText(results) {
  return results.map((r,i)=>`[${i+1}] ${r.projectName} > ${r.documentName} > Page ${r.pageNumber}\nLanguage: ${r.language || "unknown"}; OCR confidence: ${Number(r.averageConfidence || 0).toFixed(1)}%\n${r.snippet}`).join("\n\n");
}
function summary(report) { return { id:report.id, title:report.title, mode:report.mode, createdAt:report.createdAt, updatedAt:report.updatedAt, sourceCount:report.evidence?.length || 0 }; }
function makeTitle(mode, question) { const q=String(question).replace(/\s+/g," ").trim(); const prefix=modeLabel(mode); return `${prefix}: ${q.length>54?q.slice(0,54)+"…":q}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]); }

export function registerResearchCopilotIpc(ipcMain, shell) {
  ipcMain.handle("research:list", async (_e, data) => {
    const store=loadStore(String(data?.workspacePath||""));
    return { success:true, reports:store.reports.map(summary).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))) };
  });
  ipcMain.handle("research:get", async (_e, data) => {
    const report=loadStore(String(data?.workspacePath||"")).reports.find(r=>r.id===String(data?.reportId||"")) || null;
    return { success:Boolean(report), report };
  });
  ipcMain.handle("research:delete", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const store=loadStore(workspacePath);
    store.reports=store.reports.filter(r=>r.id!==String(data?.reportId||"")); saveStore(workspacePath,store);
    return { success:true, message:"Research report deleted." };
  });
  ipcMain.handle("research:run", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const question=String(data?.question||"").trim(); const mode=String(data?.mode||"research");
    if(!workspacePath || !question) return { success:false, message:"Workspace and research request are required." };
    const settings={...loadSettings(workspacePath), ...(data?.settings||{})};
    const queries=[question];
    if(mode==="compare" && Array.isArray(data?.comparisonTerms)) queries.push(...data.comparisonTerms.filter(Boolean));
    const merged=[]; const seen=new Set();
    for(const query of queries){
      const result=searchManuscriptPassages({ workspacePath, collectionId:data?.collectionId?String(data.collectionId):null, query, limit:Math.min(Math.max(Number(settings.evidenceLimit)||10,5),24) });
      if(result.success) for(const item of result.results){ if(!seen.has(item.id)){seen.add(item.id); merged.push(item);} }
    }
    const evidence=merged.slice(0,24);
    if(!evidence.length) return { success:false, message:"No relevant indexed manuscript evidence was found.", evidence:[] };
    try{
      const response=await requestJson(`${String(settings.endpoint||DEFAULT_ENDPOINT).replace(/\/$/,"")}/api/chat`,{
        model:settings.model||DEFAULT_MODEL, stream:false,
        messages:[{role:"system",content:"You are OCR Studio Research Copilot, a careful manuscript scholar. Produce rigorous, citation-backed analysis."},{role:"user",content:`${promptFor(mode,question)}\n\nEvidence corpus:\n${evidenceText(evidence)}`}],
        options:{temperature:Number(settings.temperature??0.2)}
      });
      const content=String(response?.message?.content||"").trim(); if(!content) throw new Error("The model returned an empty report.");
      const now=new Date().toISOString(); const report={id:crypto.randomUUID(),title:makeTitle(mode,question),mode,question,collectionId:data?.collectionId||null,content,evidence,model:settings.model,createdAt:now,updatedAt:now};
      const store=loadStore(workspacePath); store.reports.push(report); saveStore(workspacePath,store);
      return {success:true,message:`Created ${modeLabel(mode).toLowerCase()} from ${evidence.length} manuscript passages.`,report};
    }catch(error){ return {success:false,message:`Research Copilot could not generate the report. ${error instanceof Error?error.message:String(error)}`,evidence}; }
  });
  ipcMain.handle("research:export", async (_e, data) => {
    const workspacePath=String(data?.workspacePath||""); const report=loadStore(workspacePath).reports.find(r=>r.id===String(data?.reportId||""));
    if(!report) return {success:false,message:"Research report not found."};
    const format=String(data?.format||"markdown"); const dir=path.join(workspacePath,".ocr-studio","research-exports"); ensureDir(dir);
    const safe=report.title.replace(/[^a-z0-9\-_]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,80)||"research-report"; let filePath;
    if(format==="json"){filePath=path.join(dir,`${safe}.json`);fs.writeFileSync(filePath,JSON.stringify(report,null,2),"utf-8");}
    else if(format==="html"){
      filePath=path.join(dir,`${safe}.html`); const sources=report.evidence.map((e,i)=>`<li><b>[${i+1}] ${escapeHtml(e.projectName)} — ${escapeHtml(e.documentName)}, page ${e.pageNumber}</b><p>${escapeHtml(e.snippet)}</p></li>`).join("");
      fs.writeFileSync(filePath,`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:Segoe UI,Arial;max-width:980px;margin:40px auto;line-height:1.65;color:#28231f}h1{color:#8a3f0a}pre{white-space:pre-wrap;font:inherit}li{margin-bottom:18px}</style></head><body><h1>${escapeHtml(report.title)}</h1><p><b>Mode:</b> ${escapeHtml(modeLabel(report.mode))} · <b>Model:</b> ${escapeHtml(report.model)}</p><pre>${escapeHtml(report.content)}</pre><h2>Evidence</h2><ol>${sources}</ol></body></html>`,`utf-8`);
    }else{
      filePath=path.join(dir,`${safe}.md`); const sources=report.evidence.map((e,i)=>`${i+1}. **${e.projectName} — ${e.documentName}, page ${e.pageNumber}**\n   ${e.snippet}`).join("\n\n");
      fs.writeFileSync(filePath,`# ${report.title}\n\n**Mode:** ${modeLabel(report.mode)}  \n**Model:** ${report.model}  \n**Created:** ${report.createdAt}\n\n${report.content}\n\n## Evidence\n\n${sources}\n`,`utf-8`);
    }
    return {success:true,message:`Research report exported as ${format.toUpperCase()}.`,filePath};
  });
  ipcMain.handle("research:open", async (_e, filePath) => ({ success:true, result:await shell.openPath(String(filePath||"")) }));
}
