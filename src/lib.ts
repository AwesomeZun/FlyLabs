export class APIError extends Error {constructor(message:string,public status:number){super(message);}}
export async function api<T>(url:string, options:RequestInit = {}):Promise<T> {
  if(__PUBLIC_DEMO__){try{return await (await import('./demo-api.mjs')).demoApi(url,options) as T;}catch(e){const err=e as Error&{status?:number};throw new APIError(err.message,err.status||400);}}
  const res = await fetch('/api'+url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data = await res.json();
  if(!res.ok) throw new APIError(data.error || '요청에 실패했습니다.',res.status);
  return data;
}
export const send = <T,>(url:string,data:unknown) => api<T>(url,{method:'POST',body:JSON.stringify(data)});
export function today() { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
export function prettyDate(value:string, full=false) { return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',...(full?{weekday:'long' as const}:{})}).format(new Date(value.length===10?value+'T12:00:00':value)); }
export function shortTime(value:string) { return new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}); }
export function sizeLabel(n:number) { return n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(1)+' MB'; }
export function download(name:string,text:string,type='text/plain;charset=utf-8') { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export async function base64(file:File):Promise<string> { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));r.readAsDataURL(file);}); }
export function stored(key:string,fallback='') { try{return localStorage.getItem(key)||fallback;}catch{return fallback;} }
export function storePreference(key:string,value:string) { try{localStorage.setItem(key,value);}catch{/* Device preferences are optional; research data are saved on server. */} }
