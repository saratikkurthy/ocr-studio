import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const now=()=>new Date().toISOString();
const read=(f,d)=>{try{return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):d}catch{return d}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2),'utf8')};
const root=ws=>path.join(ws,'.ocr-studio','scholarly-library');
const collectionsFile=ws=>path.join(root(ws),'collections.json');
const editionsIndex=ws=>path.join(ws,'.ocr-studio','editions','editions.json');
const editionDir=(ws,e)=>path.join(ws,'.ocr-studio','editions',e.folderName);
const editions=ws=>read(editionsIndex(ws),{editions:[]}).editions||[];
const collections=ws=>read(collectionsFile(ws),{collections:[]}).collections||[];
const saveCollections=(ws,items)=>write(collectionsFile(ws),{version:1,updatedAt:now(),collections:items});
const verseRows=(ws,e)=>{const s=read(path.join(editionDir(ws,e),'structure.json'),{books:[]}),rows=[];for(const b of s.books||[])for(const c of b.chapters||[])for(const v of c.verses||[])rows.push({editionId:e.id,editionTitle:e.title,bookId:b.id,bookTitle:b.title||`Book ${b.number}`,chapterId:c.id,chapterTitle:c.title||`Chapter ${c.number}`,verseId:v.id,verseNumber:v.number,criticalText:v.criticalText||'',languages:v.languages||{}});return rows};
function dashboard(ws){const es=editions(ws),cs=collections(ws);let verses=0,published=0,languages=new Set(),traditions=new Set();for(const e of es){verses+=Number(e.stats?.verses||0);if(e.status==='Published')published++;for(const l of e.languages||[])languages.add(l);if(e.tradition)traditions.add(e.tradition)}return{success:true,message:'Scholarly library loaded.',editions:es,collections:cs,stats:{editions:es.length,collections:cs.length,verses,published,languages:languages.size,traditions:traditions.size}}}
function createCollection(ws,input){const name=String(input?.name||'').trim();if(!name)return{success:false,message:'Collection name is required.'};const items=collections(ws),createdAt=now(),item={id:crypto.randomUUID(),name,description:String(input?.description||'').trim(),curator:String(input?.curator||'').trim(),keywords:Array.isArray(input?.keywords)?input.keywords.filter(Boolean):[],editionIds:[],createdAt,updatedAt:createdAt};items.unshift(item);saveCollections(ws,items);return{success:true,message:`Created collection “${name}”.`,collection:item}}
function updateCollection(ws,input){const items=collections(ws),i=items.findIndex(x=>x.id===input?.id);if(i<0)return{success:false,message:'Collection not found.'};items[i]={...items[i],...input,id:items[i].id,updatedAt:now()};saveCollections(ws,items);return{success:true,message:'Collection updated.',collection:items[i]}}
function removeCollection(ws,id){const items=collections(ws),item=items.find(x=>x.id===id);if(!item)return{success:false,message:'Collection not found.'};saveCollections(ws,items.filter(x=>x.id!==id));return{success:true,message:`Deleted collection “${item.name}”.`}}
function search(ws,query,collectionId){const q=String(query||'').trim().toLowerCase(),es=editions(ws),col=collections(ws).find(x=>x.id===collectionId),allowed=col?new Set(col.editionIds||[]):null,results=[];for(const e of es){if(allowed&&!allowed.has(e.id))continue;const meta=[e.title,e.subtitle,e.description,e.tradition,e.institution,...(e.languages||[]),...(e.editors||[]),...(e.keywords||[])].join(' ').toLowerCase();if(!q||meta.includes(q))results.push({type:'edition',editionId:e.id,title:e.title,subtitle:e.subtitle||e.description||'',status:e.status,version:e.version,languages:e.languages||[],score:meta.includes(q)?100:10});if(q){for(const r of verseRows(ws,e)){const text=[r.criticalText,...Object.values(r.languages||{})].join(' ').toLowerCase();if(text.includes(q))results.push({type:'verse',...r,snippet:[r.criticalText,...Object.values(r.languages||{})].join(' ').slice(0,320),score:80})}}}return{success:true,message:`Found ${results.length} library result(s).`,results:results.slice(0,250)}}
export function registerScholarlyLibraryIpc({ipcMain,shell}){
 ipcMain.handle('scholarlyLibrary:get',async(_e,d)=>dashboard(String(d?.workspacePath||'')));
 ipcMain.handle('scholarlyLibrary:createCollection',async(_e,d)=>createCollection(String(d?.workspacePath||''),d));
 ipcMain.handle('scholarlyLibrary:updateCollection',async(_e,d)=>updateCollection(String(d?.workspacePath||''),d));
 ipcMain.handle('scholarlyLibrary:deleteCollection',async(_e,d)=>removeCollection(String(d?.workspacePath||''),String(d?.id||'')));
 ipcMain.handle('scholarlyLibrary:search',async(_e,d)=>search(String(d?.workspacePath||''),d?.query,d?.collectionId));
 ipcMain.handle('scholarlyLibrary:openEdition',async(_e,d)=>{const e=editions(String(d?.workspacePath||'')).find(x=>x.id===d?.editionId);if(!e)return{success:false,message:'Edition not found.'};const err=await shell.openPath(editionDir(String(d.workspacePath),e));return{success:!err,message:err||'Opened edition folder.'}});
}
