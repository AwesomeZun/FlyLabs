import { useEffect, useRef, useState } from 'react';
import { Avatar, Brand, Button, Icon } from './components';
import { APIError, api, send, stored, storePreference } from './lib';
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

// v5.1.0: 메뉴를 '연구 흐름'과 '연구실 운영'으로 묶고, 흐름 단계에는 순서 번호를 붙입니다.
const nav:{id:string;label:string;icon:string;group:'flow'|'lab';step?:string}[]=[{id:'evidence',label:'연구 워크스페이스',icon:'home',group:'flow'},{id:'sources',label:'자료 라이브러리',icon:'library',group:'flow',step:'01'},{id:'compare',label:'조건 비교',icon:'compare',group:'flow',step:'02'},{id:'prepare',label:'연구 준비표',icon:'clipboard',group:'flow',step:'03'},{id:'notebook',label:'랩노트',icon:'notebook',group:'flow',step:'04'},{id:'engine',label:'판단 · 처리 기록',icon:'route',group:'flow'},{id:'today',label:'오늘의 연구실',icon:'sun',group:'lab'},{id:'experiments',label:'실험 관리',icon:'flask',group:'lab'},{id:'notes',label:'진행 기록',icon:'notes',group:'lab'},{id:'resources',label:'자원 · 장비 예약',icon:'box',group:'lab'},{id:'handover',label:'인수인계',icon:'handover',group:'lab'}];
const navGroups=[['flow','연구 흐름'],['lab','연구실 운영']] as const;
// 시연 모드: 화면 순서와 한 문장 설명입니다. 좌우 방향키로 넘기고 Esc로 끝냅니다.
const tourSteps=[{view:'evidence',title:'첫 화면',say:'실험 기록 2개의 조건을 맞춰 본 결과와 다음에 할 일을 보여 줘요.'},{view:'sources',title:'1. 자료 모으기',say:'비교할 자료를 체크해요.'},{view:'compare',title:'2. 조건 비교',say:'다른 조건이 위에 모여요. 값을 누르면 원문이 열려요.'},{view:'prepare',title:'3. 연구 준비표',say:'확인할 조건을 고르고 저장해요.'},{view:'notebook',title:'4. 랩노트',say:'계획과 결과를 나눠서 기록해요.'},{view:'engine',title:'처리 기록',say:'어떤 원문을 어떤 순서로 봤는지 남아요.'}];
const isMac=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
function route(){const [view,id='']=location.hash.slice(1).split('/');return {view:[...nav.map(x=>x.id),'settings'].includes(view)?view:'evidence',id};}
export default function App() {
  const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false);
  const [workspaces,setWorkspaces]=useState<WorkspaceSummary[]>([]),[health,setHealth]=useState<Health|null>(null);
  const [wid,setWid]=useState(stored('flylabs.v3.workspace')),[w,setW]=useState<Workspace|null>(null);
  const [actorId,setActorId]=useState(''),[current,setCurrent]=useState(route),[dialog,setDialog]=useState<Dialog|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[mobile,setMobile]=useState(false),[query,setQuery]=useState('');
  const [toast,setToast]=useState<{text:string;error:boolean}|null>(null),[tour,setTour]=useState<number|null>(null),[noticeHidden,setNoticeHidden]=useState(()=>stored('flylabs.v4.notice')==='hidden');
  const request=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),searchInput=useRef<HTMLInputElement>(null);
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
  function moveTour(i:number){const step=tourSteps[Math.max(0,Math.min(tourSteps.length-1,i))];setTour(tourSteps.indexOf(step));go(step.view);}
  useEffect(()=>{if(tour===null)return;const onKey=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;if(t&&(['INPUT','TEXTAREA','SELECT'].includes(t.tagName)||t.isContentEditable)||document.querySelector('[role=dialog]'))return;if(e.key==='ArrowRight'){e.preventDefault();moveTour(tour+1);}else if(e.key==='ArrowLeft'){e.preventDefault();moveTour(tour-1);}else if(e.key==='Escape')setTour(null);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[tour]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;const typing=!!t&&(['INPUT','TEXTAREA','SELECT'].includes(t.tagName)||t.isContentEditable);if(((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')||(e.key==='/'&&!typing)){e.preventDefault();searchInput.current?.focus();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
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
    <div className={'app-shell'+(tour!==null?' is-presenting':'')}>
      {mobile&&<button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={()=>setMobile(false)}/>}
      <aside className={'sidebar '+(mobile?'is-open':'')}><div className="sidebar-brand"><Brand/></div>
        <label className="workspace-select"><span>연구실</span><select aria-label="연구실 선택" value={wid} disabled={busy} onChange={e=>changeWorkspace(e.target.value)}>{workspaces.map(s=><option key={s.id} value={s.id}>{s.name}{s.demo?' · 예시':''}</option>)}</select><small>{w.kind==='academic'?'대학 연구실':'바이오텍 R&D'}{w.demo?' · 예시 데이터':''}</small></label>
        <nav aria-label="주 메뉴">{navGroups.map(([group,title])=><div className="nav-group" key={group}><span className="nav-label">{title}</span>{nav.filter(n=>n.group===group).map(n=><button key={n.id} className={current.view===n.id?'active':''} aria-current={current.view===n.id?'page':undefined} onClick={()=>go(n.id)}><Icon name={n.icon}/><span>{n.label}</span>{n.id==='notes'&&pending>0&&<b className="nav-count">{pending}</b>}</button>)}</div>)}</nav>
        <div className="sidebar-bottom"><p className={'side-status'+(busy?' is-busy':'')}><i className="online-dot"/><span>{__PUBLIC_DEMO__?'이 브라우저에 저장 · 외부 AI 미연결':'연구실 서버에 저장됨'}{busy?' · 저장 중…':''}</span></p><button className={'settings-link '+(current.view==='settings'?'active':'')} onClick={()=>go('settings')}><Icon name="settings"/>연구실 설정<span className={'status-dot '+(health.jevConfigured?'connected':'')}/></button><div className="profile"><Avatar person={actor}/><div className="account-label"><span>{user.name}</span><small>{__PUBLIC_DEMO__?'개인 체험판':w.myRole==='owner'?'관리자':canEdit?'편집자':'열람자'}</small></div>{!__PUBLIC_DEMO__&&<button className="logout-button" onClick={()=>void logout().catch(e=>notify(e.message,true))}>로그아웃</button>}</div></div>
      </aside>
      <div className="workspace-main"><header className="topbar"><div className="topbar-location"><button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={()=>setMobile(true)}><Icon name="menu"/></button><span className="topbar-title">{nav.find(n=>n.id===current.view)?.label||'연구실 설정'}</span></div><div className="topbar-actions"><div className="global-search"><Icon name="search"/><input ref={searchInput} aria-label="전체 검색" aria-keyshortcuts={isMac?'Meta+K /':'Control+K /'} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setQuery('');e.currentTarget.blur();}}} placeholder="자료, 실험, 기록 검색"/>{!query&&<kbd aria-hidden="true">{isMac?'⌘K':'Ctrl K'}</kbd>}{query&&<button className="icon-button" aria-label="검색 지우기" onClick={()=>setQuery('')}><Icon name="close"/></button>}{searches&&<div className="search-results">{results.length?results.map(r=><button key={r.key} onClick={r.action}><small>{r.type}</small><span>{r.title}</span><Icon name="chevron"/></button>):<p>검색 결과가 없습니다.</p>}</div>}</div><button className={'present-button'+(tour!==null?' is-on':'')} aria-pressed={tour!==null} onClick={()=>tour===null?moveTour(0):setTour(null)}><Icon name={tour===null?'play':'close'}/><span>{tour===null?'시연 모드':'시연 종료'}</span></button><Avatar person={actor} small/></div></header>
        <main className="content" id="main-content">{(__PUBLIC_DEMO__||w.demo)&&!noticeHidden&&tour===null&&<div className={__PUBLIC_DEMO__?'public-demo-notice':'demo-notice'}><Icon name="info"/><p>{__PUBLIC_DEMO__?'여러 실험 기록의 조건을 서로 맞춰 보는 도구의 공개 체험판이에요. 예시 자료로 채워져 있고, 입력한 내용은 이 브라우저에만 저장돼요.':'체험 연구실이에요. 가상의 실험과 구성원으로 채워져 있어요.'}</p><button className="icon-button notice-close" aria-label="안내 닫기" onClick={()=>{setNoticeHidden(true);storePreference('flylabs.v4.notice','hidden');}}><Icon name="close"/></button></div>}
          {!canEdit&&<div className="inline-note readonly-banner">이 연구실은 열람 전용입니다. 노트와 파일을 확인하고 내보낼 수 있습니다.</div>}<div key={wid+'/'+current.view+'/'+current.id}>{['evidence','sources','compare','prepare','engine'].includes(current.view)?<Evidence view={current.view} selectedId={current.id}/>:current.view==='today'?<Dashboard/>:current.view==='notebook'?<Notebook selected={current.id}/>:current.view==='experiments'?<Experiments selected={current.id}/>:current.view==='notes'?<Notes/>:current.view==='resources'?<Resources/>:current.view==='handover'?<Handover selected={current.id}/>:__PUBLIC_DEMO__?<DemoSettings/>:<Settings/>}</div>
          <footer className="app-footer"><span>FlyLabs · 근거에서 다음 연구까지</span><span>v5.1.0 · {health.jevConfigured?'Jev 키 설정됨':'규칙 점검 사용 가능'}</span></footer>
        </main>
      </div>
    </div>
    {tour!==null&&<section className="tour-bar" aria-label="시연 가이드"><div className="tour-progress" aria-hidden="true">{tourSteps.map((t,i)=><i key={t.view} className={i<tour?'done':i===tour?'current':''}/>)}</div><div className="tour-body" aria-live="polite"><span className="tour-count">{tour+1} / {tourSteps.length}</span><strong>{tourSteps[tour].title}</strong><p>{tourSteps[tour].say}</p></div><div className="tour-actions"><button className="tour-nav" aria-label="이전 화면" disabled={tour===0} onClick={()=>moveTour(tour-1)}><Icon name="back"/></button>{tour<tourSteps.length-1?<button className="tour-next" onClick={()=>moveTour(tour+1)}>다음<Icon name="chevron"/></button>:<button className="tour-next" onClick={()=>{setTour(null);go('evidence');}}>마치기<Icon name="check"/></button>}<button className="tour-nav" aria-label="시연 모드 끝내기" onClick={()=>setTour(null)}><Icon name="close"/></button></div></section>}
    {dialog&&<Dialogs key={JSON.stringify(dialog)} dialog={dialog} onClose={()=>setDialog(null)}/>}
    {toast&&<div className={'toast '+(toast.error?'error':'')} role={toast.error?'alert':'status'}><Icon name={toast.error?'alert':'check'}/>{toast.text}<button aria-label="알림 닫기" onClick={()=>setToast(null)}><Icon name="close"/></button></div>}
  </LabContext.Provider>;
}
