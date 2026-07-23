import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const now=()=>new Date().toISOString();
const read=(file,fallback)=>{try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback}catch{return fallback}};
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2),'utf8')};
const root=ws=>path.join(ws,'.ocr-studio','manuscripts');
const files=ws=>({witnesses:path.join(root(ws),'witnesses.json'),collations:path.join(root(ws),'collations.json'),stemma:path.join(root(ws),'stemma.json'),analysis:path.join(root(ws),'stemma-analysis.json')});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function pairStats(collations,witnesses){
 const map=new Map();
 for(let i=0;i<witnesses.length;i++)for(let j=i+1;j<witnesses.length;j++)map.set(`${witnesses[i].id}|${witnesses[j].id}`,{a:witnesses[i],b:witnesses[j],compared:0,agreements:0,sharedInnovations:0});
 for(const c of collations||[])for(const row of c.rows||[]){
  const readings=new Map((row.readings||[]).map(r=>[r.witnessId,String(r.text||'').trim()]));
  for(const p of map.values()){
   const a=readings.get(p.a.id),b=readings.get(p.b.id);if(a===undefined||b===undefined)continue;
   p.compared++;if(a===b)p.agreements++;if(a&&a===b&&a!==String(row.adopted||'').trim())p.sharedInnovations++;
  }
 }
 return [...map.values()].map(p=>({...p,similarity:p.compared?Math.round((p.agreements/p.compared)*1000)/10:0,innovationScore:p.compared?Math.round((p.sharedInnovations/p.compared)*1000)/10:0}));
}
function inferEdges(witnesses,pairs){
 if(witnesses.length<2)return[];const used=new Set([witnesses[0].id]),edges=[];
 while(used.size<witnesses.length){let best=null;for(const p of pairs){const au=used.has(p.a.id),bu=used.has(p.b.id);if(au===bu)continue;if(!best||p.similarity>best.similarity||p.similarity===best.similarity&&p.sharedInnovations>best.sharedInnovations)best=p}if(!best)break;const parent=used.has(best.a.id)?best.a:best.b,child=used.has(best.a.id)?best.b:best.a;edges.push({id:crypto.randomUUID(),parentId:parent.id,childId:child.id,confidence:Math.max(10,Math.round(best.similarity)),basis:'Inferred from textual agreement',similarity:best.similarity,sharedInnovations:best.sharedInnovations,inferred:true});used.add(child.id)}
 return edges;
}
function analyze(ws){
 const f=files(ws),witnesses=read(f.witnesses,{items:[]}).items||[],collations=read(f.collations,{items:[]}).items||[],saved=read(f.stemma,{relationships:[]});const pairs=pairStats(collations,witnesses),inferred=inferEdges(witnesses,pairs);const analysis={generatedAt:now(),witnessCount:witnesses.length,collationCount:collations.length,pairs,inferredEdges:inferred,summary:{averageSimilarity:pairs.length?Math.round(pairs.reduce((n,p)=>n+p.similarity,0)/pairs.length*10)/10:0,strongestPair:pairs.slice().sort((a,b)=>b.similarity-a.similarity)[0]||null,sharedInnovations:pairs.reduce((n,p)=>n+p.sharedInnovations,0)}};write(f.analysis,analysis);return{success:true,message:`Analyzed ${witnesses.length} witnesses across ${collations.length} saved collation(s).`,witnesses,collations,relationships:saved.relationships||[],analysis}}
