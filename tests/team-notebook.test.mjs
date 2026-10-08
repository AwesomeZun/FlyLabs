import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createApp} from '../server/index.mjs';
import {day} from '../server/seed.mjs';
import {draftNotebook} from '../server/assistant.mjs';
import {snapshot,verifySnapshot,restoreSnapshot} from '../server/backup.mjs';
const pass='Synthetic-test-password-2026!';
test('full backups verify original attachments and restore accounts without live sessions',async()=>{
 const f=await fixture({seed:false}),dir=await mkdtemp(path.join(os.tmpdir(),'flylabs-backup-'));let restored;
 try{
  const a=await f.register('backup@test.org'),w=await workspace(f,a),e=await makeExperiment(f,w,a);
  const file=await f.req('/workspaces/'+w.id+'/files',{experimentId:e.id,name:'original.txt',kind:'result',data:Buffer.from('Original data').toString('base64')},a.cookie);
  const dataDir=f.app.store.db.prepare('PRAGMA database_list').get().file;
  await snapshot(path.dirname(dataDir),path.join(dir,'snapshot'));
  assert.deepEqual(await verifySnapshot(path.join(dir,'snapshot')),{files:1,verified:true});
  await restoreSnapshot(path.join(dir,'snapshot'),path.join(dir,'restored'));
  restored=createApp({dataDir:path.join(dir,'restored'),seed:false});
  assert.equal(restored.store.load(w.id).files[0].sha256,file.data.workspace.files[0].sha256);
  assert.equal(restored.store.db.prepare('SELECT COUNT(*) n FROM users').get().n,1);
  assert.equal(restored.store.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
  await assert.rejects(restoreSnapshot(path.join(dir,'snapshot'),path.join(dir,'restored')),/already exists/);
 }finally{restored?.store.close();await f.close();await rm(dir,{recursive:true,force:true});}
});
async function fixture(options={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'flylabs-team-')),app=createApp({dataDir:dir,...options});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 async function req(route,data,cookie=''){const r=await fetch(base+'/api'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});const body=await r.json();return {status:r.status,data:body,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
 async function register(email){const r=await req('/auth/register',{email,name:email.split('@')[0],password:pass});assert.equal(r.status,200);return r;}
 return {app,base,req,register,close:async()=>{await new Promise(r=>app.server.close(r));app.store.close();await rm(dir,{recursive:true,force:true});}};
}
async function workspace(f,account){const list=await f.req('/workspaces',undefined,account.cookie);return (await f.req('/workspaces/'+list.data.at(-1).id,undefined,account.cookie)).data;}
async function makeExperiment(f,w,account){const r=await f.req('/workspaces/'+w.id+'/actions',{type:'experiment.create',actorId:'spoofed',payload:{title:'Notebook QA',project:'QA',ownerId:w.actorId,date:day(),checklist:'Review raw data',requirements:[]}},account.cookie);assert.equal(r.status,200);return r.data.workspace.experiments[0];}
const mockAssistant=async()=>({ok:true,json:async()=>({modelVersion:'simulated-for-tests',candidates:[{content:{parts:[{text:JSON.stringify({fields:{objective:'Supplied objective',design:'User provided design'},missing:['Controls not provided'],citations:['input']})}]}}]})});
test('accounts require authentication, hash credentials, logout and password changes revoke sessions',async()=>{
 const f=await fixture({seed:false});try{
 assert.equal((await f.req('/workspaces')).status,401);
 assert.equal((await f.req('/auth/register',{email:'a@test.org',name:'A',password:'short'})).status,400);
 const a=await f.register('a@test.org');assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 assert.equal((await f.req('/auth/me',undefined,a.cookie)).data.user.email,'a@test.org');
 const u=f.app.store.db.prepare('SELECT * FROM users').get();assert.notEqual(u.password_hash,pass);assert.ok(!JSON.stringify(a.data).includes(u.password_hash));
 assert.equal((await f.req('/auth/login',{email:'a@test.org',password:'wrong'})).status,401);
 const login=await f.req('/auth/login',{email:'a@test.org',password:pass});assert.equal(login.status,200);
 const changed=await f.req('/auth/password',{currentPassword:pass,password:pass+'new'},a.cookie);assert.equal(changed.status,200);
 assert.equal((await f.req('/workspaces',undefined,login.cookie)).status,401);
 assert.equal((await f.req('/auth/login',{email:'a@test.org',password:pass})).status,401);
 await f.req('/auth/logout',{},changed.cookie);assert.equal((await f.req('/workspaces',undefined,changed.cookie)).status,401);
 }finally{await f.close();}
});
test('invitations enforce email, expiry, one-time use, role limits and cross-workspace file isolation',async()=>{
 const f=await fixture({seed:false});try{
 const a=await f.register('owner@test.org'),b=await f.register('editor@test.org'),c=await f.register('viewer@test.org'),w=await workspace(f,a),base='/workspaces/'+w.id,e=await makeExperiment(f,w,a);
 assert.equal((await f.req(base,undefined,b.cookie)).status,403);
 const invitation=await f.req(base+'/invitations',{email:'editor@test.org',role:'editor'},a.cookie);assert.equal(invitation.status,201);
 assert.equal((await f.req('/invitations/accept',{token:invitation.data.token},c.cookie)).status,403);
 assert.equal((await f.req('/invitations/accept',{token:invitation.data.token},b.cookie)).status,200);
 assert.equal((await f.req('/invitations/accept',{token:invitation.data.token},b.cookie)).status,410);
 const v=await f.req(base+'/invitations',{email:'viewer@test.org',role:'viewer'},a.cookie);await f.req('/invitations/accept',{token:v.data.token},c.cookie);
 const canceled=await f.req(base+'/invitations',{email:'viewer@test.org',role:'editor'},a.cookie);
 const pendingInvites=await f.req(base+'/invitations',undefined,a.cookie);
 assert.equal(pendingInvites.data.length,1);
 await f.req(base+'/invitations/revoke',{id:pendingInvites.data[0].id},a.cookie);
 assert.equal((await f.req('/invitations/accept',{token:canceled.data.token},c.cookie)).status,410);
 const expired=await f.req(base+'/invitations',{email:'viewer@test.org',role:'editor'},a.cookie);
 f.app.store.db.prepare('UPDATE invitations SET expires_at=0 WHERE used=0').run();
 assert.equal((await f.req('/invitations/accept',{token:expired.data.token},c.cookie)).status,410);
 assert.equal((await f.req(base,undefined,c.cookie)).data.myRole,'viewer');
 const payload={type:'notebook.save',actorId:w.actorId,payload:{experimentId:e.id,expectedRevision:0,fields:{objective:'Question'},reason:'Initial'}};
 assert.equal((await f.req(base+'/actions',payload,c.cookie)).status,403);
 const written=await f.req(base+'/actions',payload,b.cookie);assert.equal(written.status,200);assert.notEqual(written.data.workspace.audit[0].actorId,w.actorId);
 assert.equal((await f.req(base+'/invitations',{email:'other@test.org',role:'editor'},b.cookie)).status,403);
 const file=await f.req(base+'/files',{experimentId:e.id,name:'raw.txt',kind:'result',data:Buffer.from('raw results').toString('base64')},a.cookie);assert.equal(file.status,201);
 const cw=await workspace(f,c);assert.equal((await fetch(f.base+'/api/workspaces/'+cw.id+'/files/'+file.data.result,{headers:{Cookie:c.cookie}})).status,404);
 const direct=await fetch(f.base+'/api'+base+'/files/'+file.data.result,{headers:{Cookie:c.cookie}});assert.equal(await direct.text(),'raw results');
 await f.req(base+'/permissions',{userId:b.data.user.id,role:'remove'},a.cookie);assert.equal((await f.req(base,undefined,b.cookie)).status,403);
 }finally{await f.close();}
});
test('lab notebook retains revisions, rejects stale writes, locks signed records and preserves amendments',async()=>{
 const f=await fixture({seed:false});try{
 const a=await f.register('writer@test.org'),w=await workspace(f,a),e=await makeExperiment(f,w,a),base='/workspaces/'+w.id;
 const action=(type,payload)=>f.req(base+'/actions',{type,payload:{experimentId:e.id,...payload}},a.cookie);
 let r=await action('notebook.save',{expectedRevision:0,fields:{objective:'Compare methods',observations:'A = 12; B = 13',conclusion:'Only descriptive comparison',limitations:'No significance test'},reason:'Initial results'});assert.equal(r.status,200);assert.equal(r.data.workspace.experiments[0].notebook.revision,1);
 assert.equal((await action('notebook.save',{expectedRevision:0,fields:{objective:'Lost update'}})).status,409);
 r=await action('entry.add',{text:'Recorded raw output'});const entryId=r.data.result;
 r=await action('entry.add',{text:'Correction: source file version 2',amendsId:entryId});assert.equal(r.data.workspace.experiments[0].notebook.entries.length,2);
 const revision=r.data.workspace.experiments[0].notebook.revision;
 assert.equal((await action('notebook.sign',{expectedRevision:revision})).status,200);
 assert.equal((await action('notebook.save',{expectedRevision:revision,fields:{conclusion:'Overwrite'}})).status,409);
 assert.equal((await action('entry.add',{text:'Hidden change'})).status,409);
 assert.equal((await f.req(base+'/files',{experimentId:e.id,name:'more.txt',kind:'result',data:'YQ=='},a.cookie)).status,409);
 r=await action('notebook.reopen',{expectedRevision:revision,reason:'Additional observation'});assert.equal(r.status,200);const n=r.data.workspace.experiments[0].notebook;assert.equal(n.signed,null);assert.equal(n.history[0].signed.revision,revision);assert.equal(n.fields.observations,'A = 12; B = 13');
 const exported=await f.req(base+'/notebook/'+e.id,undefined,a.cookie);assert.match(exported.data.text,/Compare methods/);assert.match(exported.data.text,/Correction/);
 const h=await f.req(base+'/handover',undefined,a.cookie);assert.match(h.data.text,/Only descriptive comparison/);
 }finally{await f.close();}
});
test('AI drafts never auto-apply and validate source scope, selected fields and revision conflicts',async()=>{
 const f=await fixture({seed:false,assistantOptions:{apiKey:'synthetic',fetch:mockAssistant}});try{
 const a=await f.register('ai@test.org'),w=await workspace(f,a),e=await makeExperiment(f,w,a),base='/workspaces/'+w.id;
 const draft=await f.req(base+'/assistant',{experimentId:e.id,kind:'plan',text:'Supplied objective and design',includeNotebook:false,includeEntries:false,fileIds:[]},a.cookie);assert.equal(draft.status,201);
 const n=draft.data.workspace.experiments[0].notebook;assert.equal(n.fields.objective,'');assert.equal(n.aiDrafts[0].sourceSnapshot[0].id,'input');
 const applied=await f.req(base+'/actions',{type:'ai.apply',payload:{experimentId:e.id,id:draft.data.result,expectedRevision:0,fieldKeys:['objective']}},a.cookie);assert.equal(applied.status,200);assert.equal(applied.data.workspace.experiments[0].notebook.fields.objective,'Supplied objective');assert.equal(applied.data.workspace.experiments[0].notebook.fields.design,'');
 const d2=await f.req(base+'/assistant',{experimentId:e.id,kind:'plan',text:'Next input'},a.cookie);
 await f.req(base+'/actions',{type:'entry.add',payload:{experimentId:e.id,text:'Later actual work'}},a.cookie);
 assert.equal((await f.req(base+'/actions',{type:'ai.apply',payload:{experimentId:e.id,id:d2.data.result,expectedRevision:2,fieldKeys:['objective']}},a.cookie)).status,409);
 }finally{await f.close();}
});
test('malformed or unsupported generative outputs never become valid drafts',async()=>{
 const fake=data=>async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]})});
 await assert.rejects(draftNotebook('plan',[{id:'input',text:'abc'}],{apiKey:'test',fetch:fake({fields:{observations:'invented'},missing:[],citations:['input']})}),e=>e.status===502);
 await assert.rejects(draftNotebook('results',[{id:'input',text:'abc'}],{apiKey:'test',fetch:fake({fields:{observations:'provided'},missing:[],citations:['unknown-file']})}),e=>e.status===502);
 await assert.rejects(draftNotebook('plan',[],{apiKey:''}),e=>e.status===503);
});
test('delayed Jev response preserves the note but cannot overwrite later state',async()=>{
 let release,started;const queued=new Promise(r=>started=r);
 const f=await fixture({seed:false,jevOptions:{apiKey:'synthetic',fetch:async()=>{started();await new Promise(r=>release=r);return {ok:true,json:async()=>({answers:{category:{choice:'progress',confidence:.9},status:{choice:'running',confidence:.9}}})};}}});
 try{const a=await f.register('jev@test.org'),w=await workspace(f,a),e=await makeExperiment(f,w,a),base='/workspaces/'+w.id;
 const pending=f.req(base+'/notes',{experimentId:e.id,text:'실험을 시작했습니다.',mode:'jev'},a.cookie);await queued;
 await f.req(base+'/actions',{type:'experiment.update',payload:{id:e.id,status:'blocked'}},a.cookie);release();const r=await pending;assert.equal(r.status,201);assert.equal(r.data.workspace.notes[0].proposal,null);assert.equal(r.data.workspace.notes[0].stale,true);assert.equal(r.data.workspace.experiments[0].status,'blocked');
 }finally{await f.close();}
});
