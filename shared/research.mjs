import {validateLabNotes} from './labnotes.mjs';
import {TEMPLATES,fieldsFor} from './templates.mjs';
export const FIELDS = TEMPLATES.biology.fields;
const unknown = /^(미기재|확인 필요|미정|unknown|not stated|n\/?a|[-—])$/i;
export function extractFields(doc) {
  const FIELDS=fieldsFor(doc);
  const fields = Object.fromEntries(FIELDS.map(f=>[f.key,null]));
  const conflicts=[];
  String(doc.text||'').split(/\r?\n/).forEach((line,i)=>{
    const clean=line.replace(/^\s*(?:[-*]\s+|#{1,6}\s+)?/,'').replace(/\*\*/g,'').trim();
    const match=clean.match(/^([^:：=|]+?)\s*[:：=]\s*(.+)$/);
    if(!match) return;
    const field=FIELDS.find(f=>f.aliases.includes(match[1].trim().toLowerCase()));
    const value=match[2].trim();
    if(!field || !value || unknown.test(value)) return;
    const item={value,sourceId:doc.id,line:i+1,quote:line.trim()};
    if(fields[field.key] && normalize(field.normalization||field.key,fields[field.key].value)!==normalize(field.normalization||field.key,value)) conflicts.push({key:field.key,first:fields[field.key],other:item});
    else if(!fields[field.key]) fields[field.key]=item;
  });
  for(const f of FIELDS){const v=doc.reviewedFields?.[f.key];if(v&&Number.isInteger(v.line)&&String(doc.text||'').split(/\r?\n/)[v.line-1]?.includes(v.quote)&&v.quote.includes(v.value))fields[f.key]={...v,sourceId:doc.id};}
  return {fields, conflicts, missing:FIELDS.filter(f=>!fields[f.key]).map(f=>f.key)};
}
export function normalize(key,value) {
  let s=String(value??'').trim().toLowerCase().replace(/[μµ]/g,'u');
  if(key==='concentration') {
    const m=s.match(/^(\d+(?:\.\d+)?)\s*(nm|um|mm)$/);
    if(m) return `${Number(m[1])*({nm:0.001,um:1,mm:1000}[m[2]])}um`;
  }
  if(key==='duration') {
    const m=s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|시간|d|days?|일|min|minutes?|분)$/);
    if(m) return `${Number(m[1])*(/^(d|day|days|일)$/.test(m[2])?24:/^(min|minute|minutes|분)$/.test(m[2])?1/60:1)}h`;
  }
  return s.replace(/\s+/g,' ');
}
export function compareDocuments(docs) {
  const FIELDS=fieldsFor(docs[0]);
  const parsed=docs.map(doc=>({doc,...extractFields(doc)}));
  const rows=FIELDS.map(field=>{
    const values=parsed.map(p=>p.fields[field.key]);
    const distinct=new Set(values.filter(Boolean).map(v=>normalize(field.normalization||field.key,v.value)));
    const conflict=parsed.some(p=>p.conflicts.some(c=>c.key===field.key));
    return {...field,values,hasMissing:values.some(v=>!v),hasDifference:distinct.size>1||conflict,status:conflict?'conflict':distinct.size>1?'different':values.some(v=>!v)?'missing':'same'};
  });
  return {parsed,rows,missing:rows.filter(r=>r.hasMissing).length,different:rows.filter(r=>r.hasDifference).length};
}
export function rankDocuments(docs,query) {
  const tokens=[...new Set(String(query).toLowerCase().match(/[\p{L}\p{N}-]{2,}/gu)||[])];
  return docs.map(doc=>{
    const hay=(doc.title+' '+doc.text).toLowerCase();
    const matched=tokens.filter(t=>hay.includes(t));
    return {doc,score:matched.length,matched};
  }).sort((a,b)=>b.score-a.score);
}
export function createPlan(project,doc,note='',checks={}) {
  if(!doc) throw new Error('기준 자료를 선택해 주세요.');
  const parsed=extractFields(doc),FIELDS=fieldsFor(doc);
  return {definitions:FIELDS,version:'3.0.0',status:'연구자 검토용 초안',createdAt:new Date().toISOString(),project:project.title,goal:project.goal,source:{id:doc.id,title:doc.title,url:safeUrl(doc.url),kind:doc.kind,synthetic:!!doc.synthetic},fields:parsed.fields,missing:parsed.missing,conflicts:parsed.conflicts,note,checks:Object.fromEntries(FIELDS.map(f=>[f.key,!!checks[`${doc.id}:${f.key}`]]))};
}
export function planMarkdown(plan) {
  const FIELDS=plan.definitions||fieldsFor(null);
  const text = [`# FlyLabs · ${plan.project}`, '', `상태: ${plan.status}`, `작성: ${plan.createdAt}`, `연구 목적: ${plan.goal}`, '', `기준 자료: ${plan.source.title} [${plan.source.id}]`, plan.source.synthetic?'자료 구분: 합성 예시 (실제 연구 결과 아님)':'자료 구분: 사용자가 등록한 자료', plan.source.url?`원문: ${plan.source.url}`:'', '', '## 비교 조건'];
  for(const f of FIELDS) {const v=plan.fields[f.key];text.push(`- ${f.label}: ${v?.value||'확인 필요'}${v?` [${v.sourceId}:L${v.line}]`:''}`);}
  text.push('','## 준비·확인 목록');
  for(const f of FIELDS) text.push(`- [${plan.checks?.[f.key]?'x':' '}] ${f.label} ${plan.fields[f.key]?'원문과 적합성 검토':'추가 확인'}`);
  for(const c of plan.conflicts) text.push(`- [ ] 자료 내 ${FIELDS.find(f=>f.key===c.key).label} 값 충돌: L${c.first.line} / L${c.other.line}`);
  text.push('','## 근거 원문');
  for(const f of FIELDS) {const v=plan.fields[f.key];if(v)text.push(`- [${v.sourceId}:L${v.line}] ${v.quote}`);}
  text.push('','## 연구자 메모',plan.note||'미기재','','등록 자료를 정리한 초안입니다. 다른 자료의 조건을 자동으로 혼합하지 않으며, 연구의 타당성이나 결과를 확정하지 않습니다.');
  return text.filter(x=>x!==undefined).join('\n');
}
export function safeUrl(value) {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function validDocument(d) {return !!d && typeof d.id==='string' && d.id.length>0 && d.id.length<=100 && typeof d.title==='string' && d.title.trim().length>0 && d.title.length<=300 && typeof d.text==='string' && d.text.trim().length>0 && d.text.length<=40000;}
export function validateWorkspace(v) {
  if(!v||v.schema!=='flylabs.workspace.v1'||!Array.isArray(v.documents)||v.documents.length>100||!v.documents.every(validDocument)) throw new Error('FlyLabs 프로젝트 백업 형식이 아닙니다.');
  if(new Set(v.documents.map(d=>d.id)).size!==v.documents.length) throw new Error('자료 ID가 중복되었습니다.');
  if(!v.project||typeof v.project.title!=='string'||!v.project.title.trim()||v.project.title.length>120||typeof v.project.goal!=='string'||v.project.goal.length>2000) throw new Error('프로젝트 정보가 올바르지 않습니다.');
  if(v.selected!==undefined&&(!Array.isArray(v.selected)||v.selected.some(id=>typeof id!=='string')||new Set(v.selected).size!==v.selected.length)) throw new Error('비교 자료 목록이 올바르지 않습니다.');
  if(v.checks!==undefined&&(!v.checks||typeof v.checks!=='object'||Array.isArray(v.checks)||Object.values(v.checks).some(c=>typeof c!=='boolean'))) throw new Error('체크리스트 형식이 올바르지 않습니다.');
  if(v.planNote!==undefined&&(typeof v.planNote!=='string'||v.planNote.length>5000)) throw new Error('메모 형식이 올바르지 않습니다.');
  if(v.activity!==undefined&&(!Array.isArray(v.activity)||v.activity.length>30)) throw new Error('활동 기록 형식이 올바르지 않습니다.');
  if(v.labNotes!==undefined)validateLabNotes(v.labNotes);
  return v;
}
