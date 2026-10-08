import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {uid,stamp,day} from './seed.mjs';
import {check,textField,entity,audit,applyAction,dateField} from './domain.mjs';
import {normalizeNotebook} from './notebook.mjs';
import {validateWorkspace,validDocument,FIELDS,extractFields,compareDocuments,createPlan,planMarkdown,safeUrl} from '../shared/research.mjs';
import {fieldsFor,templateFields} from '../shared/templates.mjs';
import {scheduleTasks} from '../shared/router.mjs';
export const graph=JSON.parse(readFileSync(new URL('../data/connectome.json',import.meta.url),'utf8'));
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function evidence(w){return w.evidence ||= {projects:[],documents:[],runs:[],preparations:[],imports:[]};}
export function selectedDocuments(w,p){
 const lib=evidence(w);entity(lib.projects,p.projectId,'프로젝트');
 check(Array.isArray(p.documentIds)&&p.documentIds.length>0&&p.documentIds.length<=8&&new Set(p.documentIds).size===p.documentIds.length,'자료를 1~8개 선택해 주세요.');
 const docs=p.documentIds.map(id=>entity(lib.documents,id,'자료'));
 check(docs.every(d=>d.projectId===p.projectId&&!d.archived),'현재 프로젝트의 자료만 선택해 주세요.');
 check(docs.reduce((n,d)=>n+d.text.length,0)<=80000,'선택 원문은 합계 80,000자 이하여야 합니다.');return docs;
}
export function importLegacy(w,input,actor,origin='JSON 가져오기'){
 check(JSON.stringify(input).length<=5*1024*1024,'백업은 5 MB 이하여야 합니다.');
 validateWorkspace(input);const lib=evidence(w),digest=hash(input);
 const existing=lib.imports.find(i=>i.sha256===digest);if(existing)return existing.projectId;
 const pid=uid(),ids=new Map(input.documents.map(d=>[d.id,uid()]));
 const project={id:pid,...structuredClone(input.project),templateId:'biology',conditionFields:templateFields('biology'),selected:(input.selected||[]).map(id=>ids.get(id)).filter(Boolean),baseId:ids.get(input.baseId)||'',checks:structuredClone(input.checks||{}),planNote:input.planNote||'',activity:structuredClone(input.activity||[]),createdAt:stamp(),revision:1};
 lib.projects.push(project);
 for(const d of input.documents)lib.documents.push({...structuredClone(d),id:ids.get(d.id),projectId:pid,templateId:'biology',conditionFields:templateFields('biology'),sourceId:d.id,origin,version:1,history:[],reviewedFields:{},extractionDrafts:[],updatedAt:d.createdAt||stamp(),archived:false});
 // Preserve the complete incoming record, including original dates, IDs and synthetic labels.
 for(const n of input.labNotes||[]){
  const exp={id:uid(),code:'FL-'+String(w.experiments.length+1).padStart(3,'0'),title:n.title||'가져온 실험',project:project.title,ownerId:actor,date:n.date,status:n.status==='onhold'?'blocked':n.status,priority:'normal',description:n.synthetic?'합성 예시에서 시작한 기록':'가져온 개인 연구 기록',protocol:'',requirements:[],tasks:[],createdAt:n.createdAt,updatedAt:n.updatedAt,synthetic:n.synthetic,legacyRecord:structuredClone(n)};
  const nb=normalizeNotebook(exp);Object.assign(nb.fields,{objective:n.objective,design:n.planned,procedure:n.actual,observations:n.results,analysis:n.interpretation,nextSteps:n.nextStep});
  if(n.actual)nb.entries.push({id:uid(),text:n.actual,authorId:actor,createdAt:n.updatedAt,amendsId:null,origin:'가져온 개인 기록; 원본에 계정 작성자 정보 없음'});
  exp.evidenceSourceIds=n.source&&ids.has(n.source.id)?[ids.get(n.source.id)]:[];w.experiments.push(exp);
 }
 lib.imports.push({id:uid(),projectId:pid,origin,sha256:digest,createdAt:stamp(),documents:input.documents.length,notebooks:(input.labNotes||[]).length,original:structuredClone(input)});
 if(actor)audit(w,actor,null,'자료 프로젝트 가져오기',project.title+' · 자료 '+input.documents.length+'개');return pid;
}
export function evidenceAction(w,actor,type,p){
 const lib=evidence(w);
 if(type==='evidence.import')return importLegacy(w,p.workspace,actor);
 if(type==='evidence.project.save'){
  const title=textField(p.title,'프로젝트명',120),goal=textField(p.goal||'','연구 목적',2000,false);
  if(p.id){const old=entity(lib.projects,p.id,'프로젝트');check(p.expectedRevision===old.revision,'프로젝트가 변경되었습니다. 최신 내용을 다시 확인하세요.',409);Object.assign(old,{title,goal,revision:old.revision+1});return old.id;}
  const templateId=p.templateId||'general';let conditionFields;try{conditionFields=templateFields(templateId,p.conditionLabels);}catch(e){check(false,e.message);}
  const project={id:uid(),title,goal,templateId,conditionFields,selected:[],baseId:'',checks:{},planNote:'',activity:[],createdAt:stamp(),revision:1};lib.projects.push(project);audit(w,actor,null,'자료 프로젝트 생성',title);return project.id;
 }
 if(type==='evidence.document.save'){
  const project=entity(lib.projects,p.projectId,'프로젝트');const incoming={title:textField(p.title,'자료 제목',300),text:textField(p.text,'원문',40000),kind:['paper','note','meeting','protocol'].includes(p.kind)?p.kind:'note',url:safeUrl(p.url||'')};
  if(p.id){const d=entity(lib.documents,p.id,'자료');check(d.projectId===p.projectId,'프로젝트가 다릅니다.');check(d.version===p.expectedVersion,'자료가 먼저 변경되었습니다. 입력을 보관하고 다시 확인하세요.',409);d.history.push({version:d.version,title:d.title,text:d.text,reviewedFields:structuredClone(d.reviewedFields),authorId:actor,at:stamp()});Object.assign(d,incoming,{version:d.version+1,updatedAt:stamp(),reviewedFields:{}});audit(w,actor,null,'자료 원문 수정',d.title);return d.id;}
  check(lib.documents.length<1000,'자료를 보관하거나 프로젝트를 나누어 주세요.');
  const d={id:uid(),projectId:p.projectId,templateId:project.templateId,conditionFields:fieldsFor(project),...incoming,synthetic:false,abstractOnly:p.abstractOnly===true,createdAt:stamp(),updatedAt:stamp(),authorId:actor,version:1,history:[],reviewedFields:{},extractionDrafts:[],archived:false};lib.documents.push(d);audit(w,actor,null,'자료 등록',d.title);return d.id;
 }
 if(type==='evidence.document.archive'){
  const d=entity(lib.documents,p.id,'자료');check(d.version===p.expectedVersion,'자료가 변경되었습니다.',409);d.archived=p.archived!==false;d.version++;audit(w,actor,null,d.archived?'자료 보관':'자료 복원',d.title);return d.id;
 }
 if(type==='evidence.extraction.review'){
  const d=entity(lib.documents,p.documentId,'자료'),draft=entity(d.extractionDrafts,p.id,'추출 초안');check(draft.review==='pending','이미 검토한 초안입니다.',409);
  if(p.decision==='dismiss'){draft.review='dismissed';return draft.id;}
  check(p.decision==='apply'&&p.expectedVersion===d.version&&draft.baseVersion===d.version,'원문이 변경되었거나 검토 요청이 올바르지 않습니다. 다시 추출해 주세요.',409);
  check(Array.isArray(p.keys)&&p.keys.length>0&&p.keys.every(k=>draft.fields.some(f=>f.key===k)),'반영할 조건을 선택해 주세요.');
  d.history.push({version:d.version,title:d.title,text:d.text,reviewedFields:structuredClone(d.reviewedFields),authorId:actor,at:stamp()});
  for(const f of draft.fields.filter(f=>p.keys.includes(f.key)))d.reviewedFields[f.key]={...f,sourceId:d.id,method:'reviewed-ai',reviewedBy:actor,reviewedAt:stamp()};
  d.version++;draft.review='applied';draft.appliedKeys=p.keys;draft.reviewedBy=actor;audit(w,actor,null,'AI 조건 추출 검토 후 반영',d.title);return d.id;
 }
 if(type==='evidence.prepare'){
  const project=entity(lib.projects,p.projectId,'프로젝트'),d=entity(lib.documents,p.documentId,'기준 자료');check(d.projectId===project.id&&!d.archived,'현재 프로젝트의 자료를 선택해 주세요.');check(d.version===p.expectedVersion&&project.revision===p.expectedProjectRevision,'자료 또는 연구 목적이 변경되었습니다. 준비표를 다시 확인하세요.',409);
  const checks=p.checks||{};check(typeof checks==='object'&&!Array.isArray(checks)&&Object.values(checks).every(v=>typeof v==='boolean'),'확인 목록 형식이 올바르지 않습니다.');
  const FIELDS=fieldsFor(d);const plan=createPlan(project,d,textField(p.note||'','연구자 메모',5000,false),Object.fromEntries(FIELDS.map(f=>[d.id+':'+f.key,!!checks[f.key]])));
  const prep={id:uid(),projectId:project.id,documentId:d.id,sourceVersion:d.version,sourceSnapshot:structuredClone(d),plan,text:planMarkdown(plan),createdAt:stamp(),authorId:actor};lib.preparations.unshift(prep);audit(w,actor,null,'근거 준비표 저장',d.title);return prep.id;
 }
 if(type==='evidence.start'){
  const prep=entity(lib.preparations,p.id,'준비표');check(!prep.experimentId,'이미 이 준비표에서 실험을 시작했습니다.',409);
  const FIELDS=prep.plan.definitions||fieldsFor(prep.sourceSnapshot);
  const id=applyAction(w,{type:'experiment.create',actorId:actor,payload:{title:textField(p.title||prep.plan.project+' · 실험','실험명',160),project:prep.plan.project.slice(0,80),ownerId:actor,date:dateField(p.date||day()),description:prep.plan.goal.slice(0,3000),protocol:'근거 준비표를 랩노트에서 확인하세요.',checklist:FIELDS.map(f=>f.label+' 확인').join('\n'),requirements:[]}});
  const exp=entity(w.experiments,id,'실험'),n=normalizeNotebook(exp);n.fields.objective=prep.plan.goal;n.fields.design=prep.text;n.fields.materials=FIELDS.map(f=>f.label+': '+(prep.plan.fields[f.key]?.value||'확인 필요')).join('\n');n.fields.limitations=prep.plan.missing.map(k=>FIELDS.find(f=>f.key===k).label+' 미확인').join('\n');
  exp.synthetic=!!prep.plan.source.synthetic;exp.evidenceSourceIds=[prep.documentId];exp.preparationId=prep.id;prep.experimentId=id;return id;
 }
 check(false,'지원하지 않는 자료 작업입니다.');
}
export function executeEvidence(documents,project,{routing='connectome',judgments=[],model=null,mode='local'}={}){
 check(['connectome','baseline'].includes(routing),'처리 방식을 확인해 주세요.');
 const needsReview=documents.some(d=>{const p=extractFields(d);return p.missing.length||p.conflicts.length;})||judgments.some(j=>j.review);
 const started=performance.now(),trace=[];let comparison,preparedPlans=[];
 for(const task of scheduleTasks(graph,{needsReview,mode:routing})){
  const begin=performance.now();let count=0;
  if(task.id==='extract')count=documents.reduce((n,d)=>n+fieldsFor(d).length-extractFields(d).missing.length,0);
  if(task.id==='missing')count=documents.reduce((n,d)=>n+extractFields(d).missing.length,0);
  if(task.id==='compare'){comparison=compareDocuments(documents);count=comparison.different;}
  if(task.id==='review')count=documents.filter(d=>{const p=extractFields(d);return p.missing.length||p.conflicts.length||judgments.some(j=>j.id===d.id&&j.review);}).length;
  if(task.id==='prepare'){preparedPlans=documents.map(d=>createPlan(project,d));count=preparedPlans.length;}
  trace.push({...task,count,status:'completed',latencyMs:performance.now()-begin});
 }
 return {id:uid(),projectId:project.id,projectRevision:project.revision,mode,routing,model,judgments,comparison,preparedPlans,trace,documentVersions:Object.fromEntries(documents.map(d=>[d.id,d.version])),sourceSnapshot:structuredClone(documents),baseline:scheduleTasks(graph,{needsReview,mode:'baseline'}).map(t=>t.id),durationMs:performance.now()-started,createdAt:stamp(),graph:{dataset:graph.dataset,nodes:graph.nodes.length,edges:graph.edges.length},scientificPerformanceMeasured:false};
}
