import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server/index.mjs';
import { openStore } from '../server/store.mjs';
import { seedWorkspace, emptyWorkspace, day } from '../server/seed.mjs';
import { applyAction, issuesFor, handover, dateField } from '../server/domain.mjs';
import { classifyNote, localDecision } from '../server/jev.mjs';

function action(w,type,payload){return applyAction(w,{type,payload,actorId:w.members[0].id});}
test('readiness keeps unknown inventory distinct from verified shortages',()=>{
  const w=seedWorkspace('academic');
  assert.equal(issuesFor(w,w.experiments[0])[0].kind,'blocker');
  assert.equal(issuesFor(w,w.experiments[2])[0].kind,'unknown');
  assert.deepEqual(issuesFor(w,w.experiments[1]),[]);
  w.reservations=[];assert.match(issuesFor(w,w.experiments[1])[0].text,/예약 미확인/);
});
test('overlapping equipment reservations reject; back-to-back reservations succeed',()=>{
  const w=seedWorkspace('academic'),b=w.reservations[0];
  const p={...b,start:day()+'T10:30',end:day()+'T12:00'};
  assert.throws(()=>action(w,'reservation.create',p),e=>e.status===409);
  action(w,'reservation.create',{...p,start:b.end});
  assert.equal(w.reservations.length,3);
  assert.throws(()=>action(w,'reservation.create',{...p,start:day()+'T10:30',end:day()+'T09:30'}),/종료/);
});
test('completing an experiment requires both checked tasks and a result file',()=>{
  const w=seedWorkspace('academic'),e=w.experiments[1];
  assert.throws(()=>action(w,'experiment.update',{id:e.id,status:'completed'}),/준비 항목/);
  e.tasks.forEach(t=>action(w,'task.toggle',{experimentId:e.id,id:t.id,done:true}));
  assert.throws(()=>action(w,'experiment.update',{id:e.id,status:'completed'}),/결과 파일/);
  w.files.push({id:'result-1',kind:'result',experimentId:e.id});
  action(w,'experiment.update',{id:e.id,status:'completed'});
  assert.equal(e.status,'completed');
  assert.throws(()=>action(w,'task.toggle',{experimentId:e.id,id:e.tasks[0].id,done:false}),/완료된/);
});
test('stale and already-reviewed proposals cannot overwrite later changes',()=>{
  const w=seedWorkspace('academic'),e=w.experiments[2];
  const n={id:'proposal',experimentId:e.id,proposal:{status:'blocked'},review:'pending',text:'시약 부족',expectedUpdatedAt:e.updatedAt};w.notes.push(n);
  action(w,'task.toggle',{experimentId:e.id,id:e.tasks[0].id,done:true});
  assert.notEqual(e.updatedAt,n.expectedUpdatedAt);
  assert.throws(()=>action(w,'note.review',{id:n.id,decision:'apply'}),err=>err.status===409);
  action(w,'note.review',{id:n.id,decision:'dismiss'});
  assert.equal(n.review,'dismissed');assert.equal(e.status,'planned');
  assert.throws(()=>action(w,'note.review',{id:n.id,decision:'apply'}),err=>err.status===409);
});
test('rules do not turn incomplete, planned, or preparation-only work into completed experiments',()=>{
  for(const text of ['실험 아직 미완료','실험이 완료되지 않았습니다','실험 완료 예정입니다','실험 준비 완료','촬영 예약 완료','시약 입고 완료'])assert.notEqual(localDecision(text).status,'completed',text);
  assert.equal(localDecision('실험을 완료했습니다.').status,'completed');
  assert.equal(localDecision('항체가 부족해서 보류했습니다.').status,'blocked');
  assert.equal(localDecision('분석을 시작했습니다.').status,'running');
  assert.equal(localDecision('확인해주세요').status,null);
});
test('Jev adapter sends only selected context, validates outputs, and suppresses low-confidence proposals',async()=>{
  let request;
  const fake=async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({answers:{category:{choice:'material_wait',confidence:.91},status:{choice:'blocked',confidence:.82}}})};};
  const result=await classifyNote('시약 부족',{title:'Selected experiment',status:'planned',secret:'not sent'},{apiKey:'test-only',fetch:fake});
  assert.equal(result.source,'jev');assert.equal(result.status,'blocked');
  assert.equal(request.url,'https://api.typesafe.ai/v1/systemone');
  assert.deepEqual(Object.keys(request.body.state),['experiment','researcher_note']);
  assert.deepEqual(request.body.state.experiment,{title:'Selected experiment',current_status:'planned'});
  const response=(choice,confidence)=>async()=>({ok:true,json:async()=>({answers:{category:{choice:'progress',confidence:.9},status:{choice,confidence}}})});
  assert.equal((await classifyNote('text',{},{apiKey:'test-only',fetch:response('running',.4)})).status,null);
  for(const confidence of [null,undefined,'0.9',1.2])await assert.rejects(classifyNote('text',{},{apiKey:'test-only',fetch:response('running',confidence)}),err=>err.status===502);
  await assert.rejects(classifyNote('text',{},{apiKey:'test-only',fetch:response('invented',.9)}),err=>err.status===502);
  await assert.rejects(classifyNote('text',{},{apiKey:''}),err=>err.status===503);
});
test('SQLite transactions roll back invalid changes and persist across reopen',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'flylabs-store-'));
  let store=openStore(dir,false);
  try {
    const w=emptyWorkspace('Persistence Lab');store.insert(w);
    assert.throws(()=>store.update(w.id,current=>{current.name='broken';throw new Error('abort');}));
    assert.equal(store.load(w.id).name,'Persistence Lab');
    store.update(w.id,current=>{current.name='Saved Lab';});
    store.close();store=openStore(dir,false);
    assert.equal(store.load(w.id).name,'Saved Lab');assert.equal(store.load(w.id).revision,1);
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('handover carries source IDs and missing data without inventing results',()=>{
  const w=seedWorkspace('academic'),e=w.experiments[0];
  const report=handover(w,[e.id],e.date,e.date);
  assert.equal(report.count,1);assert.ok(report.text.includes(w.notes[0].id));assert.ok(report.text.includes(e.id));
  assert.match(report.text,/연결된 파일 없음/);assert.match(report.text,/항체/);
  assert.equal(handover(w,[e.id],'2099-01-01','2099-01-02').count,0);
  assert.throws(()=>handover(w,[],'2026-11-02','2026-11-01'),/조회 기간/);
  assert.throws(()=>dateField('2026-02-30'),/유효한/);
});
