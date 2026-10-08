import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { seedWorkspace } from './seed.mjs';
import { ApiError } from './domain.mjs';

export function openStore(dataDir, seed = true) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'flylabs.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);');
  const insert = w => db.prepare('INSERT INTO workspaces(id,name,state,revision) VALUES(?,?,?,0)').run(w.id,w.name,JSON.stringify(w));
  if (seed && Number(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n) === 0) { insert(seedWorkspace('academic')); insert(seedWorkspace('biotech')); }
  const load = id => {
    const row = db.prepare('SELECT state,revision FROM workspaces WHERE id=?').get(id);
    if (!row) throw new ApiError('연구실 공간을 찾을 수 없습니다.',404);
    return { ...JSON.parse(row.state), revision: row.revision };
  };
  return {
    db,
    list: () => db.prepare('SELECT id,name,state FROM workspaces ORDER BY rowid').all().map(r=>{ const w=JSON.parse(r.state); return { id:r.id,name:r.name,kind:w.kind,demo:w.demo,hasEvidence:!!w.evidence?.projects?.length }; }),
    load, insert,
    update(id, fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const w=load(id); const result=fn(w);
        w.revision++;
        db.prepare('UPDATE workspaces SET name=?,state=?,revision=? WHERE id=?').run(w.name,JSON.stringify(w),w.revision,id);
        db.exec('COMMIT'); return { workspace:w,result };
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}
