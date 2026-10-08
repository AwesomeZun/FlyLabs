import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';
class ErrorBoundary extends React.Component<React.PropsWithChildren, {error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return{error:true};}
  render(){return this.state.error?<main className="boot-error"><h1>화면을 다시 불러와 주세요.</h1><p>{__PUBLIC_DEMO__?'이 브라우저에 마지막으로 저장한 기록을 다시 불러옵니다.':'서버에 저장된 연구 기록은 유지됩니다.'}</p><button onClick={()=>location.reload()}>새로고침</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);

import './evidence.css';
// v5.0.0: 가독성 하한과 디자인 시스템은 기존 스타일보다 뒤에 와야 하므로 evidence.css 다음에 불러옵니다.
import './readability.css';
import './refresh.css';
