import fs from "fs";
import path from "path";
import crypto from "crypto";

const now=()=>new Date().toISOString();
const read=(file,fallback)=>{try{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):fallback}catch{return fallback}};
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2),"utf8")};
const compact=v=>String(v??"").replace(/\s+/g," ").trim();
const indexFile=ws=>path.join(ws,".ocr-studio","editions","editions.json");
const edition=(ws,id)=>(read(indexFile(ws),{editions:[]}).editions||[]).find(x=>x.id===id)||null;
const dir=(ws,e)=>path.join(ws,".ocr-studio","editions",e.folderName);
const reportFile=(ws,e)=>path.join(dir(ws,e),"publication-validation-report.json");
const loadEntries=(ws,e,name)=>{const value=read(path.join(dir(ws,e),name),{entries:[]});return Array.isArray(value?.entries)?value.entries:[]};
const allVerses=structure=>{
 const rows=[];
 for(const b of structure.books||[])for(const c of b.chapters||[])for(const v of c.verses||[])rows.push({book:b,chapter:c,verse:v,locator:`${b.title||`Book ${b.number}`} · ${c.title||`Chapter ${c.number}`} · Verse ${v.number}`});
 return rows;
};
const issue=(category,severity,title,detail,location="Edition",suggestedFix="",verseId="")=>({id:crypto.randomUUID(),category,severity,title,detail,location,suggestedFix,verseId});
const pct=(a,b)=>b?Math.round(a/b*100):0;

