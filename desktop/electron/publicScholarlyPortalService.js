import fs from "fs";
import path from "path";
import crypto from "crypto";

const now=()=>new Date().toISOString();
const id=(p)=>`${p}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const root=(projectPath)=>path.join(projectPath,".ocr-studio","public-portal");
const dataFile=(projectPath,name)=>path.join(root(projectPath),name);
function ensure(projectPath){
  fs.mkdirSync(path.join(root(projectPath),"exports"),{recursive:true});
  for(const [name,initial] of [["sites.json",[]],["pages.json",[]],["analytics.json",[]],["settings.json",{}]]){
    const target=dataFile(projectPath,name);if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(initial,null,2),"utf8");
  }
}
function read(projectPath,name,fallback=[]){ensure(projectPath);try{return JSON.parse(fs.readFileSync(dataFile(projectPath,name),"utf8"));}catch{return fallback;}}
function write(projectPath,name,value){ensure(projectPath);fs.writeFileSync(dataFile(projectPath,name),JSON.stringify(value,null,2),"utf8");return value;}
function upsert(projectPath,name,record,prefix){const rows=read(projectPath,name,[]);const value={...record,id:record.id||id(prefix),updatedAt:now(),createdAt:record.createdAt||now()};const i=rows.findIndex(x=>x.id===value.id);if(i>=0)rows[i]=value;else rows.unshift(value);write(projectPath,name,rows);return value;}
function remove(projectPath,name,recordId){const rows=read(projectPath,name,[]).filter(x=>x.id!==recordId);write(projectPath,name,rows);return rows;}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function slug(v="publication"){return String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"publication";}
function collectText(projectPath){
  const candidates=[
    ["editions","editions.json"],["critical-text","documents.json"],["apparatus","apparatus.json"],
    ["parallel-corpus","segments.json"],["knowledge","entities.json"],["iiif","manifests.json"],
    ["repository","publications.json"]
  ];
  const records=[];
  for(const [folder,name] of candidates){const p=path.join(projectPath,".ocr-studio",folder,name);if(!fs.existsSync(p))continue;try{const raw=JSON.parse(fs.readFileSync(p,"utf8"));const rows=Array.isArray(raw)?raw:Object.values(raw||{});for(const row of rows){if(!row||typeof row!=="object")continue;records.push({source:`${folder}/${name}`,id:row.id||id("source"),title:row.title||row.name||row.label||row.witnessName||"Untitled record",text:row.text||row.content||row.description||row.translation||row.lemma||row.notes||"",type:folder,updatedAt:row.updatedAt||row.createdAt||now()});}}catch{}
  }
  return records;
}
function createPortal(projectPath,site){
  ensure(projectPath);
  const stamp=Date.now();const target=path.join(root(projectPath),"exports",`${slug(site.title)}-${stamp}`);fs.mkdirSync(path.join(target,"api"),{recursive:true});
  const records=collectText(projectPath);const pages=read(projectPath,"pages.json",[]).filter(p=>!p.siteId||p.siteId===site.id);
  const publication={...site,generatedAt:now(),recordCount:records.length,pageCount:pages.length};
  fs.writeFileSync(path.join(target,"api","publication.json"),JSON.stringify(publication,null,2));
  fs.writeFileSync(path.join(target,"api","search-index.json"),JSON.stringify(records,null,2));
  fs.writeFileSync(path.join(target,"api","pages.json"),JSON.stringify(pages,null,2));
  const cards=records.map((r,i)=>`<article class="record" data-search="${esc((r.title+" "+r.text+" "+r.type).toLowerCase())}"><div class="tag">${esc(r.type)}</div><h3>${esc(r.title)}</h3><p>${esc(r.text||"No textual description available.")}</p><small>${esc(r.source)}</small><button onclick="openReader(${i})">Open reader</button></article>`).join("\n");
  const navPages=pages.map(p=>`<a href="#page-${esc(p.id)}">${esc(p.title)}</a>`).join("");
  const customPages=pages.map(p=>`<section id="page-${esc(p.id)}" class="custom-page"><h2>${esc(p.title)}</h2><div>${esc(p.content).replace(/\n/g,"<br>")}</div></section>`).join("\n");
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(site.title)}</title><style>:root{--accent:${esc(site.accentColor||"#a64b14")};--paper:#fffaf1;--ink:#2d2118}*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;background:var(--paper);color:var(--ink)}header{background:linear-gradient(135deg,var(--accent),#4b210c);color:white;padding:32px 5vw}header h1{margin:0 0 8px;font-size:clamp(2rem,5vw,4rem)}nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:18px}nav a{color:white}main{max-width:1200px;margin:auto;padding:28px 5vw}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.toolbar input{flex:1;min-width:240px;padding:12px;border:1px solid #ccb99f;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:22px}.record,.custom-page{background:white;border:1px solid #e7d7c1;border-radius:12px;padding:18px;box-shadow:0 4px 18px #5b2c0b12}.record p{line-height:1.55}.tag{display:inline-block;background:#f3dfc3;padding:4px 8px;border-radius:99px;font-size:.75rem;text-transform:uppercase}.record button{border:0;background:var(--accent);color:white;padding:8px 12px;border-radius:7px;margin-top:12px}.reader{position:fixed;inset:0;background:#1d160fcc;display:none;align-items:center;justify-content:center;padding:4vw}.reader.open{display:flex}.reader-panel{background:white;max-width:850px;max-height:88vh;overflow:auto;border-radius:14px;padding:26px;width:100%}.reader-head{display:flex;justify-content:space-between;gap:20px}.reader-head button{font-size:1.4rem;border:0;background:none}.reader-text{font-size:1.15rem;line-height:1.8;white-space:pre-wrap}footer{padding:30px 5vw;border-top:1px solid #e7d7c1;margin-top:30px}@media(max-width:600px){header,main{padding-left:20px;padding-right:20px}}</style></head><body><header><h1>${esc(site.title)}</h1><p>${esc(site.subtitle||site.description||"A digital scholarly publication")}</p><nav><a href="#collection">Collection</a>${navPages}<a href="api/publication.json">Public API</a></nav></header><main><section id="collection"><div class="toolbar"><input id="q" type="search" placeholder="Search full text, entities, witnesses, and apparatus…" oninput="filterRecords()"><span id="count">${records.length} records</span></div><div class="grid" id="records">${cards||"<p>No publishable records were found in this project.</p>"}</div></section>${customPages}</main><div class="reader" id="reader"><div class="reader-panel"><div class="reader-head"><div><div class="tag" id="readerType"></div><h2 id="readerTitle"></h2></div><button onclick="closeReader()">×</button></div><div class="reader-text" id="readerText"></div><p><small id="readerSource"></small></p></div></div><footer><strong>${esc(site.publisher||"OCR Studio")}</strong><p>${esc(site.license||"All rights reserved")}. Generated ${esc(now().slice(0,10))}.</p></footer><script>const records=${JSON.stringify(records).replace(/</g,"\\u003c")};function filterRecords(){const q=document.getElementById('q').value.toLowerCase();let n=0;document.querySelectorAll('.record').forEach(x=>{const show=x.dataset.search.includes(q);x.style.display=show?'block':'none';if(show)n++});document.getElementById('count').textContent=n+' records'}function openReader(i){const r=records[i];document.getElementById('readerTitle').textContent=r.title;document.getElementById('readerType').textContent=r.type;document.getElementById('readerText').textContent=r.text||'No text available.';document.getElementById('readerSource').textContent=r.source;document.getElementById('reader').classList.add('open')}function closeReader(){document.getElementById('reader').classList.remove('open')}</script></body></html>`;
  fs.writeFileSync(path.join(target,"index.html"),html,"utf8");
  const manifest={name:site.title,short_name:site.shortTitle||site.title,start_url:"./index.html",display:"standalone",background_color:"#fffaf1",theme_color:site.accentColor||"#a64b14",icons:[]};fs.writeFileSync(path.join(target,"manifest.webmanifest"),JSON.stringify(manifest,null,2));
  return {target,indexPath:path.join(target,"index.html"),recordCount:records.length,pageCount:pages.length};
}
function dashboard(projectPath){const sites=read(projectPath,"sites.json",[]),pages=read(projectPath,"pages.json",[]),analytics=read(projectPath,"analytics.json",[]);return{sites:sites.length,published:sites.filter(s=>s.status==="Published").length,pages:pages.length,exports:analytics.filter(a=>a.type==="Portal generated").length,publicSites:sites.filter(s=>s.access==="Public").length,lastGenerated:analytics[0]?.createdAt||null};}
export function registerPublicScholarlyPortalIpc({ipcMain,shell,getProjects}){
 ipcMain.handle("portal:getWorkspace",()=>({success:true,projects:getProjects()}));
 ipcMain.handle("portal:getProject",(_,d)=>({success:true,sites:read(d.projectPath,"sites.json",[]),pages:read(d.projectPath,"pages.json",[]),analytics:read(d.projectPath,"analytics.json",[]),metrics:dashboard(d.projectPath)}));
 ipcMain.handle("portal:saveSite",(_,d)=>({success:true,site:upsert(d.projectPath,"sites.json",d,"site")}));
 ipcMain.handle("portal:deleteSite",(_,d)=>({success:true,sites:remove(d.projectPath,"sites.json",d.id)}));
 ipcMain.handle("portal:savePage",(_,d)=>({success:true,page:upsert(d.projectPath,"pages.json",d,"page")}));
 ipcMain.handle("portal:deletePage",(_,d)=>({success:true,pages:remove(d.projectPath,"pages.json",d.id)}));
 ipcMain.handle("portal:generate",(_,d)=>{const result=createPortal(d.projectPath,d.site);const event=upsert(d.projectPath,"analytics.json",{siteId:d.site.id,type:"Portal generated",details:`${result.recordCount} indexed records and ${result.pageCount} custom pages`,outputPath:result.target},"evt");return{success:true,...result,event};});
 ipcMain.handle("portal:openFile",(_,p)=>shell.openPath(p));
}
