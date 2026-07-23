import fs from "fs";
import path from "path";
import crypto from "crypto";
import http from "http";
import https from "https";

const now=()=>new Date().toISOString();
const read=(file,fallback)=>{try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):fallback}catch{return fallback}};
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2),"utf8")};
const editionIndex=w=>path.join(w,".ocr-studio","editions","editions.json");
const edition=(w,id)=>(read(editionIndex(w),{editions:[]}).editions||[]).find(x=>x.id===id)||null;
const baseDir=(w,e)=>path.join(w,".ocr-studio","editions",e.folderName);
const file=(w,e)=>path.join(baseDir(w,e),"editorial-ai-suggestions.json");
const load=(w,e)=>{const s=read(file(w,e),{version:1,entries:[]});s.entries=Array.isArray(s.entries)?s.entries:[];return s};
const compact=v=>String(v||"").replace(/\s+/g," ").trim();

function requestJson(urlString,body,timeout=180000){return new Promise((resolve,reject)=>{let url;try{url=new URL(urlString)}catch{return reject(new Error("Invalid Ollama endpoint."))}const t=url.protocol==="https:"?https:http;const payload=JSON.stringify(body);const req=t.request({protocol:url.protocol,hostname:url.hostname,port:url.port||(url.protocol==="https:"?443:80),path:url.pathname,method:"POST",timeout,headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}},res=>{let raw="";res.setEncoding("utf8");res.on("data",c=>raw+=c);res.on("end",()=>{if((res.statusCode||500)>=400)return reject(new Error(`Ollama HTTP ${res.statusCode}`));try{resolve(JSON.parse(raw))}catch{reject(new Error("Invalid Ollama response."))}})});req.on("timeout",()=>req.destroy(new Error("Ollama request timed out.")));req.on("error",reject);req.write(payload);req.end()})}

