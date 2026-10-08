export const NOTE_FIELDS=[
 ['objective','목적·가설','무엇을 확인하려는 실험인가요?'],
 ['planned','실험 계획','준비물, 조건, 대조군, 순서를 기록하세요.'],
 ['actual','실제 수행·변경점','실제로 사용한 조건과 계획에서 달라진 점을 기록하세요.'],
 ['results','관찰·결과','측정값과 관찰한 사실을 기록하세요.'],
 ['interpretation','해석·한계','결과에서 말할 수 있는 것과 추가 확인이 필요한 것을 구분하세요.'],
 ['nextStep','다음 실험','이번 결과를 바탕으로 무엇을 확인할지 기록하세요.']
];
export const NOTE_STATUS={planned:'계획 중',running:'진행 중',completed:'완료',onhold:'보류'};
export function createLabNote({project,plan,source}={}) {
 const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 return {id:crypto.randomUUID(),title:plan?`${project.title} · 실험 기록`:'새 실험',date,status:'planned',objective:project?.goal||'',planned:plan||'',actual:'',results:'',interpretation:'',nextStep:'',synthetic:!!source?.synthetic,source:source?{id:source.id,title:source.title}:null,createdAt:now.toISOString(),updatedAt:now.toISOString()};
}
export function validateLabNotes(notes) {
 if(!Array.isArray(notes)||notes.length>100) throw new Error('랩노트 목록이 올바르지 않습니다.');
 const ids=new Set();
 for(const n of notes){
  if(!n||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||typeof n.title!=='string'||n.title.length>200||typeof n.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||!Object.hasOwn(NOTE_STATUS,n.status)||typeof n.synthetic!=='boolean'||NOTE_FIELDS.some(([key])=>typeof n[key]!=='string'||n[key].length>15000)||['createdAt','updatedAt'].some(k=>typeof n[k]!=='string'||!Number.isFinite(Date.parse(n[k])))||(n.source!==null&&(!n.source||typeof n.source.id!=='string'||typeof n.source.title!=='string'||n.source.title.length>300))) throw new Error('랩노트 내용의 형식을 확인해 주세요.');
  ids.add(n.id);
 }
 return notes;
}
export function labNoteMarkdown(n) {
 return [`# ${n.title||'제목 없는 실험'}`,`실험 날짜: ${n.date}`,`상태: ${NOTE_STATUS[n.status]}`,`자료 구분: ${n.synthetic?'합성 예시에서 시작한 기록':'사용자 연구 기록'}`,`기록 ID: ${n.id}`,`최초 작성: ${n.createdAt}`,`마지막 수정: ${n.updatedAt}`,n.source?`연결 자료: ${n.source.title} [${n.source.id}]`:'',...NOTE_FIELDS.flatMap(([key,label])=>['',`## ${label}`,n[key]||'미기재'])].join('\n');
}
