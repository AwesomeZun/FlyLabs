import { useEffect, useRef, useState } from 'react';
import { Avatar, Brand, Button, Icon } from './components';
import { APIError, api, prettyDate, send, stored, storePreference, today } from './lib';
import { LabContext, type Dialog } from './context';
import type { Health, Workspace, WorkspaceSummary,User } from './types';
import Dashboard from './Dashboard';
import Auth from './Auth';
import Notebook from './Notebook';
import Experiments from './Experiments';
import Notes from './Notes';
import Resources from './Resources';
import Handover from './Handover';
import Settings from './Settings';
import DemoSettings from './DemoSettings';
import Evidence from './Evidence';
import { Dialogs } from './Forms';

const nav=[{id:'evidence',label:'연구 워크스페이스',icon:'home'},{id:'sources',label:'자료 라이브러리',icon:'note'},{id:'compare',label:'조건 비교',icon:'search'},{id:'prepare',label:'연구 준비표',icon:'flask'},{id:'notebook',label:'랩노트',icon:'note'},{id:'today',label:'오늘의 연구실',icon:'home'},{id:'experiments',label:'실험 관리',icon:'flask'},{id:'notes',label:'진행 기록',icon:'note'},{id:'resources',label:'자원 · 장비 예약',icon:'box'},{id:'handover',label:'인수인계',icon:'handover'},{id:'engine',label:'판단 · 처리 기록',icon:'spark'}];
function route(){const [view,id='']=location.hash.slice(1).split('/');return {view:[...nav.map(x=>x.id),'settings'].includes(view)?view:'evidence',id};}
export default function App() {
  const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false);
  const [workspaces,setWorkspaces]=useState<WorkspaceSummary[]>([]),[health,setHealth]=useState<Health|null>(null);
  const [wid,setWid]=useState(stored('flylabs.v3.workspace')),[w,setW]=useState<Workspace|null>(null);
  const [actorId,setActorId]=useState(''),[current,setCurrent]=useState(route),[dialog,setDialog]=useState<Dialog|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[mobile,setMobile]=useState(false),[query,setQuery]=useState('');
  const [toast,setToast]=useState<{text:string;error:boolean}|null>(null);
  const request=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const mutation=useRef(false),selectedWorkspace=useRef(wid);
  selectedWorkspace.current=wid;
  function notify(text:string,error=false){setToast({text,error});clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(null),error?9000:4000);}
  function go(view:string,id=''){location.hash=view+(id?'/'+id:'');setMobile(false);setQuery('');}
  function changeWorkspace(id:string){if(mutation.current)return;setW(null);setWid(id);storePreference('flylabs.v3.workspace',id);setDialog(null);go('evidence');}
  async function initialize(){setError('');try{const [h,identity]=await Promise.all([api<Health>('/health'),api<{user:User|null}>('/auth/me')]);setHealth(h);setUser(identity.user);setAuthReady(true);if(!identity.user){setW(null);return;}let invited='';if(location.hash.startsWith('#invite/')){try{const accepted=await send<{workspaceId:string}>('/invitations/accept',{token:location.hash.slice(8)});invited=accepted.workspaceId;location.hash='evidence';notify('연구실에 참여했습니다.');}catch(e){notify((e as Error).message,true);}}const list=await api<WorkspaceSummary[]>('/workspaces');setWorkspaces(list);if(!list.length)throw new Error('연구실을 불러오지 못했습니다.');const id=invited||(list.some(s=>s.id===wid)?wid:(list.find(s=>s.hasEvidence)||list[0]).id);setWid(id);const data=await api<Workspace>('/workspaces/'+id);setW(data);setActorId(data.actorId);storePreference('flylabs.v3.workspace',id);}catch(e){setError((e as Error).message);setAuthReady(true);}}
  async function refresh(){if(!wid||!user)return;const token=++request.current;let data:Workspace;try{data=await api<Workspace>('/workspaces/'+wid);}catch(e){if(e instanceof APIError&&e.status===401){setUser(null);setW(null);setWid('');return;}if(e instanceof APIError&&e.status===403){setW(null);await initialize();return;}throw e;}if(token!==request.current||selectedWorkspace.current!==wid)return;setW(data);setError('');setActorId(data.actorId);}
  async function logout(){await send('/auth/logout',{});setUser(null);setW(null);setWid('');setDialog(null);setActorId('');sessionStorage.clear();}
  useEffect(()=>{void initialize();return()=>{clearTimeout(timer.current);};},[]);
  useEffect(()=>{if(!wid||!user)return;void refresh().catch(e=>setError(e.message));void api<WorkspaceSummary[]>('/workspaces').then(setWorkspaces).catch(()=>{});},[wid,user?.id]);
  useEffect(()=>{const onHash=()=>setCurrent(route());window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);},[]);
  useEffect(()=>{const onFocus=()=>{if(wid&&user&&!mutation.current)void refresh().catch(()=>{});};window.addEventListener('focus',onFocus);const polling=setInterval(()=>{if(document.visibilityState==='visible')onFocus();},15000);return()=>{window.removeEventListener('focus',onFocus);clearInterval(polling);};},[wid,user?.id]);
  async function mutate(path:string,payload:Record<string,unknown>){if(w?.myRole==='viewer'){notify('열람 권한으로는 수정할 수 없습니다.',true);throw new Error('열람 권한으로는 수정할 수 없습니다.');}if(mutation.current)throw new Error('앞선 저장이 끝난 뒤 다시 시도해 주세요.');mutation.current=true;setBusy(true);try{const result=await send<{result:string|null;workspace?:Workspace}>('/workspaces/'+wid+'/'+path,payload);if(result.workspace)setW(result.workspace);else await refresh();notify('저장했습니다.');return result.result;}catch(e){if(e instanceof APIError&&e.status===401){setUser(null);setW(null);setWid('');}notify((e as Error).message,true);throw e;}finally{mutation.current=false;setBusy(false);}}
  const act=(type:string,payload:Record<string,unknown>)=>mutate('actions',{type,payload,actorId});
  const post=async(path:string,payload:Record<string,unknown>)=>{await mutate(path,{...payload,actorId});};
  if(authReady&&!user&&!error)return <Auth onDone={initialize}/>;
  if(!w||!health||!user)return <div className="app-loading"><Brand/>{error?<><h2>연구실에 연결하지 못했습니다</h2><p role="alert">{error}</p><Button onClick={()=>{if(wid)void refresh().catch(e=>setError(e.message));void initialize();}}>다시 연결</Button></>:<><div className="loading-spinner"/><p>연구실을 준비하고 있습니다…</p></>}</div>;
  const canEdit=w.myRole!=='viewer';
  const pending=w.notes.filter(n=>n.review==='pending').length;
  const actor=w.members.find(m=>m.id===actorId);
  const searches=query.trim().toLowerCase();
  const results=searches?[...w.evidence.documents.filter(d=>!d.archived&&(d.title+' '+d.text).toLowerCase().includes(searches)).map(d=>({key:d.id,type:'자료',title:d.title,action:()=>go('sources',d.id)})),...w.experiments.filter(e=>[e.code,e.title,e.project].join(' ').toLowerCase().includes(searches)).map(e=>({key:e.id,type:'실험',title:e.title,action:()=>go('experiments',e.id)})),...w.notes.filter(n=>n.text.toLowerCase().includes(searches)).map(n=>({key:n.id,type:'기록',title:n.text,action:()=>go('experiments',n.experimentId)})),...w.resources.filter(r=>[r.name,r.location].join(' ').toLowerCase().includes(searches)).map(r=>({key:r.id,type:'자원',title:r.name,action:()=>{setQuery('');if(canEdit)setDialog({type:'resource',resourceId:r.id});else go('resources');}}))].slice(0,8):[];
  return <LabContext.Provider value={{w,health,actorId,busy,user,canEdit,logout,act,post,notify,open:d=>{if(!canEdit&&d.type!=='workspace'){notify('현재 연구실은 열람 전용입니다.',true);return;}setDialog(d);},go,refresh,changeWorkspace}}>
    <div className="app-shell">
      {mobile&&<button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={()=>setMobile(false)}/>}
      <aside className={'sidebar '+(mobile?'is-open':'')}><div className="sidebar-brand"><Brand/><span className="version-label">RESEARCH, CONNECTED.</span></div>
        <label className="workspace-select"><span>WORKSPACE</span><select aria-label="연구실 선택" value={wid} disabled={busy} onChange={e=>changeWorkspace(e.target.value)}>{workspaces.map(s=><option key={s.id} value={s.id}>{s.name}{s.demo?' · 예시':''}</option>)}</select><small>{w.kind==='academic'?'ACADEMIC LAB':'BIOTECH R&D'}</small></label>
        <nav aria-label="주 메뉴"><span className="nav-label">WORKSPACE</span>{nav.map(n=><button key={n.id} className={current.view===n.id?'active':''} aria-current={current.view===n.id?'page':undefined} onClick={()=>go(n.id)}><Icon name={n.icon}/><span>{n.label}</span>{n.id==='notes'&&pending>0&&<b className="nav-count">{pending}</b>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Icon name="spark"/></span><strong>근거를 모으고,<br/>다음 연구로.</strong><p>자료 · 비교 · 준비 · 기록</p></div><button className={'settings-link '+(current.view==='settings'?'active':'')} onClick={()=>go('settings')}><Icon name="settings"/>연구실 설정<span className={'status-dot '+(health.jevConfigured?'connected':'')}/></button><div className="profile"><Avatar person={actor}/><div className="account-label"><span>{user.name}</span><small>{__PUBLIC_DEMO__?'개인 체험판':w.myRole==='owner'?'관리자':canEdit?'편집자':'열람자'}</small></div>{!__PUBLIC_DEMO__&&<button className="logout-button" onClick={()=>void logout().catch(e=>notify(e.message,true))}>로그아웃</button>}</div></div>
      </aside>
      <div className="workspace-main"><header className="topbar"><div className="topbar-location"><button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={()=>setMobile(true)}><Icon name="menu"/></button><span className="breadcrumb">{w.name}<Icon name="chevron"/><b>{nav.find(n=>n.id===current.view)?.label||'연구실 설정'}</b></span></div><div className="topbar-actions"><div className="global-search"><Icon name="search"/><input aria-label="전체 검색" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQuery('');}} placeholder="자료, 실험, 기록 검색"/>{query&&<button className="icon-button" aria-label="검색 지우기" onClick={()=>setQuery('')}><Icon name="close"/></button>}{searches&&<div className="search-results">{results.length?results.map(r=><button key={r.key} onClick={r.action}><small>{r.type}</small><span>{r.title}</span><Icon name="chevron"/></button>):<p>검색 결과가 없습니다.</p>}</div>}</div><button className="notification-button" aria-label={'검토할 변경안 '+pending+'건'} onClick={()=>go('notes')}><Icon name="note"/>{pending>0&&<i/>}</button><Avatar person={actor} small/></div></header>
        <main className="content" id="main-content"><div className="content-meta"><span><i className="online-dot"/>{__PUBLIC_DEMO__?'이 브라우저에 저장 · 외부 AI 미연결':'연구실 서버에 저장됨'}{busy?' · 저장 중…':''}</span><span>{prettyDate(today(),true)}</span></div>{__PUBLIC_DEMO__&&<div className="public-demo-notice"><b>공개 체험판</b><span>자료는 이 브라우저에만 저장됩니다. 계정·팀 공유 없이 이용하며, 예시로 흐름을 살펴보세요.</span></div>}{w.demo&&<div className="demo-notice"><span><b>체험 연구실</b> 가상의 실험·재고·구성원으로 서비스를 살펴보세요.</span><button onClick={()=>setDialog({type:'workspace'})}>내 연구실 만들기<Icon name="chevron"/></button></div>}
          {!canEdit&&<div className="inline-note readonly-banner">이 연구실은 열람 전용입니다. 노트와 파일을 확인하고 내보낼 수 있습니다.</div>}<div key={wid+'/'+current.view+'/'+current.id}>{['evidence','sources','compare','prepare','engine'].includes(current.view)?<Evidence view={current.view} selectedId={current.id}/>:current.view==='today'?<Dashboard/>:current.view==='notebook'?<Notebook selected={current.id}/>:current.view==='experiments'?<Experiments selected={current.id}/>:current.view==='notes'?<Notes/>:current.view==='resources'?<Resources/>:current.view==='handover'?<Handover selected={current.id}/>:__PUBLIC_DEMO__?<DemoSettings/>:<Settings/>}</div>
          <footer className="app-footer"><span>FlyLabs · 근거에서 다음 연구까지</span><span>v3.1.0 · {health.jevConfigured?'Jev 키 설정됨':'규칙 점검 사용 가능'}</span></footer>
        </main>
      </div>
    </div>
    {dialog&&<Dialogs key={JSON.stringify(dialog)} dialog={dialog} onClose={()=>setDialog(null)}/>}
    {toast&&<div className={'toast '+(toast.error?'error':'')} role={toast.error?'alert':'status'}><Icon name={toast.error?'alert':'check'}/>{toast.text}<button aria-label="알림 닫기" onClick={()=>setToast(null)}><Icon name="close"/></button></div>}
  </LabContext.Provider>;
}
