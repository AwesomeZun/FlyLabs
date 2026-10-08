import { createContext, useContext } from 'react';
import type { Health, Workspace,User } from './types';
export type Dialog = { type:'experiment'|'note'|'resource'|'reservation'|'workspace'|'member'; experimentId?:string;resourceId?:string };
export type LabContextValue = {
  w:Workspace;health:Health;actorId:string;busy:boolean;user:User;canEdit:boolean;logout:()=>Promise<void>;
  act:(type:string,payload:Record<string,unknown>)=>Promise<string|null>;
  post:(path:string,payload:Record<string,unknown>)=>Promise<void>;
  notify:(text:string,error?:boolean)=>void;
  open:(dialog:Dialog)=>void;
  go:(view:string,id?:string)=>void;
  refresh:()=>Promise<void>;
  changeWorkspace:(id:string)=>void;
};
export const LabContext=createContext<LabContextValue|null>(null);
export function useLab(){const c=useContext(LabContext);if(!c)throw new Error('Missing workspace');return c;}
