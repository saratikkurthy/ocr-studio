import fs from "fs";
import path from "path";
import crypto from "crypto";

const now=()=>new Date().toISOString();
const safe=(v)=>String(v||"").trim();
const slug=(v)=>safe(v).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"edition";
const root=(ws)=>path.join(ws,".ocr-studio","editions");
const indexFile=(ws)=>path.join(root(ws),"editions.json");
const read=(f,d)=>{try{return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):d}catch{return d}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2));};
const defaultProgress=()=>({ocr:0,verification:0,variants:0,commentary:0,footnotes:0,publication:0});
function list(ws){const data=read(indexFile(ws),{version:1,editions:[]});return Array.isArray(data.editions)?data.editions:[];}
function persist(ws,editions){write(indexFile(ws),{version:1,updatedAt:now(),editions});}
function editionDir(ws,e){return path.join(root(ws),e.folderName||`${slug(e.title)}-${e.id.slice(0,8)}`)}
function seedFiles(ws,e){const dir=editionDir(ws,e);fs.mkdirSync(dir,{recursive:true});write(path.join(dir,"metadata.json"),e);for(const [name,data] of Object.entries({"structure.json":{books:[]},"apparatus.json":{entries:[]},"commentary.json":{entries:[]},"footnotes.json":{entries:[]},"publication.json":{status:e.status,checks:[]},"revisions.json":{revisions:e.revisions||[]}}))write(path.join(dir,name),data);}
function create(ws,input){const title=safe(input?.title);if(!ws||!title)return{success:false,message:"Workspace and edition title are required."};const editions=list(ws);const id=crypto.randomUUID();const createdAt=now();const folderName=`${slug(title)}-${id.slice(0,8)}`;const e={id,folderName,title,subtitle:safe(input.subtitle),description:safe(input.description),languages:Array.isArray(input.languages)?input.languages.filter(Boolean):[safe(input.language)||"Sanskrit"],tradition:safe(input.tradition),editors:Array.isArray(input.editors)?input.editors.filter(Boolean):[],institution:safe(input.institution),version:safe(input.version)||"0.1",license:safe(input.license)||"All rights reserved",keywords:Array.isArray(input.keywords)?input.keywords.filter(Boolean):[],doi:safe(input.doi),isbn:safe(input.isbn),status:"Draft",progress:defaultProgress(),stats:{books:0,chapters:0,verses:0,variants:0,decisions:0,footnotes:0,commentary:0,sources:0},createdAt,updatedAt:createdAt,revisions:[{id:crypto.randomUUID(),version:safe(input.version)||"0.1",label:"Edition created",createdAt}]};editions.unshift(e);persist(ws,editions);seedFiles(ws,e);return{success:true,message:`Created “${title}”.`,edition:e};}
function update(ws,input){const editions=list(ws),i=editions.findIndex(x=>x.id===input?.id);if(i<0)return{success:false,message:"Edition not found."};const old=editions[i];const patch={...input};delete patch.id;const changedVersion=patch.version&&patch.version!==old.version;const e={...old,...patch,updatedAt:now()};if(changedVersion)e.revisions=[...(old.revisions||[]),{id:crypto.randomUUID(),version:patch.version,label:safe(input.revisionLabel)||`Version ${patch.version}`,createdAt:now()}];editions[i]=e;persist(ws,editions);seedFiles(ws,e);return{success:true,message:"Edition updated.",edition:e};}
function remove(ws,id){const editions=list(ws),e=editions.find(x=>x.id===id);if(!e)return{success:false,message:"Edition not found."};persist(ws,editions.filter(x=>x.id!==id));fs.rmSync(editionDir(ws,e),{recursive:true,force:true});return{success:true,message:`Deleted “${e.title}”.`};}
function duplicate(ws,id){const src=list(ws).find(x=>x.id===id);if(!src)return{success:false,message:"Edition not found."};return create(ws,{...src,title:`${src.title} Copy`,version:"0.1"});}
export function registerEditionManagerIpc({ipcMain,shell}){
 ipcMain.handle("edition:list",async(_e,d)=>({success:true,message:"Loaded scholarly editions.",editions:list(String(d?.workspacePath||""))}));
 ipcMain.handle("edition:create",async(_e,d)=>create(String(d?.workspacePath||""),d));
 ipcMain.handle("edition:update",async(_e,d)=>update(String(d?.workspacePath||""),d));
 ipcMain.handle("edition:delete",async(_e,d)=>remove(String(d?.workspacePath||""),String(d?.id||"")));
 ipcMain.handle("edition:duplicate",async(_e,d)=>duplicate(String(d?.workspacePath||""),String(d?.id||"")));
 ipcMain.handle("edition:openFolder",async(_e,d)=>{const ws=String(d?.workspacePath||""),e=list(ws).find(x=>x.id===d?.id);if(!e)return{success:false,message:"Edition not found."};const err=await shell.openPath(editionDir(ws,e));return{success:!err,message:err||"Opened edition folder."};});
}