function verseContext(w,e,verseId){
 const structure=read(path.join(baseDir(w,e),"structure.json"),{books:[]});let verse=null,book=null,chapter=null;
 for(const b of structure.books||[])for(const c of b.chapters||[])for(const v of c.verses||[])if(v.id===verseId){verse=v;book=b;chapter=c}
 const byVerse=name=>(read(path.join(baseDir(w,e),name),{entries:[]}).entries||[]).filter(x=>x.verseId===verseId);
 return {verse,book,chapter,apparatus:byVerse("apparatus.json"),commentary:byVerse("commentary.json"),footnotes:byVerse("footnotes.json"),decisions:byVerse("editorial-decisions.json"),evidence:byVerse("editorial-decision-evidence.json")};
}
function deterministicSuggestions(ctx){
 const out=[];const v=ctx.verse||{};const variants=ctx.apparatus||[];
 if(!compact(v.criticalText))out.push({type:"Missing critical text",title:"Establish a base reading",suggestion:"The verse has no critical text. Review the available witnesses and select or reconstruct a base reading before approval.",confidence:98,severity:"High",evidence:variants.slice(0,4)});
 if(variants.length>1){const readings=[...new Set(variants.map(x=>compact(x.reading)).filter(Boolean))];if(readings.length>1)out.push({type:"Variant choice",title:"Review competing readings",suggestion:`${readings.length} distinct readings are recorded. Compare witness age, independence, grammar and contextual coherence before selecting the critical reading.`,confidence:Math.min(95,65+readings.length*6),severity:"High",evidence:variants.slice(0,6)});}
 if(compact(v.criticalText)&&variants.some(x=>compact(x.reading)===compact(v.criticalText)))out.push({type:"Witness support",title:"Document support for the selected reading",suggestion:"The current critical text matches at least one recorded variant. Record the supporting witnesses and explain why this reading is preferred.",confidence:88,severity:"Medium",evidence:variants.filter(x=>compact(x.reading)===compact(v.criticalText)).slice(0,5)});
 if((ctx.decisions||[]).length===0)out.push({type:"Editorial rationale",title:"Create an editorial decision",suggestion:"No formal editorial decision is recorded for this verse. Add a rationale, editor, confidence and supporting witnesses.",confidence:96,severity:"Medium",evidence:variants.slice(0,4)});
 if((ctx.evidence||[]).length===0&&(ctx.decisions||[]).length>0)out.push({type:"Evidence gap",title:"Attach evidence to the decision",suggestion:"Editorial decisions exist, but no supporting evidence is attached. Link manuscript passages, parallel readings, commentary or image witnesses.",confidence:97,severity:"High",evidence:[]});
 const lang=v.languages||{};const empty=Object.entries(lang).filter(([,text])=>!compact(text)).map(([name])=>name);if(empty.length)out.push({type:"Parallel text gap",title:"Complete parallel-language alignment",suggestion:`Parallel text is missing for ${empty.join(", ")}. Add or explicitly mark unavailable translations before publication.`,confidence:92,severity:"Low",evidence:[]});
 return out;
}
async function generate(w,editionId,input){
 const e=edition(w,editionId);if(!e)return{success:false,message:"Edition not found."};const ctx=verseContext(w,e,String(input?.verseId||""));if(!ctx.verse)return{success:false,message:"Verse not found."};
 let suggestions=deterministicSuggestions(ctx),mode="Rules";
 if(input?.useOllama!==false){try{const settings=read(path.join(w,".ocr-studio","assistant-settings.json"),{});const endpoint=String(settings.endpoint||"http://127.0.0.1:11434").replace(/\/$/,"");const model=String(settings.model||"llama3.2:3b");const evidence=[...(ctx.apparatus||[]).slice(0,8).map((x,i)=>`[V${i+1}] ${x.label||"Variant"}: ${compact(x.reading)}; witnesses: ${(x.witnesses||[]).join(", ")}`),...(ctx.commentary||[]).slice(0,4).map((x,i)=>`[C${i+1}] ${compact(x.content)}`)].join("\n");const prompt=`You are a conservative textual critic. Analyze one verse only. Return JSON array with at most 5 objects having type,title,suggestion,confidence,severity,evidenceRefs. Never invent witnesses. Mark uncertainty.\nCritical text: ${compact(ctx.verse.criticalText)}\nParallel texts: ${JSON.stringify(ctx.verse.languages||{})}\nEvidence:\n${evidence||"No evidence supplied"}`;const r=await requestJson(`${endpoint}/api/chat`,{model,stream:false,keep_alive:"10m",format:"json",messages:[{role:"system",content:"Return valid JSON only. Suggestions are proposals, never facts."},{role:"user",content:prompt}],options:{temperature:0.1,num_ctx:4096,num_predict:900}});const parsed=JSON.parse(String(r?.message?.content||"[]"));const ai=Array.isArray(parsed)?parsed:Array.isArray(parsed.suggestions)?parsed.suggestions:[];if(ai.length){suggestions=[...ai.map(x=>({type:String(x.type||"AI analysis"),title:String(x.title||"Editorial suggestion"),suggestion:String(x.suggestion||""),confidence:Math.max(0,Math.min(100,Number(x.confidence||60))),severity:["High","Medium","Low"].includes(x.severity)?x.severity:"Medium",evidenceRefs:Array.isArray(x.evidenceRefs)?x.evidenceRefs:[],evidence:[]})),...suggestions];mode=`Ollama · ${model}`}}catch(error){mode=`Rules (Ollama unavailable: ${error instanceof Error?error.message:String(error)})`}}
 const store=load(w,e);store.entries=store.entries.filter(x=>x.verseId!==ctx.verse.id);const created=suggestions.slice(0,10).map(s=>({id:crypto.randomUUID(),verseId:ctx.verse.id,...s,status:"Proposed",generatedBy:mode,createdAt:now(),updatedAt:now()}));store.entries.unshift(...created);write(file(w,e),store);return{success:true,message:`Generated ${created.length} editorial suggestion(s) using ${mode}.`,suggestions:created,mode};
}
function list(w,editionId,verseId){const e=edition(w,editionId);if(!e)return null;return load(w,e).entries.filter(x=>!verseId||x.verseId===verseId)}
function update(w,editionId,input){const e=edition(w,editionId);if(!e)return{success:false,message:"Edition not found."};const s=load(w,e);const x=s.entries.find(i=>i.id===input?.suggestionId);if(!x)return{success:false,message:"Suggestion not found."};x.status=["Proposed","Accepted","Rejected","Applied"].includes(input?.status)?input.status:x.status;x.reviewNote=String(input?.reviewNote||x.reviewNote||"");x.reviewedBy=String(input?.reviewedBy||x.reviewedBy||"");x.updatedAt=now();write(file(w,e),s);return{success:true,message:`Suggestion marked ${x.status}.`,suggestions:s.entries.filter(i=>i.verseId===x.verseId)}}
export function registerEditorialAiIpc({ipcMain}){
 ipcMain.handle("editorialAi:list",async(_e,d)=>{const r=list(String(d?.workspacePath||""),String(d?.editionId||""),String(d?.verseId||""));return r?{success:true,message:"Editorial suggestions loaded.",suggestions:r}:{success:false,message:"Edition not found."}});
 ipcMain.handle("editorialAi:generate",async(_e,d)=>generate(String(d?.workspacePath||""),String(d?.editionId||""),d));
 ipcMain.handle("editorialAi:update",async(_e,d)=>update(String(d?.workspacePath||""),String(d?.editionId||""),d));
}
