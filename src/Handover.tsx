import { useState } from 'react';
import { useLab } from './context';
import { Button, Empty, Field, Icon, SectionHeading } from './components';
import { api, download, today } from './lib';

type Draft={text:string;count:number;generatedAt:string};
export default function Handover({selected}:{selected:string}) {
  const {w,notify}=useLab();
  const [ids,setIds]=useState<string[]>(selected?[selected]:[]);
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null),[generating,setGenerating]=useState(false);
  const [revision,setRevision]=useState(-1);
  function clear(){setDraft(null);}
  async function generate() {
    setGenerating(true);
    try {const params=new URLSearchParams({from,to});ids.forEach(id=>params.append('experiment',id));const result=await api<Draft>('/workspaces/'+w.id+'/handover?'+params);setDraft(result);setRevision(w.revision);}catch(err){notify((err as Error).message,true);}finally{setGenerating(false);}
  }
  return <><div className="page-heading"><div><div className="eyebrow">RESEARCH CONTINUITY</div><h1>다음 사람도 이어갈 수 있도록<span className="heading-dot">.</span></h1><p>준비 항목, 진행 메모, 결과 파일을 모아 인수인계 초안을 만듭니다.</p></div><span className="soft-label"><Icon name="file"/>기록 기반 초안</span></div>
    <div className="handover-layout"><section className="panel handover-options"><SectionHeading title="포함할 기록"/><div className="panel-body"><p className="muted">실험을 선택하지 않으면 전체 실험을 포함합니다. 날짜는 실험 예정일 기준입니다.</p><div className="form-grid"><Field label="시작일"><input type="date" value={from} onChange={e=>{setFrom(e.target.value);clear();}}/></Field><Field label="종료일"><input type="date" value={to} onChange={e=>{setTo(e.target.value);clear();}}/></Field></div><div className="selection-heading"><b>실험 선택</b><button className="text-button" onClick={()=>{setIds([]);clear();}}>전체 포함</button></div><div className="experiment-picker">{w.experiments.map(e=><label key={e.id}><input type="checkbox" checked={ids.includes(e.id)} onChange={event=>{setIds(old=>event.target.checked?[...old,e.id]:old.filter(x=>x!==e.id));clear();}}/><span><small>{e.code} · {e.project}</small><strong>{e.title}</strong></span></label>)}</div><Button disabled={!w.experiments.length||generating} className="full-width" onClick={()=>void generate()}><Icon name="handover"/>{generating?'기록 모으는 중…':'인수인계 초안 만들기'}</Button><p className="form-hint">입력한 원문과 출처 ID를 포함합니다. 파일 내용 분석이나 누락된 실험 조건의 추정은 하지 않습니다.</p></div></section>
      <section className="panel draft-panel"><SectionHeading title="인수인계 미리보기" action={draft&&<Button kind="secondary" onClick={()=>download('FlyLabs-handover-'+today()+'.md',draft.text,'text/markdown;charset=utf-8')}><Icon name="download"/>Markdown 저장</Button>}/>
        {draft?<><div className="draft-meta"><span>실험 {draft.count}개 · {new Date(draft.generatedAt).toLocaleString('ko-KR')}</span><button className="text-button" onClick={()=>{void navigator.clipboard.writeText(draft.text).then(()=>notify('초안을 복사했습니다.')).catch(()=>notify('복사할 수 없습니다. Markdown 저장을 이용해 주세요.',true));}}>내용 복사</button></div>{revision!==w.revision&&<div className="inline-note">초안 생성 후 기록이 변경되었습니다. 다시 생성하면 최신 내용을 반영합니다.</div>}<pre className="draft-text">{draft.text}</pre></>:<Empty title="흩어진 기록이 한 장의 인수인계로" description="왼쪽에서 실험과 기간을 선택하고 초안을 만들어 보세요. 다음 연구원이 확인할 준비와 원문 기록이 함께 정리됩니다."/>}
      </section></div>
  </>;
}
