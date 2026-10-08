import { useEffect, useRef, useId, Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import type { Member, Status } from './types';
import { STATUS } from './types';

// v5.0.0: 유니코드 기호 대신 같은 굵기의 선형 SVG 아이콘을 씁니다. 등록되지 않은 이름은 글자 그대로 표시합니다.
const icons:Record<string,string>={
  home:'<rect x="3" y="3" width="7.5" height="9" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6"/><rect x="3" y="15" width="7.5" height="6" rx="1.6"/>',
  library:'<path d="M5 19.5V5.2A2.2 2.2 0 0 1 7.2 3H19v14.5H7.2A2.2 2.2 0 0 0 5 19.7"/><path d="M5 19.5A1.8 1.8 0 0 0 6.8 21.3H19V17.5"/><path d="M9.5 7.5h5.5"/>',
  compare:'<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M12 4v16"/><path d="M6.5 9h2.5M6.5 13h2.5M15 9h2.5M15 13h2.5"/>',
  clipboard:'<rect x="5" y="4.5" width="14" height="16.5" rx="2.2"/><path d="M9 4.5V3.6c0-.3.3-.6.6-.6h4.8c.3 0 .6.3.6.6v.9"/><path d="m8.8 13 2.2 2.2 4.2-4.4"/>',
  notebook:'<path d="M6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5z"/><path d="M4 7h3.5M4 12h3.5M4 17h3.5M11 8h5.5M11 12h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  flask:'<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  note:'<path d="M14 3H6.2A2.2 2.2 0 0 0 4 5.2v13.6A2.2 2.2 0 0 0 6.2 21h11.6a2.2 2.2 0 0 0 2.2-2.2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  notes:'<path d="M20.5 15a2 2 0 0 1-2 2H8l-4.5 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 8.5h8M8 12.5h5"/>',
  box:'<path d="M21 7.8 12 3 3 7.8v8.4L12 21l9-4.8z"/><path d="m3 7.8 9 4.8 9-4.8M12 12.6V21"/>',
  handover:'<path d="m17 3 4 4-4 4"/><path d="M21 7H9"/><path d="m7 21-4-4 4-4"/><path d="M3 17h12"/>',
  route:'<circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.4 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6.5 9.2 17.3 4 12.1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  spark:'<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2.2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  menu:'<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  file:'<path d="M14 3H6.2A2.2 2.2 0 0 0 4 5.2v13.6A2.2 2.2 0 0 0 6.2 21h11.6a2.2 2.2 0 0 0 2.2-2.2V9z"/><path d="M14 3v6h6"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5M12 16.6h.01"/>',
  differ:'<path d="M5 9h14M5 15h14M15.5 4.5l-7 15"/>',
  chevron:'<path d="m9.5 6 6 6-6 6"/>',
  down:'<path d="m6 9.5 6 6 6-6"/>',
  back:'<path d="m14.5 6-6 6 6 6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  external:'<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  download:'<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload:'<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  people:'<path d="M16 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.2a3.7 3.7 0 0 0-3.7 3.7v1.8"/><circle cx="9.2" cy="7.5" r="3.7"/><path d="M21.5 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.8 3.9a3.7 3.7 0 0 1 0 7.2"/>',
  monitor:'<rect x="3" y="4" width="18" height="12.5" rx="2.2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  play:'<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  more:'<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
};
export function Icon({name,className=''}:{name:string;className?:string}) {
  const path=icons[name];
  return <span className={'icon '+className} aria-hidden="true">{path?<svg viewBox="0 0 24 24" focusable="false" dangerouslySetInnerHTML={{__html:path}}/>:name}</span>;
}
export function Brand() { return <div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>FlyLabs<span className="brand-period">.</span></span></div>; }
export function Avatar({person,small=false}:{person?:Member;small?:boolean}) { return <span title={person?.name} className={'avatar '+(person?.color||'violet')+(small?' small':'')}>{person?.name.slice(-2)||'나'}</span>; }
export function Badge({status}:{status:Status}) { return <span className={'badge '+status}><span/>{STATUS[status]}</span>; }
export function Empty({title,description,action}:{title:string;description?:string;action?:ReactNode}) {return <div className="empty"><span className="empty-icon"><Icon name="flask"/></span><h3>{title}</h3>{description&&<p>{description}</p>}{action}</div>;}
export function Button({children,onClick,kind='primary',disabled=false,type='button',className=''}:{children:ReactNode;onClick?:()=>void;kind?:'primary'|'secondary'|'ghost'|'danger';disabled?:boolean;type?:'submit'|'button';className?:string}) {return <button type={type} className={'button '+kind+' '+className} onClick={onClick} disabled={disabled}>{children}</button>;}
export function Modal({title,description,children,onClose,wide=false}:{title:string;description?:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null); const id=useId(); const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement;
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    const modal=ref.current!;
    const focusable=()=>Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]'));
    const first=modal.querySelector<HTMLElement>('input,textarea,select')||focusable()[0];first?.focus();
    const handle=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();close.current();}
      if(e.key==='Tab'){const items=focusable();const current=document.activeElement;if(e.shiftKey&&current===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&current===items.at(-1)){e.preventDefault();items[0]?.focus();}}
    };
    document.addEventListener('keydown',handle);
    return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',handle);prior?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={'modal '+(wide?'wide':'')}><div className="modal-heading"><div><h2 id={id}>{title}</h2>{description&&<p>{description}</p>}</div><button className="icon-button" aria-label="닫기" onClick={onClose}><Icon name="close"/></button></div>{children}</div></div>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {
  const id=useId();
  return <div className="field"><label htmlFor={id}>{label}</label>{Children.map(children,child=>isValidElement(child)&&typeof child.type==='string'&&['input','select','textarea'].includes(child.type)?cloneElement(child as ReactElement<Record<string,unknown>>,{id,'aria-describedby':hint?id+'-hint':undefined}):child)}{hint&&<small id={id+'-hint'}>{hint}</small>}</div>;
}
export function SectionHeading({title,count,action}:{title:string;count?:number;action?:ReactNode}) {return <div className="section-heading"><h2>{title}{count!==undefined&&<span className="count">{count}</span>}</h2>{action}</div>;}
