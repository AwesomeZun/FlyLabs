import test from 'node:test';
import assert from 'node:assert/strict';
import {extractFields,compareDocuments,createPlan,planMarkdown,validateWorkspace,safeUrl} from '../shared/research.mjs';
import {scheduleTasks} from '../shared/router.mjs';
import {graph} from '../server/evidence.mjs';
const doc=(id,text)=>({id,title:id,kind:'note',text});
test('unknown and unlabeled narrative stay unknown; original line is preserved',()=>{
 const d=doc('A','# Note\n세포: A549\n반복: 미기재\nWe might treat cells for 24 hours.');
 const p=extractFields(d);assert.equal(p.fields.cell.value,'A549');assert.equal(p.fields.cell.line,2);assert.equal(p.fields.cell.quote,'세포: A549');assert.equal(p.fields.duration,null);assert.equal(p.fields.replicates,null);
});
test('unit-equivalent concentrations and times compare equal; context differences stay visible',()=>{
 const c=compareDocuments([doc('A','세포: A549\n농도: 1 µM\n시간: 24 h'),doc('B','세포: HCT116\n농도: 1000 nM\n시간: 1 day')]);
 assert.equal(c.rows.find(r=>r.key==='concentration').status,'same');assert.equal(c.rows.find(r=>r.key==='duration').status,'same');assert.equal(c.rows.find(r=>r.key==='cell').status,'different');
});
test('missing and differing values both survive a three-source comparison',()=>{
 const row=compareDocuments([doc('A','시간: 24 h'),doc('B','시간: 48 h'),doc('C','시간: 미기재')]).rows.find(r=>r.key==='duration');
 assert.equal(row.hasDifference,true);assert.equal(row.hasMissing,true);assert.equal(row.status,'different');
});
test('conflicting values in the same source are explicitly reported',()=>{
 const d=doc('A','농도: 1 µM\n농도: 2 µM');const p=extractFields(d);assert.equal(p.conflicts.length,1);assert.equal(p.conflicts[0].other.line,2);assert.equal(compareDocuments([d]).rows.find(r=>r.key==='concentration').status,'conflict');
});
test('preparation uses only its base source, preserving unknowns and literal provenance',()=>{
 const plan=createPlan({title:'A','goal':'B'},doc('C','세포: A549'),'연구자 메모',{'C:cell':true});const text=planMarkdown(plan);
 assert.equal(plan.fields.concentration,null);assert.match(text,/처리 농도: 확인 필요/);assert.match(text,/\[C:L1\]/);assert.match(text,/연구자 메모/);assert.match(text,/대조군 추가 확인/);assert.match(text,/- \[x\] 세포 \/ 모델 원문과 적합성 검토/);
});
test('raw HTML and unsafe URLs cannot become active source links',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,hello'),'');assert.equal(safeUrl('https://example.org/a'),'https://example.org/a');
});
test('workspace imports reject duplicate IDs and invalid nested state',()=>{
 const p={schema:'flylabs.workspace.v1',project:{title:'T',goal:'G'},documents:[doc('x','세포: A549')]};
 assert.equal(validateWorkspace(p),p);assert.throws(()=>validateWorkspace({...p,documents:[...p.documents,...p.documents]}),/중복/);assert.throws(()=>validateWorkspace({...p,selected:'not-array'}));assert.throws(()=>validateWorkspace({...p,selected:['x','x']}));assert.throws(()=>validateWorkspace({...p,checks:{a:'yes'}}));
});
test('public graph has a reproducible manifest and genuine positive weighted directed edges',()=>{
 assert.equal(graph.nodes.length,32);assert.equal(graph.edges.length,69);assert.match(graph.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(graph.sourceRows,151856684);const ids=new Set(graph.nodes.map(n=>n.id));assert.ok(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)&&e.weight>0));
});
test('connectome influences eligible task order without breaking required dependencies',()=>{
 const live=scheduleTasks(graph),baseline=scheduleTasks(graph,{mode:'baseline'});assert.notDeepEqual(live.map(t=>t.id),baseline.map(t=>t.id));const done=new Set();for(const t of live){assert.ok(t.deps.every(d=>done.has(d)));done.add(t.id)}assert.equal(live[0].id,'extract');assert.equal(live.at(-1).id,'prepare');assert.ok(!scheduleTasks(graph,{needsReview:false}).some(t=>t.id==='review'));
});