function get(ws){const result=analyze(ws);return result}
function saveRelationship(ws,item){const f=files(ws).stemma,d=read(f,{relationships:[]});const relationship={id:item?.id||crypto.randomUUID(),parentId:String(item?.parentId||''),childId:String(item?.childId||''),confidence:Number(item?.confidence||50),basis:String(item?.basis||''),evidence:String(item?.evidence||''),notes:String(item?.notes||''),createdAt:item?.createdAt||now(),updatedAt:now()};if(!relationship.parentId||!relationship.childId||relationship.parentId===relationship.childId)return{success:false,message:'Choose two different witnesses.'};const idx=d.relationships.findIndex(x=>x.id===relationship.id);idx>=0?d.relationships[idx]=relationship:d.relationships.push(relationship);write(f,d);return{success:true,message:'Stemma relationship saved.',relationship}}
function deleteRelationship(ws,id){const f=files(ws).stemma,d=read(f,{relationships:[]});d.relationships=d.relationships.filter(x=>x.id!==id);write(f,d);return{success:true,message:'Stemma relationship deleted.'}}
function exportAnalysis(ws,format){const data=analyze(ws),dir=path.join(root(ws),'exports');fs.mkdirSync(dir,{recursive:true});const stamp=Date.now();let filePath;if(format==='json'){filePath=path.join(dir,`stemma-analysis-${stamp}.json`);write(filePath,data)}else if(format==='svg'){filePath=path.join(dir,`stemma-${stamp}.svg`);const nodes=data.witnesses||[],edges=[...(data.analysis?.inferredEdges||[]),...(data.relationships||[])];const width=1000,height=Math.max(420,nodes.length*100),positions=new Map(nodes.map((w,i)=>[w.id,{x:180+(i%4)*220,y:90+Math.floor(i/4)*150}]));const lines=edges.map(e=>{const a=positions.get(e.parentId),b=positions.get(e.childId);return a&&b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#9a5b2e" stroke-width="2"/><text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-6}" font-size="12" fill="#6f4b34">${esc(e.confidence||e.similarity||'')}%</text>`:''}).join('');const circles=nodes.map(w=>{const p=positions.get(w.id);return`<circle cx="${p.x}" cy="${p.y}" r="34" fill="#fff7ed" stroke="#c96b2c" stroke-width="3"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" font-size="16" font-weight="700" fill="#4b2f20">${esc(w.siglum)}</text>`}).join('');fs.writeFileSync(filePath,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fffdf9"/><text x="30" y="38" font-size="24" font-weight="700" fill="#4b2f20">OCR Studio Stemma</text>${lines}${circles}</svg>`,'utf8')}else{filePath=path.join(dir,`stemma-analysis-${stamp}.html`);const rows=(data.analysis?.pairs||[]).map(p=>`<tr><td>${esc(p.a.siglum)}</td><td>${esc(p.b.siglum)}</td><td>${p.compared}</td><td>${p.similarity}%</td><td>${p.sharedInnovations}</td></tr>`).join('');fs.writeFileSync(filePath,`<!doctype html><meta charset="utf-8"><title>Stemma Analysis</title><style>body{font-family:system-ui;margin:32px;color:#35261e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d9c9bd;padding:9px}th{background:#f7eee7}</style><h1>Variant Analysis & Stemma Workbench</h1><p>${data.analysis?.witnessCount||0} witnesses · ${data.analysis?.collationCount||0} collations · average similarity ${data.analysis?.summary?.averageSimilarity||0}%</p><table><thead><tr><th>Witness A</th><th>Witness B</th><th>Compared</th><th>Similarity</th><th>Shared innovations</th></tr></thead><tbody>${rows}</tbody></table>`,'utf8')};return{success:true,message:`${format.toUpperCase()} stemma export created.`,filePath}}
export function registerStemmaAnalysisIpc({ipcMain,shell}){
 ipcMain.handle('stemma:get',async(_e,d)=>get(String(d?.workspacePath||'')));
 ipcMain.handle('stemma:analyze',async(_e,d)=>analyze(String(d?.workspacePath||'')));
 ipcMain.handle('stemma:saveRelationship',async(_e,d)=>saveRelationship(String(d?.workspacePath||''),d?.relationship||{}));
 ipcMain.handle('stemma:deleteRelationship',async(_e,d)=>deleteRelationship(String(d?.workspacePath||''),String(d?.id||'')));
 ipcMain.handle('stemma:export',async(_e,d)=>exportAnalysis(String(d?.workspacePath||''),String(d?.format||'html')));
 ipcMain.handle('stemma:open',async(_e,d)=>{const err=await shell.openPath(String(d?.filePath||''));return{success:!err,message:err||'Opened stemma export.'}});
}
