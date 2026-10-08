import './config.mjs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openStore } from './store.mjs';
import { uid, stamp, emptyWorkspace } from './seed.mjs';
import { ApiError, check, textField, enumField, experiment, entity, applyAction, audit, handover, issuesFor } from './domain.mjs';
import { classifyNote, localDecision } from './jev.mjs';
import { createAuth } from './auth.mjs';
import { normalizeNotebook, notebookAction, reopen, notebookText } from './notebook.mjs';
import { draftNotebook } from './assistant.mjs';
import { VERSION } from './config.mjs';
import {evidence,evidenceAction,selectedDocuments,executeEvidence,graph,importLegacy} from './evidence.mjs';
import {judgeEvidence,extractEvidence,searchLiterature} from './evidence-ai.mjs';
import {seedWorkspace as legacySeed} from '../shared/legacy-seed.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'};
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;check(size<=15*1024*1024,'파일은 10 MB 이하로 업로드해 주세요.',413);chunks.push(c);}let p;try{p=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new ApiError('요청 형식이 올바르지 않습니다.');}check(p&&typeof p==='object'&&!Array.isArray(p),'요청 객체가 필요합니다.');return p;}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function cookie(res,token){res.setHeader('Set-Cookie','flylabs_v3_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(token?604800:0)+(process.env.PUBLIC_ORIGIN?.startsWith('https://')?'; Secure':''));}
export function createApp({dataDir=process.env.FLYLABS_DATA_DIR||path.join(root,'.data'),seed=true,jevOptions,assistantOptions,evidenceOptions={}}={}){
 const store=openStore(dataDir,seed),auth=createAuth(store),rates=new Map(),aiBusy=new Set();
 if(seed&&!store.list().some(s=>store.load(s.id).evidence?.projects?.length)){const w=emptyWorkspace('FlyLabs · 근거와 실험');w.demo=true;importLegacy(w,legacySeed(),w.members[0].id,'v1.1.0 합성 예시 원본');store.insert(w);}
 const view=(w,user)=>{const a=auth.permission(w,user);return {...w,evidence:evidence(w),myRole:a.role,actorId:a.memberId,experiments:w.experiments.map(e=>({...e,notebook:normalizeNotebook(e)})),issues:Object.fromEntries(w.experiments.map(e=>[e.id,issuesFor(w,e)]))};};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try{
   const host=req.headers.host||'',publicOrigin=process.env.PUBLIC_ORIGIN;
   const isLocal=/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host);
   check(isLocal||(publicOrigin&&new URL(publicOrigin).host===host),'허용되지 않은 서버 주소입니다.',403);
   if(req.headers.origin){let valid=false;try{const o=new URL(req.headers.origin);valid=(o.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(o.hostname)&&[String(server.address()?.port),'4210'].includes(o.port))||o.origin===publicOrigin;}catch{}check(valid,'다른 사이트의 요청은 허용하지 않습니다.',403);}
   check(req.headers['sec-fetch-site']!=='cross-site','다른 사이트의 요청은 허용하지 않습니다.',403);
   const url=new URL(req.url,'http://'+host),parts=url.pathname.split('/').filter(Boolean);
   if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,version:VERSION,jevConfigured:!!(process.env.JEV_API_KEY||process.env.TYPESAFE_API_KEY),geminiConfigured:!!process.env.GEMINI_API_KEY,model:process.env.JEV_MODEL||'jev-1.13.0',generationModel:process.env.GEMINI_MODEL||'gemini-3.1-flash-lite',mode:'authenticated',storage:'sqlite'});
   const user=auth.getUser(req);
   if(url.pathname==='/api/auth/me'&&req.method==='GET')return json(res,200,{user});
   if(parts[0]==='api'&&parts[1]==='auth'&&req.method==='POST'){
    const ip=req.socket.remoteAddress,now=Date.now();for(const [key,v] of rates)if(v.until<now)rates.delete(key);
    const count=rates.get(ip)||{n:0,until:now+60000};count.n++;rates.set(ip,count);check(count.n<=30,'요청이 많습니다. 1분 후 다시 시도해 주세요.',429);
    if(parts[2]==='register'||parts[2]==='login'){const p=await body(req),result=await auth[parts[2]](p);cookie(res,result.token);return json(res,200,{user:result.user});}
    check(user,'로그인이 필요합니다.',401);
    if(parts[2]==='logout'){auth.logout(req);cookie(res,'');return json(res,200,{ok:true});}
    if(parts[2]==='password'){const result=await auth.changePassword(user,await body(req));cookie(res,result.token);return json(res,200,{ok:true});}
   }
   if(parts[0]==='api')check(user,'로그인이 필요합니다.',401);
   if(url.pathname==='/api/connectome'&&req.method==='GET')return json(res,200,graph);
   if(url.pathname==='/api/literature'&&req.method==='GET')return json(res,200,await searchLiterature(url.searchParams.get('q'),evidenceOptions.literatureFetch));
   if(url.pathname==='/api/invitations/accept'&&req.method==='POST')return json(res,200,{workspaceId:auth.accept(user,(await body(req)).token)});
   if(url.pathname==='/api/workspaces'){
    if(req.method==='GET')return json(res,200,store.list().filter(s=>store.load(s.id).access?.some(a=>a.userId===user.id)));
    if(req.method==='POST'){const p=await body(req),w=emptyWorkspace(textField(p.name,'연구실 이름',80),enumField(p.kind,['academic','biotech'],'연구실 종류'),user.name);w.members=[];auth.grant(w,user,'owner');store.insert(w);return json(res,201,w);}
   }
   if(parts[0]==='api'&&parts[1]==='workspaces'&&parts[2]){
    const wid=parts[2];const w=store.load(wid),access=auth.permission(w,user,req.method!=='GET'),actorId=access.memberId;
    if(parts.length===3&&req.method==='GET')return json(res,200,view(w,user));
    if(parts[3]==='invitations'&&req.method==='GET')return json(res,200,auth.invitations(w,user));
    if(parts[3]==='invitations'&&parts[4]==='revoke'&&req.method==='POST'){auth.revoke(w,user,(await body(req)).id);return json(res,200,{ok:true});}
    if(parts[3]==='invitations'&&req.method==='POST')return json(res,201,auth.invite(w,user,await body(req)));
    if(parts[3]==='permissions'&&req.method==='POST'){auth.changeRole(w,user,await body(req));return json(res,200,{ok:true});}
    if(parts[3]==='actions'&&req.method==='POST'){
     const input=await body(req);input.actorId=actorId;
     if(input.type==='member.add')check(access.role==='owner','관리자만 담당자를 등록할 수 있습니다.',403);
     const result=store.update(wid,current=>{
      if(input.type?.startsWith('evidence.'))return evidenceAction(current,actorId,input.type,input.payload||{});
      if(input.type==='notebook.reopen')return reopen(current,actorId,input.payload||{});
      if(input.type?.startsWith('notebook.')||input.type?.startsWith('entry.')||input.type==='ai.apply'||input.type==='ai.dismiss')return notebookAction(current,actorId,input.type,input.payload||{});
      return applyAction(current,input);
     });return json(res,200,{...result,workspace:view(result.workspace,user)});
    }
    if(parts[3]==='evidence-run'&&req.method==='POST'){
     const p=await body(req),docs=selectedDocuments(w,p),project=entity(evidence(w).projects,p.projectId,'프로젝트');
     check(['local','jev'].includes(p.mode),'판단 모드를 확인하세요.');check(['connectome','baseline'].includes(p.routing),'처리 방식을 확인하세요.');
     let j={judgments:[],model:null};
     if(p.mode==='jev'){check(!aiBusy.has(user.id),'이전 AI 요청이 끝난 뒤 다시 시도해 주세요.',429);aiBusy.add(user.id);try{j=await judgeEvidence(docs,project.goal,evidenceOptions.jev||jevOptions);}finally{aiBusy.delete(user.id);}}
     const run=executeEvidence(docs,project,{mode:p.mode,routing:p.routing,...j});run.providerLatencyMs=j.latencyMs||0;run.authorId=actorId;
     const result=store.update(wid,current=>{auth.permission(current,user,true);const lib=evidence(current);check(entity(lib.projects,project.id,'프로젝트').revision===project.revision&&docs.every(d=>lib.documents.find(x=>x.id===d.id)?.version===d.version),'분석 중 원문이나 연구 목적이 변경되었습니다. 다시 실행하세요.',409);lib.runs.unshift(run);audit(current,actorId,null,'근거 조건 비교',docs.length+'개 · '+p.mode+' · '+p.routing);return run.id;});return json(res,201,{...result,workspace:view(result.workspace,user)});
    }
    if(parts[3]==='evidence-extract'&&req.method==='POST'){
     const p=await body(req),doc=entity(evidence(w).documents,p.documentId,'자료');check(!doc.archived,'보관한 자료입니다.');check(!aiBusy.has(user.id),'이전 AI 요청이 끝난 뒤 다시 시도해 주세요.',429);
     aiBusy.add(user.id);let draft;try{draft=await extractEvidence(doc,evidenceOptions.gemini||assistantOptions);}finally{aiBusy.delete(user.id);}
     const result=store.update(wid,current=>{auth.permission(current,user,true);const d=entity(evidence(current).documents,doc.id,'자료');check(d.version===doc.version,'요청 중 원문이 변경되었습니다. 다시 추출하세요.',409);const id=uid();d.extractionDrafts.unshift({...draft,id,createdAt:stamp(),authorId:actorId});audit(current,actorId,null,'AI 조건 추출 초안',d.title);return id;});return json(res,201,{...result,workspace:view(result.workspace,user)});
    }
    if(parts[3]==='notes'&&req.method==='POST'){
     const p=await body(req),e=experiment(w,p.experimentId),text=textField(p.text,'메모',10000),mode=enumField(p.mode,['manual','rules','jev'],'기록 방식');
     let decision={source:'manual',category:'other',status:null,confidence:null,model:null};
     if(mode==='rules')decision=localDecision(text);
     if(mode==='jev'){check(!aiBusy.has(user.id),'이전 AI 요청이 끝난 뒤 다시 시도해 주세요.',429);aiBusy.add(user.id);try{decision=await classifyNote(text,e,jevOptions);}catch(err){if(err instanceof ApiError)throw err;throw new ApiError('Jev 응답을 받지 못했습니다. 입력은 유지됩니다.',502);}finally{aiBusy.delete(user.id);}}
     const result=store.update(wid,current=>{auth.permission(current,user,true);const live=experiment(current,e.id),proposedStatus=decision.status&&decision.status!==live.status?decision.status:null,stale=live.updatedAt!==e.updatedAt,id=uid();current.notes.unshift({id,experimentId:e.id,text,authorId:actorId,createdAt:stamp(),...decision,proposal:proposedStatus&&!stale?{status:proposedStatus}:null,review:proposedStatus&&!stale?'pending':'none',expectedUpdatedAt:live.updatedAt,stale});audit(current,actorId,e.id,'진행 기록',text.slice(0,160));return id;});return json(res,201,{...result,workspace:view(result.workspace,user)});
    }
    if(parts[3]==='assistant'&&req.method==='POST'){
     const p=await body(req),e=experiment(w,p.experimentId),n=normalizeNotebook(e),kind=enumField(p.kind,['plan','results'],'초안 종류');
     check(!n.signed,'서명한 노트는 새 리비전을 연 뒤 사용해 주세요.',409);check(!aiBusy.has(user.id),'이전 AI 요청이 끝난 뒤 다시 시도해 주세요.',429);
     const input=textField(p.text||'','정리할 내용',12000,false),sources=[];
     if(input)sources.push({id:'input',text:input});
     if(p.includeNotebook)for(const [key,text] of Object.entries(n.fields))if(text)sources.push({id:'field:'+key,text});
     if(p.includeEntries)for(const entry of n.entries.slice(0,20))sources.push({id:'entry:'+entry.id,text:entry.text});
     check(Array.isArray(p.fileIds||[])&&(p.fileIds||[]).length<=3,'첨부는 3개까지 선택해 주세요.');
     for(const id of [...new Set(p.fileIds||[])]){const f=entity(w.files,id,'첨부 파일');check(f.experimentId===e.id,'이 실험의 파일만 선택할 수 있습니다.',403);check(/\.(txt|md|csv|tsv|json)$/i.test(f.name)&&f.size<=100000,'AI에 제공할 파일은 100 KB 이하의 텍스트·CSV·JSON이어야 합니다.');const bytes=await readFile(path.join(dataDir,'uploads',f.storedName));let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ApiError('UTF-8 텍스트 파일만 지원합니다.');}check(!text.includes('\0'),'텍스트 파일만 지원합니다.');sources.push({id:'file:'+f.id,name:f.name,text});}
     check(sources.length>0,'정리할 내용이나 원문 기록을 선택해 주세요.');check(JSON.stringify(sources).length<=70000,'선택한 원문이 너무 깁니다. 범위를 줄여 주세요.');
     aiBusy.add(user.id);let draft;try{draft=await draftNotebook(kind,sources,assistantOptions);}finally{aiBusy.delete(user.id);}
     const result=store.update(wid,current=>{auth.permission(current,user,true);const live=normalizeNotebook(experiment(current,e.id));const id=uid();live.aiDrafts.unshift({id,kind,...draft,baseRevision:n.revision,review:'pending',createdAt:stamp(),authorId:actorId,sourceIds:sources.map(s=>s.id),sourceSnapshot:sources});audit(current,actorId,e.id,'AI 초안 생성',kind+' · 검토 대기');return id;});return json(res,201,{...result,workspace:view(result.workspace,user)});
    }
    if(parts[3]==='notebook'&&parts[4]&&req.method==='GET')return json(res,200,notebookText(w,experiment(w,parts[4])));
    if(parts[3]==='files'&&req.method==='POST'){
     const p=await body(req),e=experiment(w,p.experimentId);check(!normalizeNotebook(e).signed,'서명한 노트에 파일을 추가하려면 새 리비전을 여세요.',409);
     const name=textField(p.name,'파일명',200);check(!/[/\\\x00-\x1f]/.test(name),'파일명을 확인해 주세요.');const kind=enumField(p.kind,['result','protocol','reference'],'파일 종류');check(typeof p.data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(p.data),'파일 데이터를 확인해 주세요.');const bytes=Buffer.from(p.data,'base64');check(bytes.length>0&&bytes.length<=10*1024*1024,'파일은 0 bytes 초과, 10 MB 이하여야 합니다.');const id=uid(),storedName=id+'.bin',file={id,experimentId:e.id,name,kind,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:stamp(),authorId:actorId,storedName};await writeFile(path.join(dataDir,'uploads',storedName),bytes,{mode:0o600,flag:'wx'});
     try{const result=store.update(wid,current=>{auth.permission(current,user,true);check(!normalizeNotebook(experiment(current,e.id)).signed,'노트가 서명되어 저장할 수 없습니다.',409);current.files.push(file);audit(current,actorId,e.id,'파일 연결',name);return id;});return json(res,201,{...result,workspace:view(result.workspace,user)});}catch(err){await unlink(path.join(dataDir,'uploads',storedName));throw err;}
    }
    if(parts[3]==='files'&&parts[4]&&req.method==='GET'){const f=entity(w.files,parts[4],'파일'),bytes=await readFile(path.join(dataDir,'uploads',f.storedName));res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'no-store'});return res.end(bytes);}
    if(parts[3]==='handover'&&req.method==='GET'){const report=handover(w,url.searchParams.getAll('experiment'),url.searchParams.get('from')||'',url.searchParams.get('to')||'');return json(res,200,report);}
    if(parts[3]==='export'&&req.method==='GET')return json(res,200,{schema:'flylabs-workspace-v3',exportedAt:stamp(),workspace:w});
   }
   if(parts[0]==='api')throw new ApiError('요청 경로를 찾을 수 없습니다.',404);
   check(req.method==='GET'||req.method==='HEAD','지원하지 않는 요청입니다.',405);
   const relative=decodeURIComponent(url.pathname),requested=path.resolve(root,'dist','.'+relative);check(requested===path.join(root,'dist')||requested.startsWith(path.join(root,'dist')+path.sep),'잘못된 경로입니다.',403);
   let data,file=requested;try{data=await readFile(file);}catch{if(path.extname(relative))throw new ApiError('파일을 찾을 수 없습니다.',404);file=path.join(root,'dist','index.html');try{data=await readFile(file);}catch{throw new ApiError('npm run build 후 실행하거나 개발 서버(4210)를 열어 주세요.',503);}}
   res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){if(error instanceof ApiError)return json(res,error.status,{error:error.message});console.error('FlyLabs request failed:',error.name);json(res,500,{error:'요청을 처리하지 못했습니다. 입력을 유지하고 다시 시도해 주세요.'});}
 });
 return {server,store};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {server,store}=createApp(),port=Number(process.env.PORT||4211);
 server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('FlyLabs v'+VERSION+' · http://127.0.0.1:'+port));
 const stop=()=>server.close(()=>{store.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
