import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>({
  define:{__PUBLIC_DEMO__:JSON.stringify(mode==='demo')},
  resolve:mode==='demo'?{alias:{'node:crypto':fileURLToPath(new URL('./src/browser-crypto.mjs',import.meta.url))}}:{},
  plugins: [react(),...(mode==='demo'?[{name:'browser-evidence-graph',enforce:'pre' as const,transform(code:string,id:string){if(id.endsWith('/server/evidence.mjs'))return code.replace("import {readFileSync} from 'node:fs';",'').replace("export const graph=JSON.parse(readFileSync(new URL('../data/connectome.json',import.meta.url),'utf8'));","import graphData from '../data/connectome.json'; export const graph=graphData;");}}]:[])],
  server: { host: '127.0.0.1', port: 4210, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4211' } },
  build: { sourcemap: false }
}));
