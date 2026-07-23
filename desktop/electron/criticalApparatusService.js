import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const now=()=>new Date().toISOString();
const read=(f,d)=>{try{return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):d}catch{return d}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2),'utf8')};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const root=ws=>path.join(ws,'.ocr-studio','manuscripts');
const files=ws=>({collations:path.join(root(ws),'collations.json'),witnesses:path.join(root(ws),'witnesses.json'),apparatus:path.join(root(ws),'critical-apparatus.json')});

function buildEntries(ws){
 const f=files(ws),collations=read(f.collations,{items:[]}).items||[],witnesses=read(f.witnesses,{items:[]}).items||[],sigla=new Map(witnesses.map(w=>[w.id,w.siglum||w.title||w.id]));
 const saved=read(f.apparatus,{entries:[],settings:{}}),savedMap=new Map((saved.entries||[]).map(e=>[e.key,e]));
 const entries=[];
 for(const col of collations)for(const row of col.rows||[]){
  const readings=(row.readings||[]).map(r=>({witnessId:r.witnessId,siglum:sigla.get(r.witnessId)||r.witnessId,text:String(r.text||'').trim()}));
  const groups=new Map();for(const r of readings){const k=r.text||'∅';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r.siglum)}
  if(groups.size<2)continue;
  const key=`${col.id||'col'}:${row.book||row.bookNumber||''}:${row.chapter||row.chapterNumber||''}:${row.verse||row.verseNumber||row.id||''}`;
  const previous=savedMap.get(key)||{};
  entries.push({id:previous.id||crypto.randomUUID(),key,collationId:col.id||'',book:row.book||row.bookNumber||'',chapter:row.chapter||row.chapterNumber||'',verse:row.verse||row.verseNumber||'',lemma:previous.lemma??row.adopted??'',readings:[...groups.entries()].map(([text,wits])=>({text:text==='∅'?'':text,witnesses:wits})),variantType:row.variantType||row.classification||'Substantive',status:previous.status||'Draft',note:previous.note||'',include:previous.include!==false,updatedAt:previous.updatedAt||now()});
 }
 return{entries,witnesses,collations,settings:saved.settings||{title:'Critical Apparatus',style:'compact',includeNotes:true}};
}
function get(ws){const data=buildEntries(ws);write(files(ws).apparatus,{entries:data.entries,settings:data.settings,updatedAt:now()});return{success:true,message:`Loaded ${data.entries.length} variant location(s).`,...data,summary:{total:data.entries.length,approved:data.entries.filter(e=>e.status==='Approved').length,draft:data.entries.filter(e=>e.status==='Draft').length,excluded:data.entries.filter(e=>!e.include).length}}}
function saveEntry(ws,entry){const f=files(ws).apparatus,d=read(f,{entries:[],settings:{}}),idx=(d.entries||[]).findIndex(e=>e.key===entry.key||e.id===entry.id);const value={...entry,id:entry.id||crypto.randomUUID(),updatedAt:now()};if(idx>=0)d.entries[idx]=value;else d.entries.push(value);write(f,d);return{success:true,message:'Apparatus entry saved.',entry:value}}
function saveSettings(ws,settings){const f=files(ws).apparatus,d=read(f,{entries:[],settings:{}});d.settings={...d.settings,...settings,updatedAt:now()};write(f,d);return{success:true,message:'Apparatus settings saved.',settings:d.settings}}
function renderEntry(e,style='compact'){
 const apps=(e.readings||[]).map(r=>`${esc(r.text||'om.')} <i>${esc((r.witnesses||[]).join(' '))}</i>`).join(style==='expanded'?'<br>':' · ');
 return `<div class="app-entry"><b>${esc([e.book,e.chapter,e.verse].filter(Boolean).join('.'))}</b> <span class="lemma">${esc(e.lemma||'—')}</span>] ${apps}${e.note?` <span class="note">${esc(e.note)}</span>`:''}</div>`;
}
function exportApparatus(ws,format,options={}){const data=get(ws),entries=data.entries.filter(e=>e.include&&(options.includeDrafts||e.status==='Approved')),dir=path.join(root(ws),'exports');fs.mkdirSync(dir,{recursive:true});const stamp=Date.now();let filePath;
 if(format==='json'){filePath=path.join(dir,`critical-apparatus-${stamp}.json`);write(filePath,{generatedAt:now(),settings:data.settings,entries});}
 else if(format==='csv'){filePath=path.join(dir,`critical-apparatus-${stamp}.csv`);const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const lines=['Book,Chapter,Verse,Lemma,Readings,Type,Status,Note',...entries.map(e=>[e.book,e.chapter,e.verse,e.lemma,(e.readings||[]).map(r=>`${r.text||'om.'} ${r.witnesses.join(' ')}`).join(' | '),e.variantType,e.status,e.note].map(q).join(','))];fs.writeFileSync(filePath,lines.join('\n'),'utf8');}
 else if(format==='tei'){filePath=path.join(dir,`critical-apparatus-${stamp}.xml`);const body=entries.map(e=>`<app n="${esc([e.book,e.chapter,e.verse].filter(Boolean).join('.'))}" type="${esc(e.variantType)}"><lem>${esc(e.lemma)}</lem>${(e.readings||[]).map(r=>`<rdg wit="${esc((r.witnesses||[]).map(w=>'#'+w).join(' '))}">${esc(r.text)}</rdg>`).join('')}${e.note?`<note>${esc(e.note)}</note>`:''}</app>`).join('\n');fs.writeFileSync(filePath,`<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>${esc(data.settings.title||'Critical Apparatus')}</title></titleStmt><publicationStmt><p>Generated by OCR Studio</p></publicationStmt><sourceDesc><p>Witness collations</p></sourceDesc></fileDesc></teiHeader><text><body><listApp>${body}</listApp></body></text></TEI>`,'utf8');}
 else {filePath=path.join(dir,`critical-apparatus-${stamp}.html`);fs.writeFileSync(filePath,`<!doctype html><meta charset="utf-8"><title>${esc(data.settings.title)}</title><style>body{font-family:Georgia,serif;max-width:980px;margin:40px auto;padding:0 24px;color:#33251d}.app-entry{padding:10px 0;border-bottom:1px solid #eadfd6}.lemma{font-weight:700}.note{color:#75543f;font-style:italic}i{color:#9b4f18}</style><h1>${esc(data.settings.title)}</h1><p>${entries.length} approved apparatus entries</p>${entries.map(e=>renderEntry(e,data.settings.style)).join('')}`,'utf8');}
 return{success:true,message:`${format.toUpperCase()} apparatus export created with ${entries.length} entries.`,filePath,count:entries.length}}
export function registerCriticalApparatusIpc({ipcMain,shell}){
 ipcMain.handle('apparatus:get',async(_e,d)=>get(String(d?.workspacePath||'')));
 ipcMain.handle('apparatus:saveEntry',async(_e,d)=>saveEntry(String(d?.workspacePath||''),d?.entry||{}));
 ipcMain.handle('apparatus:saveSettings',async(_e,d)=>saveSettings(String(d?.workspacePath||''),d?.settings||{}));
 ipcMain.handle('apparatus:export',async(_e,d)=>exportApparatus(String(d?.workspacePath||''),String(d?.format||'html'),d?.options||{}));
 ipcMain.handle('apparatus:open',async(_e,d)=>{const err=await shell.openPath(String(d?.filePath||''));return{success:!err,message:err||'Opened apparatus export.'}});
}
