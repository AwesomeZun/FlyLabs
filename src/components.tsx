import { useEffect, useRef, useId, Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import type { Member, Status } from './types';
import { STATUS } from './types';

const icons:Record<string,string>={home:'◫',flask:'♧',note:'▤',box:'▦',handover:'⇄',settings:'⚙',search:'⌕',plus:'＋',close:'×',check:'✓',clock:'◷',spark:'✦',calendar:'▣',menu:'☰',file:'▧',alert:'!',chevron:'›',back:'‹',download:'↓',people:'◎',more:'···'};
export function Icon({name,className=''}:{name:string;className?:string}) { return <span className={'icon '+className} aria-hidden="true">{icons[name]||name}</span>; }
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
