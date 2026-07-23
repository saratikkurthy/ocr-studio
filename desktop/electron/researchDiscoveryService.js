import fs from "fs";
import path from "path";

const readJson=(f,d)=>{try{return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):d}catch{return d}};
const studio=ws=>path.join(ws,".ocr-studio");
const indexFile=ws=>path.join(studio(ws),"manuscript-index.json");
const reportFile=ws=>path.join(studio(ws),"research-discovery","discovery-report.json");
const tok=v=>String(v||"").normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
function load(ws){return {index:readJson(indexFile(ws),{}),graph:readJson(path.join(studio(ws),"knowledge-graph","graph.json"),{}),timeline:readJson(path.join(studio(ws),"knowledge-graph","timeline-narrative.json"),{}),citations:readJson(path.join(studio(ws),"citations","citations.json"),{}),notebooks:readJson(path.join(studio(ws),"research","notebooks.json"),{}),assistant:readJson(path.join(studio(ws),"ai","research-assistant.json"),{}),governance:readJson(path.join(studio(ws),"governance","governance.json"),{}),revisions:readJson(path.join(studio(ws),"revisions","revisions.json"),{})};}
function similarity(a,b){const A=new Set(tok(a).filter(x=>x.length>2)),B=new Set(tok(b).filter(x=>x.length>2));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(A.size,B.size);}
function build(ws){
 const d=load(ws),chunks=d.index?.chunks||[]; if(!chunks.length)return{success:false,message:"Build the manuscript index before running Research Discovery.",report:null};
 const low=chunks.filter(c=>Number(c.averageConfidence||100)<75).sort((a,b)=>Number(a.averageConfidence)-Number(b.averageConfidence)).slice(0,40);
 const uncited=chunks.filter(c=>!(d.citations.citations||[]).some(x=>x.pageNumber===c.pageNumber&&(x.documentName===c.documentName||x.sourceTitle===c.documentName))).slice(0,40);
 const unresolved=(d.graph.relationships||[]).filter(r=>r.status==="suggested"||Number(r.confidence||100)<70);
 const orphan=(d.graph.entities||[]).filter(e=>!(d.graph.relationships||[]).some(r=>r.sourceId===e.id||r.targetId===e.id));
 const variants=[]; for(let i=0;i<Math.min(chunks.length,250);i++)for(let j=i+1;j<Math.min(chunks.length,250);j++){if(chunks[i].projectName===chunks[j].projectName)continue;const s=similarity(chunks[i].text,chunks[j].text);if(s>.55&&s<.98)variants.push({id:`v-${i}-${j}`,similarity:clamp(s*100),left:chunks[i],right:chunks[j],category:s>.82?"translation":"narrative"});if(variants.length>=30)break;} 
 const opportunities=[
  {id:"low-confidence",title:"Low-confidence OCR passages",count:low.length,severity:"high",description:"Passages below 75% OCR confidence need human review."},
  {id:"missing-citations",title:"Passages without citations",count:uncited.length,severity:"medium",description:"Indexed passages not yet represented in the citation library."},
  {id:"variants",title:"Possible manuscript variants",count:variants.length,severity:"high",description:"Similar passages across projects with meaningful textual differences."},
  {id:"orphan-entities",title:"Orphan knowledge entities",count:orphan.length,severity:"medium",description:"Entities with no recorded relationships."},
  {id:"weak-relationships",title:"Relationships needing review",count:unresolved.length,severity:"medium",description:"Suggested or low-confidence graph relationships."}
 ];
 const evidenceCoverage=clamp(((d.citations.citations||[]).length/Math.max(1,chunks.length))*100);
 const ocrQuality=clamp(chunks.reduce((s,c)=>s+Number(c.averageConfidence||0),0)/chunks.length);
 const graphDensity=clamp(((d.graph.relationships||[]).length/Math.max(1,(d.graph.entities||[]).length*1.5))*100);
 const reviewScore=clamp(100-(low.length/Math.max(1,chunks.length))*100);
 const conflictScore=clamp(100-(variants.length/Math.max(1,chunks.length))*100);
 const readiness=clamp(ocrQuality*.3+evidenceCoverage*.25+graphDensity*.15+reviewScore*.2+conflictScore*.1);
 const hypotheses=variants.slice(0,10).map((v,i)=>({id:`h-${i}`,title:v.similarity>82?"Possible parallel recension":"Possible shared narrative source",statement:`“${v.left.documentName}” and “${v.right.documentName}” may preserve related versions of the same passage.`,confidence:clamp(v.similarity*.9),status:"unreviewed",evidence:[v.left,v.right],reasoning:`Lexical overlap is ${v.similarity}% across different projects while the passages are not identical.`}));
 if(orphan.length)hypotheses.push({id:"h-orphan",title:"Underexplored entity cluster",statement:`${orphan.slice(0,3).map(x=>x.name).join(", ")} may require relationship analysis.`,confidence:68,status:"unreviewed",evidence:[],reasoning:"These entities occur in the graph but currently have no connections."});
 const roadmap=[
  {step:1,title:"Review OCR uncertainty",status:low.length?"attention":"complete",count:low.length},
  {step:2,title:"Verify manuscript variants",status:variants.length?"attention":"complete",count:variants.length},
  {step:3,title:"Strengthen citation coverage",status:evidenceCoverage<80?"attention":"complete",count:uncited.length},
  {step:4,title:"Connect orphan entities",status:orphan.length?"attention":"complete",count:orphan.length},
  {step:5,title:"Resolve weak relationships",status:unresolved.length?"attention":"complete",count:unresolved.length},
  {step:6,title:"Prepare publication review",status:readiness>=80?"ready":"blocked",count:readiness}
 ];
 const report={generatedAt:new Date().toISOString(),summary:{passages:chunks.length,opportunities:opportunities.reduce((s,x)=>s+x.count,0),hypotheses:hypotheses.length,variants:variants.length,readiness},metrics:{ocrQuality,evidenceCoverage,graphDensity,reviewScore,conflictScore},opportunities,hypotheses,variants:variants.slice(0,20),roadmap,heatmap:chunks.slice(0,80).map(c=>({id:c.id,projectName:c.projectName,documentName:c.documentName,pageNumber:c.pageNumber,ocr:clamp(Number(c.averageConfidence||0)),citation:(d.citations.citations||[]).some(x=>x.pageNumber===c.pageNumber)?100:20,review:Number(c.averageConfidence||0)>=85?90:Number(c.averageConfidence||0)>=70?60:25,overall:clamp(Number(c.averageConfidence||0)*.65+((d.citations.citations||[]).some(x=>x.pageNumber===c.pageNumber)?35:8)),projectPath:c.projectPath}))};
 const f=reportFile(ws);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(report,null,2));return{success:true,message:`Discovered ${report.summary.opportunities} research opportunities and ${hypotheses.length} hypotheses.`,report};
}
export function registerResearchDiscoveryIpc({ipcMain,shell}){
 ipcMain.handle("researchDiscovery:analyze",async(_e,d)=>build(String(d?.workspacePath||"")));
 ipcMain.handle("researchDiscovery:get",async(_e,d)=>{const ws=String(d?.workspacePath||"");const r=readJson(reportFile(ws),null);return r?{success:true,message:"Loaded research discovery report.",report:r}:build(ws)});
 ipcMain.handle("researchDiscovery:open",async(_e,p)=>{const err=await shell.openPath(String(p||""));return{success:!err,message:err||"Opened."}});
}
