export const TASKS = [
  {id:'extract',label:'조건 추출',deps:[]},
  {id:'compare',label:'조건 비교',deps:['extract']},
  {id:'missing',label:'누락 확인',deps:['extract']},
  {id:'review',label:'추가 검토 표시',deps:['missing','compare']},
  {id:'prepare',label:'준비표 구성',deps:['missing','compare','review']}
];
// Experimental structural scheduler. Neuron-to-task assignment is an engineering
// choice, not a statement about what biological neurons compute.
export function graphPriorities(graph) {
  const ids=graph.nodes.map(n=>String(n.id));
  const out=new Map(ids.map(id=>[id,[]]));
  for(const e of graph.edges) out.get(String(e.source))?.push(e);
  let mass=Object.fromEntries(ids.map((id,i)=>[id,i===0?1:0]));
  for(let t=0;t<24;t++) {
    const next=Object.fromEntries(ids.map((id,i)=>[id,i===0?.15:0]));
    for(const id of ids) {
      const edges=out.get(id),sum=edges.reduce((s,e)=>s+e.weight,0);
      if(!sum) next[ids[0]]+=.85*mass[id];
      for(const e of edges) next[String(e.target)]+=.85*mass[id]*e.weight/sum;
    }
    mass=next;
  }
  const anchors={extract:0,missing:1,compare:2,review:3,prepare:4};
  return TASKS.map(task=>({...task,node:ids[anchors[task.id]],priority:mass[ids[anchors[task.id]]]||0}));
}
export function scheduleTasks(graph,{needsReview=true,mode='connectome'}={}) {
  const tasks=graphPriorities(graph).filter(t=>needsReview||t.id!=='review');
  const done=new Set(needsReview?[]:['review']),ordered=[];
  while(ordered.length<tasks.length) {
    const ready=tasks.filter(t=>!done.has(t.id)&&t.deps.every(d=>done.has(d)));
    if(!ready.length) throw new Error('처리 경로의 의존 관계를 확인해 주세요.');
    if(mode==='connectome') ready.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
    const t=ready[0]; ordered.push(t);done.add(t.id);
  }
  return ordered;
}
