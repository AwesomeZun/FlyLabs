import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,copyFile,chmod,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fresh(dir){try{await stat(dir);throw new Error('Destination already exists; use a new directory.');}catch(e){if(e.code!=='ENOENT')throw e;}await mkdir(dir,{recursive:true,mode:0o700});await mkdir(path.join(dir,'uploads'),{mode:0o700});}
function filesFrom(db){const files=[];for(const row of db.prepare('SELECT state FROM workspaces').all())for(const f of JSON.parse(row.state).files||[]){if(!/^[a-f0-9-]+\.bin$/.test(f.storedName))throw new Error('Invalid attachment path in database.');files.push(f);}return files;}
export async function snapshot(source,destination){
 await fresh(destination);const db=new DatabaseSync(path.join(source,'flylabs.sqlite'),{readOnly:true});
 try{await backup(db,path.join(destination,'flylabs.sqlite'));}finally{db.close();}
 const copy=new DatabaseSync(path.join(destination,'flylabs.sqlite'));let files;
 try{if(copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get())copy.exec('DELETE FROM sessions');files=filesFrom(copy);}finally{copy.close();}
 for(const f of files){const bytes=await readFile(path.join(source,'uploads',f.storedName));if(hash(bytes)!==f.sha256)throw new Error('Attachment checksum mismatch.');await writeFile(path.join(destination,'uploads',f.storedName),bytes,{mode:0o600,flag:'wx'});}
 await chmod(path.join(destination,'flylabs.sqlite'),0o600);
 const manifest={schema:'flylabs-full-backup-v2',createdAt:new Date().toISOString(),databaseSha256:hash(await readFile(path.join(destination,'flylabs.sqlite'))),files:files.map(f=>({storedName:f.storedName,sha256:f.sha256,size:f.size})),sessionsRemoved:true};
 await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});await verifySnapshot(destination);return {files:files.length,destination};
}
export async function verifySnapshot(source){
 const m=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));if(m.schema!=='flylabs-full-backup-v2'||!Array.isArray(m.files))throw new Error('Unsupported backup.');
 if(hash(await readFile(path.join(source,'flylabs.sqlite')))!==m.databaseSha256)throw new Error('Database checksum mismatch.');
 const db=new DatabaseSync(path.join(source,'flylabs.sqlite'),{readOnly:true});let files;try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity check failed.');files=filesFrom(db);}finally{db.close();}
 if(files.length!==m.files.length)throw new Error('Attachment manifest mismatch.');
 for(const f of files){const entry=m.files.find(x=>x.storedName===f.storedName);if(!entry||entry.sha256!==f.sha256||entry.size!==f.size)throw new Error('Attachment metadata mismatch.');const bytes=await readFile(path.join(source,'uploads',f.storedName));if(hash(bytes)!==f.sha256||bytes.length!==f.size)throw new Error('Attachment checksum mismatch.');}return {files:files.length,verified:true};
}
export async function restoreSnapshot(source,destination){await verifySnapshot(source);await fresh(destination);await copyFile(path.join(source,'flylabs.sqlite'),path.join(destination,'flylabs.sqlite'));await chmod(path.join(destination,'flylabs.sqlite'),0o600);const m=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));for(const f of m.files){await copyFile(path.join(source,'uploads',f.storedName),path.join(destination,'uploads',f.storedName));await chmod(path.join(destination,'uploads',f.storedName),0o600);}return {files:m.files.length,destination};}
