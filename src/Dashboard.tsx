import { useState } from 'react';
import { useLab } from './context';
import { Avatar, Badge, Button, Empty, Icon, SectionHeading } from './components';
import { prettyDate, shortTime, today } from './lib';
import { CATEGORY, type Experiment } from './types';

export function ExperimentRow({exp}:{exp:Experiment}) {
  const {w,go}=useLab();const owner=w.members.find(m=>m.id===exp.ownerId);
  const done=exp.tasks.filter(t=>t.done).length;const issues=w.issues[exp.id]||[];
  return <button className="experiment-row" onClick={()=>go('experiments',exp.id)}>
    <span className={'experiment-glyph '+(exp.status==='blocked'?'amber':exp.status==='running'?'blue':'violet')}><Icon name="flask"/></span>
    <span className="experiment-name"><span className="eyebrow">{exp.code} <span>·</span> {exp.project}</span><strong>{exp.title}</strong><span className={'row-meta '+(issues.length?'warning-text':'')}>{issues.length?<><Icon name="alert"/>{issues[0].text}{issues.length>1?' 외 '+(issues.length-1)+'건':''}</>:<>{prettyDate(exp.date)} 예정 <span>·</span> 준비 {done}/{exp.tasks.length}</>}</span></span>
    <span className="row-progress"><span><i style={{width:(exp.tasks.length?done/exp.tasks.length*100:0)+'%'}}/></span><small>{done}/{exp.tasks.length}</small></span>
    <Badge status={exp.status}/><Avatar person={owner} small/><Icon name="chevron"/>
  </button>;
}
export default function Dashboard() {
  const {w,actorId,open,go}=useLab();const [selectedDay,setSelectedDay]=useState(today());
  const [tab,setTab]=useState('all');
  const active=w.experiments.filter(e=>e.status!=='completed');
  const blocked=active.filter(e=>e.status==='blocked'||(w.issues[e.id]||[]).some(i=>i.kind==='blocker'));
  const unknown=active.filter(e=>(w.issues[e.id]||[]).some(i=>i.kind==='unknown'));
  const pending=w.notes.filter(n=>n.review==='pending');
  const focus=[...new Set([...blocked.map(e=>e.id),...unknown.map(e=>e.id)])];
  const rows=active.filter(e=>tab==='mine'?e.ownerId===actorId:tab==='attention'?focus.includes(e.id):true).sort((a,b)=>a.date.localeCompare(b.date));
  const reservations=w.reservations.filter(r=>r.start.slice(0,10)===selectedDay).sort((a,b)=>a.start.localeCompare(b.start));
  const actor=w.members.find(m=>m.id===actorId);
  const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return {date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),number:d.getDate(),day:d.toLocaleDateString('ko-KR',{weekday:'short'})};});
  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR LAB, IN SYNC</div><h1>{actor?.name}님, 오늘도 연구에 집중하세요<span className="heading-dot">.</span></h1><p>흩어진 준비와 기록을 연결해, 다음 실험을 이어갑니다.</p></div><Button onClick={()=>open({type:'experiment'})}><Icon name="plus"/>새 실험</Button></div>
    <div className="focus-banner"><div className="focus-symbol"><Icon name="spark"/></div><div><span className="eyebrow">오늘의 체크포인트</span><h2>{focus.length?focus.length+'개의 실험에 확인이 필요해요.':'등록된 자원에 확인 이슈가 없어요.'}</h2><p>{focus.length?'재료·장비 상태를 확인하고, 막혀 있는 다음 단계를 이어가세요.':'오늘의 작업을 확인하거나 새 실험을 등록해 보세요.'}</p></div><Button kind="secondary" onClick={()=>setTab('attention')}>확인할 실험 보기<Icon name="chevron"/></Button></div>
    <div className="stats-row">
      {[{label:'진행 중인 실험',value:active.length,icon:'flask',tone:'violet',hint:'준비·진행·보류 포함',action:()=>setTab('all')},{label:'진행이 막힌 실험',value:blocked.length,icon:'alert',tone:'amber',hint:'보류 또는 자원 부족',action:()=>setTab('attention')},{label:'검토할 변경안',value:pending.length,icon:'note',tone:'blue',hint:'원문 확인 후 반영',action:()=>go('notes')},{label:'오늘 장비 예약',value:w.reservations.filter(r=>r.start.slice(0,10)===today()).length,icon:'calendar',tone:'teal',hint:prettyDate(today()),action:()=>go('resources')}].map(s=><button className="stat" key={s.label} onClick={s.action}><span className={'stat-icon '+s.tone}><Icon name={s.icon}/></span><div><span>{s.label}</span><strong>{s.value}<small>건</small></strong><p>{s.hint}</p></div></button>)}
    </div>
    <div className="dashboard-columns">
      <div className="main-column">
        <section className="panel experiments-panel"><SectionHeading title="실험 워크보드" count={active.length} action={<button className="text-button" onClick={()=>go('experiments')}>전체 실험<Icon name="chevron"/></button>}/><div className="tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>진행 중</button><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>내 실험</button><button className={tab==='attention'?'active':''} onClick={()=>setTab('attention')}>확인 필요 <span>{focus.length}</span></button></div><div className="experiment-list">{rows.slice(0,5).map(e=><ExperimentRow key={e.id} exp={e}/>)}{!rows.length&&<Empty title={tab==='attention'?'지금 확인할 자원 이슈가 없습니다':'표시할 실험이 없습니다'} description="새 실험을 등록하면 준비 항목과 진행 상태를 여기에서 확인할 수 있습니다." action={<Button kind="secondary" onClick={()=>open({type:'experiment'})}>실험 등록</Button>}/>}</div></section>
        <section className="panel recent-panel"><SectionHeading title="최근 연구 기록" action={<button className="text-button" onClick={()=>open({type:'note'})} disabled={!w.experiments.length}><Icon name="plus"/>기록 남기기</button>}/>{w.notes.length?w.notes.slice(0,3).map(n=><button key={n.id} className="recent-note" onClick={()=>go('experiments',n.experimentId)}><Avatar person={w.members.find(m=>m.id===n.authorId)} small/><div><span className="eyebrow">{w.experiments.find(e=>e.id===n.experimentId)?.code} <span>·</span> {CATEGORY[n.category]} <span>·</span> {shortTime(n.createdAt)}</span><p>{n.text}</p><small>{w.members.find(m=>m.id===n.authorId)?.name} · {n.source==='jev'?'Jev 판단':n.source==='rules'?'규칙 점검':'직접 기록'}</small></div><Icon name="chevron"/></button>):<div className="subtle-empty">첫 진행 메모를 남겨 보세요. 실험과 함께 기록됩니다.</div>}</section>
      </div>
      <aside className="side-column">
        <section className="panel schedule-panel"><SectionHeading title="장비 일정" action={<button aria-label="장비 예약 추가" className="icon-button" onClick={()=>open({type:'reservation'})} disabled={!w.experiments.length}><Icon name="plus"/></button>}/><div className="week-strip">{week.map(d=><button key={d.date} aria-label={d.date+' 일정'} className={selectedDay===d.date?'selected':''} onClick={()=>setSelectedDay(d.date)}><span>{d.day}</span><strong>{d.number}</strong><i className={w.reservations.some(r=>r.start.slice(0,10)===d.date)?'has-events':''}/></button>)}</div><div className="schedule-date">{prettyDate(selectedDay,true)}{selectedDay===today()&&<span>오늘</span>}</div><div className="schedule-list">{reservations.length?reservations.map(r=><button key={r.id} className="schedule-item" onClick={()=>go('experiments',r.experimentId)}><span className="schedule-time">{r.start.slice(11)}<small>{r.end.slice(11)}</small></span><span className="schedule-info"><strong>{w.resources.find(x=>x.id===r.resourceId)?.name}</strong><small>{w.experiments.find(e=>e.id===r.experimentId)?.code} · {w.members.find(m=>m.id===r.ownerId)?.name}</small></span></button>):<div className="subtle-empty">이 날의 예약이 없습니다.</div>}</div><button className="calendar-link" onClick={()=>go('resources')}>예약 관리<Icon name="chevron"/></button></section>
        <section className="quick-note-card"><span className="quick-symbol"><Icon name="note"/></span><h2>작은 메모도<br/> 연구의 다음 단계로.</h2><p>진행 상황을 남기면 관련 실험에 연결하고, 필요한 변경을 확인할 수 있어요.</p><Button kind="secondary" onClick={()=>open({type:'note'})} disabled={!w.experiments.length}>진행 기록 남기기<Icon name="plus"/></Button></section>
        <section className="team-card"><div className="avatar-stack">{w.members.slice(0,4).map(m=><Avatar key={m.id} person={m} small/>)}</div><div><strong>함께하는 연구원 {w.members.length}명</strong><p>연구실의 기록을 함께 이어가세요.</p></div></section>
      </aside>
    </div>
  </>;
}
