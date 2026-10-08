import { check, textField, experiment, entity, audit } from './domain.mjs';
import { uid, stamp } from './seed.mjs';
export const fields={objective:'연구 목적',hypothesis:'가설 / 연구 질문',design:'실험 설계',materials:'시료·재료·조건',procedure:'실행 절차',observations:'관찰 결과',analysis:'분석·해석',conclusion:'결론',limitations:'한계·미확인 사항',nextSteps:'다음 단계'};
export function normalizeNotebook(e) {
  e.notebook ||= {revision:0,fields:Object.fromEntries(Object.keys(fields).map(k=>[k,''])),entries:[],history:[],aiDrafts:[],signed:null};
  return e.notebook;
}
export function notebookAction(w,actor,type,p){
  const e=experiment(w,p.experimentId),n=normalizeNotebook(e);
  if(type==='ai.dismiss'){const d=entity(n.aiDrafts,p.id,'AI 초안');check(d.review==='pending','이미 검토한 초안입니다.',409);d.review='dismissed';audit(w,actor,e.id,'AI 초안 제외',d.kind);return;}
  check(!n.signed,'서명한 노트입니다. 수정하려면 먼저 새 리비전을 여세요.',409);
  if(type==='notebook.save'||type==='ai.apply'){
    check(p.expectedRevision===n.revision,'다른 연구원이 먼저 수정했습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.',409);
    let incoming=p.fields;
    let d;
    if(type==='ai.apply'){d=entity(n.aiDrafts,p.id,'AI 초안');check(d.review==='pending','이미 검토한 초안입니다.',409);check(d.baseRevision===n.revision,'노트가 변경되어 초안이 오래되었습니다. 새로 생성해 주세요.',409);check(Array.isArray(p.fieldKeys)&&p.fieldKeys.length>0&&p.fieldKeys.every(k=>Object.hasOwn(d.fields,k)),'반영할 초안 항목을 선택해 주세요.');incoming=Object.fromEntries(p.fieldKeys.map(k=>[k,d.fields[k]]));}
    check(incoming&&typeof incoming==='object'&&!Array.isArray(incoming),'노트 항목을 확인해 주세요.');
    const next={...n.fields};
    for(const [key,value] of Object.entries(incoming)){check(Object.hasOwn(fields,key),'알 수 없는 노트 항목입니다.');next[key]=textField(value,fields[key],20000,false);}
    const reason=textField(p.reason||'노트 수정','수정 이유',300);
    n.history.unshift({id:uid(),revision:n.revision,fields:{...n.fields},authorId:actor,createdAt:stamp(),reason,signed:n.signed});
    n.fields=next;n.revision++;n.updatedAt=stamp(n.updatedAt);e.updatedAt=stamp(e.updatedAt);
    if(d){d.review='applied';d.appliedRevision=n.revision;}
    audit(w,actor,e.id,type==='ai.apply'?'AI 초안 검토 후 반영':'랩노트 저장','리비전 '+n.revision+' · '+reason);
    return n.revision;
  }
  if(type==='entry.add'){
    const entry={id:uid(),text:textField(p.text,'실행 기록',10000),authorId:actor,createdAt:stamp(),amendsId:null};
    if(p.amendsId){entity(n.entries,p.amendsId,'원본 실행 기록');entry.amendsId=p.amendsId;}
    n.entries.unshift(entry);n.revision++;n.updatedAt=stamp(n.updatedAt);
    audit(w,actor,e.id,p.amendsId?'실행 기록 정정':'실행 기록 추가',entry.text.slice(0,150));return entry.id;
  }
  if(type==='notebook.sign'){
    check(p.expectedRevision===n.revision,'최신 리비전을 확인해 주세요.',409);
    check(n.fields.objective.trim()&&n.fields.observations.trim()&&n.fields.conclusion.trim(),'목적, 관찰 결과, 결론을 작성한 뒤 서명해 주세요.');
    n.signed={authorId:actor,createdAt:stamp(),revision:n.revision};audit(w,actor,e.id,'랩노트 서명','리비전 '+n.revision);return;
  }
  check(false,'지원하지 않는 랩노트 작업입니다.');
}
export function reopen(w,actor,p){
  const e=experiment(w,p.experimentId),n=normalizeNotebook(e);
  check(n.signed,'서명되지 않은 노트입니다.');
  check(p.expectedRevision===n.revision,'최신 리비전을 확인해 주세요.',409);
  const reason=textField(p.reason,'재개 이유',300);
  n.history.unshift({id:uid(),revision:n.revision,fields:{...n.fields},authorId:actor,createdAt:stamp(),reason,signed:n.signed});
  n.signed=null;n.revision++;n.updatedAt=stamp(n.updatedAt);
  audit(w,actor,e.id,'랩노트 새 리비전',reason);
}
export function notebookText(w,e) {
  const n=normalizeNotebook(e),name=id=>w.members.find(m=>m.id===id)?.name||'기록된 작성자';
  const lines=['# '+e.code+' · '+e.title,'','연구실: '+w.name,'실험 ID: '+e.id,'리비전: '+n.revision,'출력: '+stamp(),''];
  for(const [key,label] of Object.entries(fields))lines.push('## '+label,'',n.fields[key]||'미작성','');
  lines.push('## 실행 기록','');
  for(const entry of n.entries)lines.push('### '+entry.createdAt+' · '+name(entry.authorId),'ID: '+entry.id+(entry.amendsId?' · 정정 대상: '+entry.amendsId:''),'',entry.text,'');
  lines.push('## 첨부 자료','');
  for(const f of w.files.filter(f=>f.experimentId===e.id))lines.push('- '+f.name+' · '+f.id+' · SHA-256 '+f.sha256);
  lines.push('','서명: '+(n.signed?name(n.signed.authorId)+' · '+n.signed.createdAt+' · 리비전 '+n.signed.revision:'미서명'),'','앱 내 서명은 계정 확인과 편집 잠금을 위한 기능입니다.');
  return {text:lines.join('\n'),revision:n.revision};
}
