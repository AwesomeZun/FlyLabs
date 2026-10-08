import path from 'node:path';import {fileURLToPath} from 'node:url';
import {snapshot,verifySnapshot,restoreSnapshot} from '../server/backup.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [command='backup',source,destination]=process.argv.slice(2);
try{
 if(command==='backup'){const out=source||path.join(root,'backups','flylabs-v3.0.0-'+new Date().toISOString().replace(/[:.]/g,'-'));console.log(JSON.stringify(await snapshot(process.env.FLYLABS_DATA_DIR||path.join(root,'.data'),path.resolve(out))));}
 else if(command==='verify'&&source)console.log(JSON.stringify(await verifySnapshot(path.resolve(source))));
 else if(command==='restore'&&source&&destination)console.log(JSON.stringify(await restoreSnapshot(path.resolve(source),path.resolve(destination))));
 else throw new Error('Usage: backup.mjs backup [new-directory] | verify directory | restore backup-directory new-data-directory');
}catch(e){console.error(e.message);process.exitCode=1;}