function analyze(ws,editionId){
 const e=edition(ws,editionId);if(!e)return{success:false,message:"Edition not found."};
 const structure=read(path.join(dir(ws,e),"structure.json"),{books:[]});
 const verses=allVerses(structure),apparatus=loadEntries(ws,e,"apparatus.json"),commentary=loadEntries(ws,e,"commentary.json"),footnotes=loadEntries(ws,e,"footnotes.json"),decisions=loadEntries(ws,e,"editorial-decisions.json"),evidence=loadEntries(ws,e,"editorial-decision-evidence.json"),suggestions=loadEntries(ws,e,"editorial-ai-suggestions.json");
 const issues=[];
 const add=(...args)=>issues.push(issue(...args));

 // Metadata checks
 if(!compact(e.title))add("Metadata","Blocker","Edition title is missing","A publication requires a title.","Edition metadata","Add a clear scholarly title.");
 if(!(e.editors||[]).length)add("Metadata","Warning","No editor is listed","Editorial responsibility is not identified.","Edition metadata","Add at least one editor.");
 if(!compact(e.license))add("Metadata","Blocker","Publication license is missing","Readers and repositories need explicit reuse terms.","Edition metadata","Select a publication license.");
 if(!compact(e.description))add("Metadata","Info","Edition description is empty","A concise abstract improves discovery and archival metadata.","Edition metadata","Add a description or abstract.");
 if(!compact(e.institution))add("Metadata","Info","Institution is not specified","Institutional affiliation is optional but useful.","Edition metadata","Add an institution when applicable.");
 if(!verses.length)add("Structure","Blocker","Edition contains no verses","There is no publishable critical text.","Edition structure","Create books, chapters and verses.");

 // Structure and numbering
 for(const b of structure.books||[]){
   if(!(b.chapters||[]).length)add("Structure","Warning","Book has no chapters",`“${b.title||b.number}” is empty.`,b.title||`Book ${b.number}`,"Add chapters or remove the empty book.");
   const chapterNumbers=new Set();
   for(const c of b.chapters||[]){
     const ck=String(c.number);if(chapterNumbers.has(ck))add("Structure","Blocker","Duplicate chapter number",`Chapter number ${ck} occurs more than once in this book.`,`${b.title} · Chapter ${ck}`,"Renumber chapters uniquely.");chapterNumbers.add(ck);
     const verseNumbers=new Set();
     for(const v of c.verses||[]){const vk=String(v.number);if(verseNumbers.has(vk))add("Structure","Blocker","Duplicate verse number",`Verse number ${vk} occurs more than once in this chapter.`,`${b.title} · ${c.title}`,"Renumber verses uniquely.",v.id);verseNumbers.add(vk);}
   }
 }

 const decisionByVerse=new Map();for(const d of decisions){const a=decisionByVerse.get(d.verseId)||[];a.push(d);decisionByVerse.set(d.verseId,a)}
 const apparatusByVerse=new Map();for(const a of apparatus){const x=apparatusByVerse.get(a.verseId)||[];x.push(a);apparatusByVerse.set(a.verseId,x)}
 const evidenceByDecision=new Map();for(const x of evidence){const a=evidenceByDecision.get(x.decisionId)||[];a.push(x);evidenceByDecision.set(x.decisionId,a)}

 const languageNames=[...new Set(verses.flatMap(x=>Object.keys(x.verse.languages||{})))];
 const translationCoverage={};for(const lang of languageNames)translationCoverage[lang]=pct(verses.filter(x=>compact(x.verse.languages?.[lang])).length,verses.length);
 let criticalComplete=0,approved=0,reviewedDecisions=0,validApparatus=0,validFootnotes=0;

 for(const row of verses){const v=row.verse,loc=row.locator;
   if(compact(v.criticalText))criticalComplete++;else add("Critical text","Blocker","Critical text is empty","This verse has no established base text.",loc,"Enter or establish the critical reading.",v.id);
   if(["Approved","Published","Reviewed"].includes(v.status))approved++;else add("Editorial review","Warning","Verse is not approved",`Current verse status is “${v.status||"Draft"}”.`,loc,"Complete editorial review and approve the verse.",v.id);
   const ds=decisionByVerse.get(v.id)||[];
   if(!ds.length)add("Editorial decisions","Warning","No editorial decision recorded","The selected reading has no auditable rationale.",loc,"Record an editorial decision with reasons and witnesses.",v.id);
   for(const d of ds){
     if(["Accepted","Rejected","Superseded"].includes(d.status))reviewedDecisions++;
     if(!compact(d.reason)&&!compact(d.content))add("Editorial decisions","Blocker","Decision has no rationale",`Decision “${d.label||"Untitled"}” does not explain the editorial choice.`,loc,"Add a reason explaining the choice.",v.id);
     if(!(d.witnesses||[]).length)add("Editorial decisions","Warning","Decision has no witnesses",`Decision “${d.label||"Untitled"}” lists no supporting witnesses.`,loc,"Attach witness sigla or supporting sources.",v.id);
     if(["Proposed","Under Review"].includes(d.status||"Proposed"))add("Editorial decisions","Warning","Decision is still pending",`Decision “${d.label||"Untitled"}” is ${d.status||"Proposed"}.`,loc,"Accept, reject or supersede the decision.",v.id);
     if(!(evidenceByDecision.get(d.id)||[]).length)add("Evidence","Warning","Decision has no attached evidence",`Decision “${d.label||"Untitled"}” is not linked to manuscript or commentary evidence.`,loc,"Attach evidence in the Editorial Decision Engine.",v.id);
   }
   const av=apparatusByVerse.get(v.id)||[];
   for(const a of av){
     const good=compact(a.reading)&&Array.isArray(a.witnesses)&&a.witnesses.length>0;if(good)validApparatus++;
     if(!compact(a.reading))add("Apparatus","Blocker","Apparatus reading is empty",`Apparatus entry “${a.label||"Untitled"}” has no reading.`,loc,"Enter the variant reading.",v.id);
     if(!(a.witnesses||[]).length)add("Apparatus","Warning","Apparatus entry has no witnesses",`Apparatus entry “${a.label||"Untitled"}” has no witness sigla.`,loc,"Add one or more witnesses.",v.id);
   }
   for(const lang of languageNames)if(!compact(v.languages?.[lang]))add("Translations","Info",`${lang} text is missing`,`Parallel ${lang} text is unavailable for this verse.`,loc,`Add ${lang} text or mark it intentionally unavailable.`,v.id);
 }
 for(const f of footnotes){if(compact(f.content))validFootnotes++;else add("Footnotes","Blocker","Footnote is empty",`Footnote “${f.label||"Untitled"}” contains no text.`,"Footnotes","Enter footnote content or delete the entry.",f.verseId);}
 const duplicateApp=new Map();for(const a of apparatus){const k=`${a.verseId}|${compact(a.reading).toLowerCase()}|${(a.witnesses||[]).slice().sort().join(",")}`;if(duplicateApp.has(k))add("Apparatus","Warning","Possible duplicate apparatus entry",`The reading “${compact(a.reading).slice(0,90)}” is repeated with the same witnesses.`,"Apparatus","Merge or remove the duplicate.",a.verseId);else duplicateApp.set(k,a.id)}
 const pendingAi=suggestions.filter(x=>x.status==="Proposed");if(pendingAi.length)add("AI review","Warning","AI editorial suggestions remain unreviewed",`${pendingAi.length} suggestion(s) are still Proposed.`,"AI Editorial Assistant","Accept or reject each suggestion before publication.");

 const metadataFields=[e.title,(e.editors||[]).join(""),e.license,e.description,e.version];const metadataScore=pct(metadataFields.filter(compact).length,metadataFields.length);
 const criticalScore=pct(criticalComplete,verses.length);
 const reviewScore=Math.round((pct(approved,verses.length)+pct(reviewedDecisions,Math.max(decisions.length,1)))/2);
 const apparatusScore=apparatus.length?pct(validApparatus,apparatus.length):(verses.length?70:0);
 const citationScore=footnotes.length?pct(validFootnotes,footnotes.length):60;
 const translationScore=languageNames.length?Math.round(Object.values(translationCoverage).reduce((a,b)=>a+b,0)/languageNames.length):100;
 const aiScore=suggestions.length?pct(suggestions.length-pendingAi.length,suggestions.length):100;
 const evidenceScore=decisions.length?pct(decisions.filter(d=>(evidenceByDecision.get(d.id)||[]).length).length,decisions.length):60;
 const scores={"Critical text":criticalScore,"Editorial review":reviewScore,"Apparatus":apparatusScore,"Footnotes & citations":citationScore,"Translation coverage":translationScore,"Evidence":evidenceScore,"AI review":aiScore,"Metadata":metadataScore};
 const weights={"Critical text":20,"Editorial review":20,"Apparatus":15,"Footnotes & citations":15,"Translation coverage":10,"Evidence":10,"AI review":5,"Metadata":5};
 const readiness=Math.round(Object.entries(scores).reduce((sum,[k,v])=>sum+v*weights[k]/100,0));
 const counts={passed:0,blockers:issues.filter(x=>x.severity==="Blocker").length,warnings:issues.filter(x=>x.severity==="Warning").length,info:issues.filter(x=>x.severity==="Info").length};
 counts.passed=Math.max(0,verses.length*4+apparatus.length+decisions.length+footnotes.length-issues.length);
 const status=counts.blockers?"NOT READY":readiness>=90?"READY FOR PUBLICATION":readiness>=75?"READY FOR REVIEW":"NEEDS EDITORIAL WORK";
 const checklist=[
   ["Critical text complete",criticalScore===100],["All verses approved",reviewScore>=95],["Apparatus valid",apparatusScore===100],["Footnotes valid",citationScore===100],["Translations complete",translationScore===100],["Editorial evidence linked",evidenceScore===100],["AI suggestions reviewed",aiScore===100],["Metadata complete",metadataScore===100]
 ].map(([label,complete])=>({label,complete}));
 const report={version:1,id:crypto.randomUUID(),editionId:e.id,editionTitle:e.title,generatedAt:now(),readiness,status,counts,scores,weights,translationCoverage,checklist,summary:{books:(structure.books||[]).length,chapters:(structure.books||[]).reduce((n,b)=>n+(b.chapters||[]).length,0),verses:verses.length,apparatus:apparatus.length,decisions:decisions.length,footnotes:footnotes.length,commentary:commentary.length,aiSuggestions:suggestions.length},issues};
 write(reportFile(ws,e),report);
 const idx=read(indexFile(ws),{version:1,editions:[]});const target=(idx.editions||[]).find(x=>x.id===e.id);if(target){target.progress={...(target.progress||{}),publication:readiness};target.publicationValidation={readiness,status,blockers:counts.blockers,warnings:counts.warnings,generatedAt:report.generatedAt};target.updatedAt=now();write(indexFile(ws),idx)}
 return{success:true,message:`Validation complete: ${readiness}% readiness, ${counts.blockers} blocker(s).`,report};
}
function get(ws,id){const e=edition(ws,id);if(!e)return null;return read(reportFile(ws,e),null)}
function escapeHtml(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function exportReport(ws,id,format){const e=edition(ws,id);if(!e)return{success:false,message:"Edition not found."};const report=get(ws,id);if(!report)return{success:false,message:"Run validation before exporting."};const exportsDir=path.join(dir(ws,e),"exports");fs.mkdirSync(exportsDir,{recursive:true});const stamp=report.generatedAt.replace(/[:.]/g,"-");if(format==="json"){const target=path.join(exportsDir,`publication-validation-${stamp}.json`);write(target,report);return{success:true,message:"JSON validation report exported.",filePath:target}}
 const rows=report.issues.map(x=>`<tr><td><span class="sev ${x.severity.toLowerCase()}">${escapeHtml(x.severity)}</span></td><td>${escapeHtml(x.category)}</td><td><strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.detail)}</small></td><td>${escapeHtml(x.location)}</td><td>${escapeHtml(x.suggestedFix)}</td></tr>`).join("");
 const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(e.title)} — Publication Validation</title><style>body{font:14px system-ui;margin:36px;color:#222}h1{margin-bottom:4px}.score{font-size:42px;font-weight:800}table{border-collapse:collapse;width:100%;margin-top:24px}th,td{border:1px solid #ddd;padding:9px;text-align:left;vertical-align:top}.sev{font-weight:700}.blocker{color:#a00000}.warning{color:#a65a00}.info{color:#315a8a}small{color:#666}</style></head><body><h1>${escapeHtml(e.title)}</h1><p>Publication validation report · ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p><div class="score">${report.readiness}%</div><h2>${escapeHtml(report.status)}</h2><p>${report.counts.blockers} blockers · ${report.counts.warnings} warnings · ${report.counts.info} informational items</p><table><thead><tr><th>Severity</th><th>Category</th><th>Issue</th><th>Location</th><th>Suggested fix</th></tr></thead><tbody>${rows||"<tr><td colspan=5>No issues found.</td></tr>"}</tbody></table></body></html>`;
 const target=path.join(exportsDir,`publication-validation-${stamp}.html`);fs.writeFileSync(target,html,"utf8");return{success:true,message:"HTML validation report exported.",filePath:target};
}
export function registerPublicationValidatorIpc({ipcMain,shell}){
 ipcMain.handle("editionValidator:get",async(_e,d)=>{const r=get(String(d?.workspacePath||""),String(d?.editionId||""));return r?{success:true,message:"Validation report loaded.",report:r}:{success:false,message:"No validation report exists yet."}});
 ipcMain.handle("editionValidator:run",async(_e,d)=>analyze(String(d?.workspacePath||""),String(d?.editionId||"")));
 ipcMain.handle("editionValidator:export",async(_e,d)=>exportReport(String(d?.workspacePath||""),String(d?.editionId||""),String(d?.format||"html")));
 ipcMain.handle("editionValidator:open",async(_e,d)=>{const err=await shell.openPath(String(d?.filePath||""));return{success:!err,message:err||"Opened validation report."}});
}
