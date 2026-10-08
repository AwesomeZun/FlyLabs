import {emptyWorkspace,seedWorkspace,uid,stamp} from '../server/seed.mjs';
import {applyAction,check,textField,enumField,entity,experiment,issuesFor,handover,audit} from '../server/domain.mjs';
import {normalizeNotebook,notebookAction,reopen,notebookText} from '../server/notebook.mjs';
import {evidence,evidenceAction,executeEvidence,selectedDocuments,importLegacy,graph} from '../server/evidence.mjs';
import {localDecision} from '../server/jev.mjs';
import {seedWorkspace as legacySeed} from '../shared/legacy-seed.mjs';
import {generalExamples} from '../shared/general-seed.mjs';
import {createHash} from './browser-crypto.mjs';

const USER={id:'local-browser',name:'이 브라우저의 연구자',email:''};
let dbPromise;
function database(){return dbPromise ||= new Promise((resolve,reject)=>{
 const request=indexedDB.open('FlyLabs-public-demo-v3',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('state');
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>{dbPromise=null;reject(new Error('브라우저 저장소를 열 수 없습니다. 사이트 저장 권한을 확인해 주세요.'));};
});}
function initial(){
 const w=seedWorkspace('academic');w.name='FlyLabs · 연구 체험실';
 w.members[0].name=USER.name;
 importLegacy(w,legacySeed(),w.members[0].id,'공개 합성 예시');
 for(const example of generalExamples()){
  const projectId=evidenceAction(w,w.members[0].id,'evidence.project.save',example);
  for(const d of example.documents){const id=evidenceAction(w,w.members[0].id,'evidence.document.save',{...d,projectId});const doc=w.evidence.documents.find(d=>d.id===id);doc.synthetic=true;doc.origin='공개 합성 예시';w.evidence.projects.find(p=>p.id===projectId).selected.push(id);}
 }
 return {workspaces:[w]};
}
function view(w){return {...w,evidence:evidence(w),myRole:'owner',actorId:w.members[0].id,access:[],experiments:w.experiments.map(e=>({...e,notebook:normalizeNotebook(e)})),issues:Object.fromEntries(w.experiments.map(e=>[e.id,issuesFor(w,e)]))};}
// One IndexedDB read/write transaction serializes tabs and commits only successful operations.
async function transact(fn){const db=await database();return new Promise((resolve,reject)=>{
 const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let result,failure;
 tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||new Error('저장하지 못했습니다. 브라우저의 저장 공간을 확인해 주세요.'));
 tx.onerror=()=>{};
 const read=store.get('workspaces');read.onsuccess=()=>{try{const state=read.result||initial();result=fn(state);store.put(state,'workspaces');}catch(e){failure=e;tx.abort();}};
});}
export async function demoApi(path,options={}){
 const url=new URL(path,'https://local.invalid'),parts=url.pathname.split('/').filter(Boolean),method=options.method||'GET',p=options.body?JSON.parse(options.body):{};
 if(path==='/health')return {ok:true,version:'5.0.0',mode:'browser-demo',storage:'IndexedDB',jevConfigured:false,geminiConfigured:false,model:'외부 AI 미연결',generationModel:'외부 AI 미연결'};
 if(path==='/auth/me')return {user:USER};
 if(path==='/connectome')return graph;
 if(parts[0]==='literature')throw new Error('공개 체험판에서는 검색 대신 논문 초록을 복사해 자료로 등록해 주세요.');
 return transact(state=>{
  if(path==='/demo/export')return {schema:'flylabs-browser-demo-v1',exportedAt:stamp(),state};
  if(parts[0]!=='workspaces')throw new Error('이 기능은 연구실 서버용입니다. 공개 체험판은 개인 브라우저에서 사용합니다.');
  if(parts.length===1){
   if(method==='GET')return state.workspaces.map(w=>({id:w.id,name:w.name,kind:w.kind,demo:w.demo,hasEvidence:!!evidence(w).projects.length}));
   const w=emptyWorkspace(textField(p.name,'연구실 이름',80),enumField(p.kind,['academic','biotech'],'연구실 종류'),USER.name);evidence(w);state.workspaces.push(w);return view(w);
  }
  const w=entity(state.workspaces,parts[1],'연구실'),actor=w.members[0].id;
  if(parts.length===2)return view(w);
  const op=parts[2];
  if(op==='export')return {schema:'flylabs-browser-workspace-v1',exportedAt:stamp(),workspace:w};
  if(op==='notebook')return notebookText(w,experiment(w,parts[3]));
  if(op==='handover')return handover(w,url.searchParams.getAll('experiment'),url.searchParams.get('from')||'',url.searchParams.get('to')||'');
  if(op==='files'&&method==='GET'){const f=entity(w.files,parts[3],'파일');return {name:f.name,data:f.data};}
  let result=null;
  if(op==='actions'){
   const payload=p.payload||{};
   if(p.type?.startsWith('evidence.'))result=evidenceAction(w,actor,p.type,payload);
   else if(p.type==='notebook.reopen')result=reopen(w,actor,payload);
   else if(p.type?.startsWith('notebook.')||p.type?.startsWith('entry.')||['ai.apply','ai.dismiss'].includes(p.type))result=notebookAction(w,actor,p.type,payload);
   else result=applyAction(w,{...p,actorId:actor});
  }else if(op==='evidence-run'){
   check(p.mode==='local','공개 체험판은 로컬 규칙 비교를 사용합니다. 외부 AI는 연결하지 않았습니다.');
   const docs=selectedDocuments(w,p),project=entity(evidence(w).projects,p.projectId,'프로젝트');
   const run=executeEvidence(docs,project,{routing:p.routing,mode:'local'});run.providerLatencyMs=0;run.authorId=actor;
   evidence(w).runs.unshift(run);audit(w,actor,null,'근거 조건 비교',docs.length+'개 · 로컬 규칙');result=run.id;
  }else if(op==='notes'){
   const e=experiment(w,p.experimentId),text=textField(p.text,'메모',10000);enumField(p.mode,['manual','rules'],'기록 방식');
   const decision=p.mode==='rules'?localDecision(text):{source:'manual',category:'other',status:null,confidence:null,model:null};
   const proposed=decision.status&&decision.status!==e.status?decision.status:null;result=uid();
   w.notes.unshift({id:result,experimentId:e.id,text,authorId:actor,createdAt:stamp(),...decision,proposal:proposed?{status:proposed}:null,review:proposed?'pending':'none',expectedUpdatedAt:e.updatedAt,stale:false});audit(w,actor,e.id,'진행 기록',text.slice(0,160));
  }else if(op==='files'&&method==='POST'){
   const e=experiment(w,p.experimentId);check(!normalizeNotebook(e).signed,'서명한 노트는 새 리비전을 연 뒤 파일을 추가하세요.',409);
   const name=textField(p.name,'파일명',200);check(!/[/\\\x00-\x1f]/.test(name),'파일명을 확인해 주세요.');
   const kind=enumField(p.kind,['result','protocol','reference'],'파일 종류');check(typeof p.data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(p.data),'파일 데이터를 확인해 주세요.');
   const bytes=Uint8Array.from(atob(p.data),c=>c.charCodeAt(0));check(bytes.length>0&&bytes.length<=10*1024*1024,'파일은 0 bytes 초과, 10 MB 이하여야 합니다.');result=uid();
   w.files.push({id:result,experimentId:e.id,name,kind,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),data:p.data,authorId:actor,createdAt:stamp()});audit(w,actor,e.id,'파일 연결',name);
  }else throw new Error('이 기능은 공개 체험판에서 제공하지 않습니다. 외부 AI와 팀 계정은 연구실 서버에서 연결합니다.');
  w.revision++;return {result,workspace:view(w)};
 });
}
export async function downloadDemoFile(wid,id){
 const file=await demoApi('/workspaces/'+wid+'/files/'+id),bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
