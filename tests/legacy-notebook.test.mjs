import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabNote,labNoteMarkdown} from '../shared/labnotes.mjs';
import {validateWorkspace} from '../shared/research.mjs';
import {analyzeLocally} from '../shared/local-analysis.mjs';
import {seedWorkspace} from '../shared/legacy-seed.mjs';
import {graph} from '../server/evidence.mjs';

test('notebook export separates plans, observed results and interpretation; preserves source identity',()=>{
 const n=createLabNote({project:{title:'Assay',goal:'Question'},plan:'농도: 1 µM [A:L1]',source:{id:'A',title:'Source A',synthetic:true}});
 n.actual='농도: 2 µM';n.results='Observation';n.interpretation='Unconfirmed interpretation';n.nextStep='Repeat control';
 const output=labNoteMarkdown(n);
 assert.equal(n.synthetic,true);assert.match(output,/Source A \[A\]/);assert.match(output,/## 실험 계획\n농도: 1 µM/);assert.match(output,/## 실제 수행·변경점\n농도: 2 µM/);assert.match(output,/## 관찰·결과\nObservation/);assert.match(output,/## 해석·한계\nUnconfirmed interpretation/);
});
test('backups accept old workspaces and notebook workspaces, reject malformed or duplicate notes',()=>{
 const ws=seedWorkspace(),note=createLabNote({project:ws.project});
 assert.equal(validateWorkspace(ws),ws);assert.doesNotThrow(()=>validateWorkspace({...ws,labNotes:[note]}));
 assert.throws(()=>validateWorkspace({...ws,labNotes:[note,note]}));
 for(const patch of [{results:{}},{source:{id:'x',title:{}}},{status:'toString'},{date:null}])assert.throws(()=>validateWorkspace({...ws,labNotes:[{...note,...patch}]}));
});
test('portable analysis performs comparison and scheduling with no AI fabrication',()=>{
 const ws=seedWorkspace(),documents=ws.documents.slice(0,2);
 const c=analyzeLocally(graph,{documents,goal:ws.project.goal}),b=analyzeLocally(graph,{documents,routing:'baseline'});
 assert.equal(c.comparison.different,1);assert.equal(c.comparison.missing,1);assert.equal(c.model,null);assert.deepEqual(c.judgments,[]);assert.notDeepEqual(c.trace.map(t=>t.id),b.trace.map(t=>t.id));assert.equal(c.preparedPlans.length,2);
 assert.throws(()=>analyzeLocally(graph,{documents,mode:'jev'}),/서버/);assert.throws(()=>analyzeLocally(graph,{documents:[documents[0],documents[0]]}));
});
