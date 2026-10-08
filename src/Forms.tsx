import { useState, type FormEvent } from 'react';
import { useLab, type Dialog } from './context';
import { Button, Field, Modal } from './components';
import { KIND, RESOURCE_STATUS, type ResourceStatus } from './types';
import { send, today } from './lib';

export function Dialogs({dialog,onClose}:{dialog:Dialog;onClose:()=>void}) {
  const lab=useLab(),{w,busy}=lab;
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const [form,setForm]=useState<Record<string,string>>(()=>{
    const r=w.resources.find(r=>r.id===dialog.resourceId);
    return {title:'',project:'',ownerId:lab.actorId,date:today(),priority:'normal',description:'',protocol:'',checklist:'실험 절차와 시료 목록 확인\n재료 및 장비 준비 확인\n결과 파일 연결',text:'',mode:'rules',experimentId:dialog.experimentId||w.experiments[0]?.id||'',name:r?.name||'',kind:r?.kind||(dialog.type==='workspace'?'academic':'reagent'),quantity:String(r?.quantity??1),unit:r?.unit||'개',location:r?.location||'',status:r?.status||'unknown',note:r?.note||'',resourceId:dialog.resourceId||w.resources.find(r=>r.kind==='equipment')?.id||'',start:today()+'T09:00',end:today()+'T10:00',owner:'',role:'연구원'};
  });
  const [selected,setSelected]=useState<Record<string,number>>({});
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  const disabled=busy||submitting;
  const titles={experiment:'새 실험 등록',note:'진행 기록 남기기',resource:dialog.resourceId?'자원 정보 수정':'자원 등록',reservation:'장비 예약',workspace:'새 연구실 만들기',member:'구성원 등록'};
  const descriptions={experiment:'실험 하나부터, 필요한 준비를 함께 연결하세요.',note:'기록은 저장하고, 제안된 상태 변경은 검토 후 반영합니다.',resource:'직접 확인한 수량과 상태를 기록하세요.',reservation:'같은 장비의 예약이 겹치면 저장 전에 알려드립니다.',workspace:'예시 데이터 없이 시작하는 독립된 작업 공간입니다.',member:'계정이 없는 외부 협업자를 담당자로 기록할 수 있습니다. 로그인 초대는 설정에서 별도로 만듭니다.'};
  async function submit(e:FormEvent) {
    e.preventDefault();if(disabled)return;setError('');setSubmitting(true);
    try {
      if(dialog.type==='experiment') {
        const id=await lab.act('experiment.create',{...form,requirements:Object.entries(selected).map(([resourceId,amount])=>({resourceId,amount}))});
        onClose();if(id)lab.go('notebook',id);return;
      }
      if(dialog.type==='note') await lab.post('notes',{experimentId:form.experimentId,text:form.text,mode:form.mode});
      if(dialog.type==='resource') await lab.act('resource.save',{...form,id:dialog.resourceId,quantity:Number(form.quantity)});
      if(dialog.type==='reservation') await lab.act('reservation.create',{resourceId:form.resourceId,experimentId:form.experimentId,ownerId:form.ownerId,start:form.start,end:form.end});
      if(dialog.type==='member') await lab.act('member.add',{name:form.name,role:form.role});
      if(dialog.type==='workspace') {
        const result=await send<{id:string}>('/workspaces',{name:form.name,kind:form.kind});
        lab.changeWorkspace(result.id);
      }
      onClose();
    } catch(err) {setError((err as Error).message);} finally{setSubmitting(false);}
  }
  const ownerField=<Field label="담당자"><select value={form.ownerId} onChange={e=>set('ownerId',e.target.value)}>{w.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>;
  const experimentField=<Field label="연결할 실험"><select required value={form.experimentId} onChange={e=>set('experimentId',e.target.value)}><option value="" disabled>실험 선택</option>{w.experiments.map(e=><option key={e.id} value={e.id}>{e.code} · {e.title}</option>)}</select></Field>;
  return <Modal title={titles[dialog.type]} description={descriptions[dialog.type]} onClose={()=>{if(!disabled)onClose();}} wide={dialog.type==='experiment'}>
    <form onSubmit={submit}>
      <div className="modal-body">
        {dialog.type==='experiment'&&<>
          <Field label="실험명"><input required maxLength={160} placeholder="예: 신경세포 면역염색 · 시료 8개" value={form.title} onChange={e=>set('title',e.target.value)}/></Field>
          <div className="form-grid"><Field label="프로젝트"><input required maxLength={80} list="project-list" placeholder="프로젝트 이름" value={form.project} onChange={e=>set('project',e.target.value)}/><datalist id="project-list">{[...new Set(w.experiments.map(e=>e.project))].map(p=><option key={p} value={p}/>)}</datalist></Field>{ownerField}</div>
          <div className="form-grid"><Field label="예정일"><input required type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></Field><Field label="우선순위"><select value={form.priority} onChange={e=>set('priority',e.target.value)}><option value="normal">보통</option><option value="high">높음</option></select></Field></div>
          <Field label="실험 설명"><textarea rows={2} maxLength={3000} placeholder="목적, 시료 식별번호, 확인할 내용을 남겨 주세요." value={form.description} onChange={e=>set('description',e.target.value)}/></Field>
          <Field label="실험 절차 / 참고 메모" hint="연구실에서 확인한 절차만 입력하세요. 임의의 조건을 생성하지 않습니다."><textarea rows={3} maxLength={10000} placeholder="사용할 절차의 이름·버전 또는 원문" value={form.protocol} onChange={e=>set('protocol',e.target.value)}/></Field>
          <label className="text-file-import">텍스트 파일에서 절차 가져오기<input type="file" accept=".txt,.md" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>100000){setError('절차 파일은 100 KB 이하로 선택해 주세요.');return;}const text=await f.text();if(text.length>10000){setError('절차는 10,000자 이하로 입력해 주세요.');return;}set('protocol',text);}}/></label>
          <Field label="준비 항목" hint="한 줄에 한 항목씩 입력합니다."><textarea rows={3} value={form.checklist} onChange={e=>set('checklist',e.target.value)}/></Field>
          <fieldset className="requirements"><legend>필요한 재료와 장비 <span>선택</span></legend>{w.resources.length===0?<p className="muted">등록된 자원이 없습니다. 자원 메뉴에서 추가할 수 있습니다.</p>:w.resources.map(r=><div className="requirement" key={r.id}><label><input type="checkbox" checked={r.id in selected} onChange={e=>setSelected(old=>{const next={...old};if(e.target.checked)next[r.id]=1;else delete next[r.id];return next;})}/><span>{r.name}<small>{RESOURCE_STATUS[r.status]} · {r.location||'위치 미등록'}</small></span></label>{r.id in selected&&<label className="amount"><input aria-label={r.name+' 필요 수량'} type="number" min="0.01" step="any" required value={selected[r.id]} onChange={e=>setSelected(old=>({...old,[r.id]:Number(e.target.value)}))}/><span>{r.unit}</span></label>}</div>)}</fieldset>
        </>}
        {dialog.type==='note'&&<>
          {experimentField}
          <Field label="진행 메모"><textarea required maxLength={10000} rows={6} placeholder="예: 항체가 아직 도착하지 않아 촬영을 미뤄야 합니다." value={form.text} onChange={e=>set('text',e.target.value)}/></Field>
          <fieldset className="mode-picker"><legend>기록 처리 방식</legend>
            <label><input type="radio" name="mode" value="rules" checked={form.mode==='rules'} onChange={()=>set('mode','rules')}/><span><b>규칙으로 점검</b><small>명시적인 대기·진행·완료 표현을 점검합니다.</small></span></label>
            <label><input type="radio" name="mode" value="manual" checked={form.mode==='manual'} onChange={()=>set('mode','manual')}/><span><b>기록만 저장</b><small>상태 변경 제안을 만들지 않습니다.</small></span></label>
            <label className={!lab.health.jevConfigured?'disabled':''}><input type="radio" name="mode" value="jev" disabled={!lab.health.jevConfigured} checked={form.mode==='jev'} onChange={()=>set('mode','jev')}/><span><b>Jev로 판단 {!lab.health.jevConfigured&&<em>연결 필요</em>}</b><small>{lab.health.jevConfigured?'이 메모와 실험명·상태를 TypeSafe에 전송하여 판단합니다.':'설정에서 연결 상태를 확인할 수 있습니다.'}</small></span></label>
          </fieldset>
        </>}
        {dialog.type==='resource'&&<>
          <Field label="자원명"><input required maxLength={120} placeholder="시약·장비·소모품 이름" value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
          <div className="form-grid"><Field label="종류"><select value={form.kind} onChange={e=>set('kind',e.target.value)}>{Object.entries(KIND).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="확인 상태"><select value={form.status} onChange={e=>set('status',e.target.value)}>{Object.entries(RESOURCE_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div>
          <div className="form-grid"><Field label="수량"><input type="number" required min="0" step="any" value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></Field><Field label="단위"><input required maxLength={30} value={form.unit} onChange={e=>set('unit',e.target.value)}/></Field></div>
          <Field label="보관 위치"><input maxLength={120} placeholder="냉동고·선반·보관함 또는 장비실" value={form.location} onChange={e=>set('location',e.target.value)}/></Field>
          <Field label="상태 메모"><textarea maxLength={1000} rows={3} value={form.note} onChange={e=>set('note',e.target.value)}/></Field>
        </>}
        {dialog.type==='reservation'&&<>
          <Field label="장비"><select required value={form.resourceId} onChange={e=>set('resourceId',e.target.value)}><option value="" disabled>장비 선택</option>{w.resources.filter(r=>r.kind==='equipment').map(r=><option key={r.id} value={r.id}>{r.name} · {RESOURCE_STATUS[r.status]}</option>)}</select></Field>
          {experimentField}{ownerField}
          <div className="form-grid"><Field label="시작"><input required type="datetime-local" value={form.start} onChange={e=>set('start',e.target.value)}/></Field><Field label="종료"><input required type="datetime-local" value={form.end} onChange={e=>set('end',e.target.value)}/></Field></div>
        </>}
        {dialog.type==='workspace'&&<>
          <Field label="연구실 이름"><input required maxLength={80} placeholder="예: Cell Biology Lab" value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
          <Field label="연구실 유형"><select value={form.kind} onChange={e=>set('kind',e.target.value)}><option value="academic">학계 연구실</option><option value="biotech">바이오텍 R&D</option></select></Field>
          
          <div className="inline-note">로그인한 계정이 관리자가 됩니다. 설정에서 동료를 초대할 수 있습니다.</div>
        </>}
        {dialog.type==='member'&&<><Field label="이름"><input required maxLength={60} value={form.name} onChange={e=>set('name',e.target.value)}/></Field><Field label="역할"><input required maxLength={40} value={form.role} onChange={e=>set('role',e.target.value)}/></Field></>}
        {error&&<div role="alert" className="form-error">{error}</div>}
      </div>
      <div className="modal-footer"><Button kind="secondary" disabled={disabled} onClick={onClose}>취소</Button><Button type="submit" disabled={disabled}>{disabled?'저장 중…':dialog.type==='note'?'기록 저장':dialog.type==='experiment'?'실험 등록':dialog.type==='workspace'?'공간 만들기':'저장'}</Button></div>
    </form>
  </Modal>;
}
