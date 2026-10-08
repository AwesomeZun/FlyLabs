import {useLab} from './context';
import {Button,SectionHeading} from './components';
import {api,download,today} from './lib';
export default function DemoSettings(){
 const {open,notify}=useLab();
 async function backup(){try{const data=await api('/demo/export');download('FlyLabs-demo-'+today()+'.json',JSON.stringify(data,null,2),'application/json');notify('모든 연구실 기록과 첨부 원본을 내보냈습니다.');}catch(e){notify((e as Error).message,true);}}
 return <><div className="page-heading"><div><div className="eyebrow">PUBLIC PROTOTYPE · v5.0.0</div><h1>체험판과 기록 보관</h1><p>내 브라우저에서 연구 자료를 비교하고 기록하는 공개 시제품입니다.</p></div></div><div className="settings-grid">
 <section className="panel"><SectionHeading title="이 브라우저에 저장"/><div className="panel-body"><p>입력한 자료·노트·첨부 파일은 현재 브라우저에 저장됩니다. 서버나 외부 AI로 보내지 않습니다. 다른 기기와 공유되지 않으며, 사이트 데이터를 삭제하면 기록도 지워집니다.</p><p>로그인이나 계정별 접근 제어가 없는 체험판입니다. 공용 컴퓨터에서는 예시 자료로 사용해 주세요.</p><Button onClick={()=>open({type:'workspace'})}>새 연구실 만들기</Button></div></section>
 <section className="panel"><SectionHeading title="기록 내보내기"/><div className="panel-body"><p>모든 연구실의 자료·노트·수정 이력과 첨부 파일 원본을 JSON 파일로 내려받을 수 있습니다. 개별 노트는 Markdown으로 내보낼 수 있습니다.</p><Button onClick={()=>void backup()}>전체 기록 백업</Button><p className="form-hint">이 백업의 일괄 복원 화면은 아직 제공하지 않습니다. 자료 화면의 ‘기존 JSON 가져오기’는 v1.1.0 형식의 자료 백업을 지원합니다.</p></div></section>
 <section className="panel"><SectionHeading title="현재 사용할 수 있는 기능"/><div className="panel-body"><p>자료 등록 → 항목별 조건 비교 → 출처 확인 → 준비표 → 연구노트로 이어지는 흐름을 사용할 수 있습니다. 계획·관찰·해석을 구분하고 원문 수정 이력을 남깁니다.</p><p>기본 예시는 모두 합성 자료입니다. 기록 잠금은 실수로 수정하는 것을 막는 편의 기능이며, 본인 인증이나 전자서명 인증 기능은 아닙니다.</p></div></section>
 <section className="panel"><SectionHeading title="AI와 보안 개발 계획"/><div className="panel-body"><p>현재 비교는 항목명이 명시된 내용을 찾는 로컬 규칙으로 작동합니다. 외부 AI와 팀 계정은 이 공개 체험판에 연결하지 않았습니다.</p><p>연구실 서버용 시제품의 계정·권한·AI 연결 기능을 바탕으로, 승인한 정보만 외부 AI에 보내고 분석 코드는 격리된 환경에서 실행하는 구조를 개발할 계획입니다. OpenShell 보안 샌드박스는 아직 이 체험판에 적용되지 않았습니다.</p></div></section>
 </div></>;
}
