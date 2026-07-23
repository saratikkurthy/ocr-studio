import fs from "fs";
import path from "path";

const STOP = new Set("the and for are with from into that this was were have has had not but you your their they them his her its our who what when where which will would could should a an of to in on by as at is be or it he she we i these those then than also only very more most some any each all can may do did done about across after before between through over under again such no nor so if".split(/\s+/));
const readJson = (file, fallback) => { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf8")) : fallback; } catch { return fallback; } };
const studio = (ws) => path.join(ws, ".ocr-studio");
const indexFile = (ws) => path.join(studio(ws), "manuscript-index.json");
const cacheFile = (ws) => path.join(studio(ws), "corpus-intelligence", "analytics-cache.json");
const tokenize = (v) => String(v||"").normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const topEntries = (map, limit=30) => [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([name,count])=>({name,count}));
function loadIndex(workspacePath){ return readJson(indexFile(workspacePath), null); }
function otherCounts(workspacePath){
  const s=studio(workspacePath);
  const files={notebooks:["research","notebooks.json"],citations:["citations","citations.json"],canvases:["research-canvases","canvases.json"],sessions:["ai","research-assistant.json"],graph:["knowledge-graph","graph.json"],timeline:["knowledge-graph","timeline-narrative.json"]};
  const out={notebooks:0,citations:0,canvases:0,sessions:0,entities:0,relationships:0,events:0,places:0};
  for(const [key,parts] of Object.entries(files)){
    const raw=readJson(path.join(s,...parts),{});
    if(key==="notebooks") out.notebooks=(raw.notebooks||[]).length;
    if(key==="citations") out.citations=(raw.citations||[]).length;
    if(key==="canvases") out.canvases=(raw.canvases||[]).length;
    if(key==="sessions") out.sessions=(raw.sessions||[]).length;
    if(key==="graph"){out.entities=(raw.entities||[]).length;out.relationships=(raw.relationships||[]).length;}
    if(key==="timeline"){out.events=(raw.events||[]).length;out.places=(raw.places||[]).length;}
  }
  return out;
}
function analyze(workspacePath){
  const index=loadIndex(workspacePath);
  if(!index?.chunks?.length) return {success:false,message:"Build the manuscript index before running Corpus Intelligence.",analytics:null};
  const freq=new Map(), projects=new Map(), languages=new Map(), documents=new Map(), confidence=[];
  for(const c of index.chunks){
    projects.set(c.projectName,(projects.get(c.projectName)||0)+1);
    languages.set(c.language||"unknown",(languages.get(c.language||"unknown")||0)+1);
    documents.set(`${c.projectName} › ${c.documentName}`,(documents.get(`${c.projectName} › ${c.documentName}`)||0)+1);
    if(Number(c.averageConfidence)>0) confidence.push(Number(c.averageConfidence));
    for(const t of tokenize(c.text)) if(t.length>2 && !STOP.has(t) && !/^\d+$/.test(t)) freq.set(t,(freq.get(t)||0)+1);
  }
  const themes=topEntries(freq,40).map((x,i)=>({...x,rank:i+1,coverage:Number((x.count/index.chunks.length*100).toFixed(1))}));
  const avgConf=confidence.length?confidence.reduce((a,b)=>a+b,0)/confidence.length:0;
  const analytics={generatedAt:new Date().toISOString(),metadata:index.metadata,statistics:{...index.metadata,...otherCounts(workspacePath),averageOcrConfidence:Number(avgConf.toFixed(1))},themes,projects:topEntries(projects,50),languages:topEntries(languages,30),documents:topEntries(documents,100)};
  const target=cacheFile(workspacePath);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(analytics,null,2),"utf8");
  return {success:true,message:`Analyzed ${index.chunks.length} indexed passages and discovered ${themes.length} leading themes.`,analytics};
}
function search(workspacePath,query,limit=30){
  const index=loadIndex(workspacePath); if(!index?.chunks?.length) return {success:false,message:"Manuscript index is missing.",results:[]};
  const q=[...new Set(tokenize(query))]; if(!q.length) return {success:false,message:"Enter a search concept.",results:[]};
  const synonyms={dharma:["duty","righteousness","धर्म","ధర్మ"],war:["battle","army","combat","युद्ध","యుద్ధం"],charity:["giving","donation","generosity","दान","దానం"],liberation:["moksha","मोक्ष","మోక్షం"]};
  const expanded=[...new Set(q.flatMap(t=>[t,...(synonyms[t]||[])]))];
  const results=index.chunks.map(c=>{const lower=String(c.text||"").toLocaleLowerCase();let score=0;const matched=[];for(const t of expanded){const n=(lower.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gu"))||[]).length;if(n){score+=n*(q.includes(t)?3:1.5);matched.push(t);}}return {...c,score,matched,snippet:String(c.text||"").slice(0,460)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.min(Number(limit)||30,100));
  return {success:true,message:results.length?`Found ${results.length} semantically related passages.`:"No related passages were found.",expandedTerms:expanded,results};
}
function evolution(workspacePath,concept){
  const found=search(workspacePath,concept,200); if(!found.success) return found;
  const groups=new Map();for(const r of found.results){const key=r.projectName||"Unknown project";const g=groups.get(key)||{projectName:key,mentions:0,pages:new Set(),documents:new Set(),examples:[]};g.mentions+=r.matched?.length||1;g.pages.add(r.pageNumber);g.documents.add(r.documentName);if(g.examples.length<3)g.examples.push({documentName:r.documentName,pageNumber:r.pageNumber,snippet:r.snippet});groups.set(key,g);}
  return {success:true,message:`Tracked “${concept}” across ${groups.size} projects.`,concept,stages:[...groups.values()].map(g=>({...g,pages:g.pages.size,documents:g.documents.size})).sort((a,b)=>b.mentions-a.mentions)};
}
export function registerCorpusIntelligenceIpc({ipcMain,shell}){
  ipcMain.handle("corpusIntelligence:analyze",async(_e,d)=>analyze(String(d?.workspacePath||"")));
  ipcMain.handle("corpusIntelligence:get",async(_e,d)=>{const ws=String(d?.workspacePath||"");const cached=readJson(cacheFile(ws),null);return cached?{success:true,analytics:cached,message:"Loaded corpus intelligence cache."}:analyze(ws);});
  ipcMain.handle("corpusIntelligence:search",async(_e,d)=>search(String(d?.workspacePath||""),String(d?.query||""),d?.limit));
  ipcMain.handle("corpusIntelligence:evolution",async(_e,d)=>evolution(String(d?.workspacePath||""),String(d?.concept||"")));
  ipcMain.handle("corpusIntelligence:openSource",async(_e,p)=>{const err=await shell.openPath(String(p||""));return{success:!err,message:err||"Opened."};});
}
