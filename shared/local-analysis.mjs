import {validDocument, extractFields, compareDocuments, createPlan} from './research.mjs';
import {scheduleTasks} from './router.mjs';

export function analyzeLocally(graph,{documents,goal='',routing='connectome',mode='local'}) {
 if(mode!=='local') throw new Error('Jev는 서버 연결 버전에서 사용할 수 있습니다.');
 if(!Array.isArray(documents)||!documents.length||documents.length>8||!documents.every(validDocument)||new Set(documents.map(d=>d.id)).size!==documents.length||documents.reduce((n,d)=>n+d.text.length,0)>80000||typeof goal!=='string'||goal.length>2000||!['connectome','baseline'].includes(routing)) throw new Error('자료 1~8개, 본문 합계 80,000자 이내로 선택해 주세요.');
 const start=performance.now();
 const needsReview=documents.some(d=>{const p=extractFields(d);return p.missing.length||p.conflicts.length});
 const queue=scheduleTasks(graph,{needsReview,mode:routing});
 let comparison=null,preparedPlans=[];const trace=[];
 for(const task of queue) {
  const begin=performance.now();let count=0;
  if(task.id==='extract') count=documents.reduce((n,d)=>n+Object.values(extractFields(d).fields).filter(Boolean).length,0);
  if(task.id==='missing') count=documents.reduce((n,d)=>n+extractFields(d).missing.length,0);
  if(task.id==='compare'){comparison=compareDocuments(documents);count=comparison.different;}
  if(task.id==='review') count=documents.filter(d=>{const p=extractFields(d);return p.missing.length||p.conflicts.length}).length;
  if(task.id==='prepare'){preparedPlans=documents.map(d=>createPlan({title:'실험 준비',goal},d));count=preparedPlans.length;}
  trace.push({...task,count,latencyMs:Number((performance.now()-begin).toFixed(3)),status:'completed'});
 }
 return {mode:'local',routing,model:null,judgments:[],comparison,preparedPlans,trace,baseline:scheduleTasks(graph,{needsReview,mode:'baseline'}).map(t=>t.id),createdAt:new Date().toISOString(),durationMs:Number((performance.now()-start).toFixed(2)),graph:{dataset:graph.dataset,nodes:graph.nodes.length,edges:graph.edges.length}};
}
