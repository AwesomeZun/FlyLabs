import { useState } from 'react';
import { useLab } from './context';
import { Button, Empty, Icon, SectionHeading, Modal } from './components';
import { KIND, RESOURCE_STATUS, type Reservation } from './types';
import { prettyDate, today } from './lib';

export default function Resources() {
  const {w,open,go,act,busy:requestBusy,canEdit}=useLab();
  const busy=requestBusy||!canEdit;
  const [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[date,setDate]=useState(today());
  const [cancel,setCancel]=useState<Reservation|null>(null);
  const resources=w.resources.filter(r=>(kind==='all'||r.kind===kind)&&[r.name,r.location,r.note].join(' ').toLowerCase().includes(query.toLowerCase()));
  const reservations=w.reservations.filter(r=>!date||(r.start.slice(0,10)<=date&&r.end.slice(0,10)>=date)).sort((a,b)=>a.start.localeCompare(b.start));
  return <><div className="page-heading"><div><div className="eyebrow">RESOURCES & SCHEDULE</div><h1>준비된 자원, 겹치지 않는 일정<span className="heading-dot">.</span></h1><p>시약의 재고와 장비의 상태를 실험에 연결합니다.</p></div><Button onClick={()=>open({type:'resource'})}><Icon name="plus"/>자원 등록</Button></div>
    <section className="panel"><div className="list-toolbar"><div className="tabs">{[['all','전체 자원'],...Object.entries(KIND)].map(([k,v])=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{v}</button>)}</div><label className="inline-search"><Icon name="search"/><input aria-label="자원 검색" placeholder="자원명·보관 위치 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="resource-table"><div className="resource-table-head"><span>자원 / 위치</span><span>확인 상태</span><span>현재 수량</span><span>연결된 실험</span><span/></div>
        {resources.map(r=>{const linked=w.experiments.filter(e=>e.requirements.some(x=>x.resourceId===r.id));return <div className="resource-table-row" key={r.id}><button className="resource-name" onClick={()=>open({type:'resource',resourceId:r.id})}><span className={'resource-icon '+(r.kind==='equipment'?'blue':'violet')}><Icon name={r.kind==='equipment'?'calendar':'box'}/></span><span><strong>{r.name}</strong><small>{KIND[r.kind]} · {r.location||'위치 미등록'}</small>{r.note&&<small className="resource-note">{r.note}</small>}</span></button><span className={'resource-status '+r.status}><i/>{RESOURCE_STATUS[r.status]}</span><span className="quantity">{r.quantity}<small>{r.unit}</small></span><div className="linked-experiments">{linked.length?linked.map(e=><button key={e.id} onClick={()=>go('experiments',e.id)} title={e.title}>{e.code}</button>):<span className="muted">—</span>}</div><button className="text-button" onClick={()=>open({type:'resource',resourceId:r.id})}>수정</button></div>;})}
        {!resources.length&&<Empty title="표시할 자원이 없습니다" description="필요한 시약과 장비를 등록하고 실험에 연결해 주세요." action={<Button kind="secondary" onClick={()=>open({type:'resource'})}>자원 등록</Button>}/>}
      </div><p className="panel-footnote">재고는 직접 확인한 수량입니다. 실험 완료 시 자동 차감하지 않습니다.</p>
    </section>
    <section className="panel booking-panel"><SectionHeading title="장비 예약" count={reservations.length} action={<Button kind="secondary" onClick={()=>open({type:'reservation'})} disabled={!w.experiments.length||!w.resources.some(r=>r.kind==='equipment')}><Icon name="plus"/>장비 예약</Button>}/><div className="booking-toolbar"><label>조회 날짜 <input type="date" aria-label="예약 조회 날짜" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="text-button" onClick={()=>setDate(date?'':today())}>{date?'전체 예약 보기':'오늘 보기'}</button><span className="muted">이 컴퓨터의 현지 시간 기준</span></div>
      {reservations.map(r=><div className="booking-row" key={r.id}><span className="booking-time"><b>{prettyDate(r.start)}</b><span>{r.start.slice(11)} – {r.end.slice(0,10)!==r.start.slice(0,10)?prettyDate(r.end)+' ':''}{r.end.slice(11)}</span></span><button className="booking-detail" onClick={()=>go('experiments',r.experimentId)}><strong>{w.resources.find(x=>x.id===r.resourceId)?.name}</strong><small>{w.experiments.find(e=>e.id===r.experimentId)?.title}</small></button><span className="muted">{w.members.find(m=>m.id===r.ownerId)?.name}</span><button className="text-button muted" disabled={!canEdit} onClick={()=>setCancel(r)}>예약 취소</button></div>)}
      {!reservations.length&&<div className="subtle-empty">선택한 날짜에 예약이 없습니다.</div>}
    </section>
    {cancel&&<Modal title="장비 예약 취소" onClose={()=>!busy&&setCancel(null)}><div className="modal-body"><p>{w.resources.find(r=>r.id===cancel.resourceId)?.name} · {prettyDate(cancel.start)} {cancel.start.slice(11)} 예약을 취소합니다.</p><p className="muted">취소 이력은 활동 기록에 남습니다.</p></div><div className="modal-footer"><Button kind="secondary" onClick={()=>setCancel(null)} disabled={busy}>돌아가기</Button><Button kind="danger" disabled={busy} onClick={()=>{void act('reservation.remove',{id:cancel.id}).then(()=>setCancel(null)).catch(()=>{});}}>예약 취소</Button></div></Modal>}
  </>;
}
