import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { check, textField, enumField, audit } from './domain.mjs';
import { uid, stamp, emptyWorkspace } from './seed.mjs';
const scrypt=promisify(scryptCallback);
const digest=value=>createHash('sha256').update(value).digest('hex');
const publicUser=u=>({id:u.id,name:u.name,email:u.email});
export function createAuth(store) {
  const db=store.db;
  db.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS invitations(token_hash TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);');
  const email=value=>{const e=textField(value,'이메일',200).toLowerCase();check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),'이메일 주소를 확인해 주세요.');return e;};
  const password=value=>{check(typeof value==='string'&&value.length>=12&&value.length<=200,'비밀번호는 12~200자로 입력해 주세요.');return value;};
  function session(user) {
    const token=randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+7*86400000);
    return {user:publicUser(user),token};
  }
  function permission(w,user,write=false) {
    const a=w.access?.find(a=>a.userId===user.id);
    check(a,'이 연구실에 접근할 권한이 없습니다.',403);
    if(write)check(a.role!=='viewer','열람 권한으로는 기록을 수정할 수 없습니다.',403);
    return a;
  }
  function grant(w,user,role) {
    if(w.access?.some(a=>a.userId===user.id))return;
    w.access ||= [];
    const m={id:uid(),name:user.name,role:role==='owner'?'연구실 관리자':'연구원',color:['violet','blue','rose','teal'][w.members.length%4],userId:user.id};
    w.members.push(m);w.access.push({userId:user.id,memberId:m.id,role});
  }
  function provision(user,first) {
    if(first)for(const summary of store.list()){
      const w=store.load(summary.id);
      if(!w.access?.length)store.update(w.id,current=>grant(current,user,'owner'));
    }
    const w=emptyWorkspace(user.name+'의 연구실','academic',user.name);
    w.members=[];grant(w,user,'owner');store.insert(w);
  }
  function accept(user,token) {
    check(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token),'초대 링크를 확인해 주세요.',400);
    const i=db.prepare('SELECT * FROM invitations WHERE token_hash=?').get(digest(token));
    check(i&&!i.used&&i.expires_at>Date.now(),'초대가 만료되었거나 이미 사용되었습니다.',410);
    check(i.email===user.email,'초대받은 이메일 계정으로 로그인해 주세요.',403);
    store.update(i.workspace_id,w=>{grant(w,user,i.role);const a=permission(w,user);audit(w,a.memberId,null,'구성원 참여',user.name);db.prepare('UPDATE invitations SET used=1 WHERE token_hash=?').run(digest(token));});
    return i.workspace_id;
  }
  return {
    permission,grant,accept,
    getUser(req) {
      const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('flylabs_v3_session='))?.slice(19);
      if(!token)return null;
      const u=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now());
      return u?publicUser(u):null;
    },
    async register(p) {
      const e=email(p.email),name=textField(p.name,'이름',60),pass=password(p.password);
      check(!db.prepare('SELECT id FROM users WHERE email=?').get(e),'등록할 수 없는 이메일입니다. 로그인하거나 다른 이메일을 사용해 주세요.',409);
      const salt=randomBytes(16).toString('hex'),hash=(await scrypt(pass,salt,64)).toString('hex');
      const user={id:uid(),name,email:e};
      // Re-check after asynchronous password hashing.
      check(!db.prepare('SELECT id FROM users WHERE email=?').get(e),'등록할 수 없는 이메일입니다.',409);
      const first=Number(db.prepare('SELECT COUNT(*) n FROM users').get().n)===0;
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user.id,e,name,hash,salt);
      provision(user,first);
      return session(user);
    },
    async login(p) {
      const e=email(p.email),pass=typeof p.password==='string'?p.password:'';
      check(pass.length<=200,'이메일 또는 비밀번호를 확인해 주세요.',401);
      const u=db.prepare('SELECT * FROM users WHERE email=?').get(e);
      const candidate=await scrypt(pass,u?.salt||'constant-invalid-user-salt',64);
      check(u&&timingSafeEqual(candidate,Buffer.from(u.password_hash,'hex')),'이메일 또는 비밀번호를 확인해 주세요.',401);
      return session(u);
    },
    logout(req) {
      const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('flylabs_v3_session='))?.slice(19);
      if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
    },
    async changePassword(user,p){
      const u=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      check(typeof p.currentPassword==='string'&&p.currentPassword.length<=200,'현재 비밀번호를 확인해 주세요.',400);
      const old=await scrypt(p.currentPassword,u.salt,64);
      check(timingSafeEqual(old,Buffer.from(u.password_hash,'hex')),'현재 비밀번호를 확인해 주세요.',403);
      const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password(p.password),salt,64)).toString('hex');
      db.prepare('UPDATE users SET password_hash=?,salt=? WHERE id=?').run(hash,salt,user.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      return session(user);
    },
    invite(w,user,p) {
      const a=permission(w,user);check(a.role==='owner','관리자만 초대할 수 있습니다.',403);
      const role=enumField(p.role,['editor','viewer'],'초대 권한'),e=email(p.email),token=randomBytes(32).toString('hex');
      const expiresAt=Date.now()+7*86400000;
      db.prepare('INSERT INTO invitations VALUES(?,?,?,?,?,0)').run(digest(token),w.id,e,role,expiresAt);
      store.update(w.id,current=>audit(current,a.memberId,null,'초대 생성',e+' · '+role));
      return {token,expiresAt,email:e,role};
    },
    invitations(w,user){
      check(permission(w,user).role==='owner','관리자만 초대를 관리할 수 있습니다.',403);
      return db.prepare('SELECT token_hash AS id,email,role,expires_at AS expiresAt FROM invitations WHERE workspace_id=? AND used=0 AND expires_at>? ORDER BY expires_at DESC').all(w.id,Date.now());
    },
    revoke(w,user,id){
      const a=permission(w,user);check(a.role==='owner','관리자만 초대를 취소할 수 있습니다.',403);
      const found=db.prepare('SELECT token_hash FROM invitations WHERE workspace_id=? AND token_hash=?').get(w.id,id);
      check(found,'초대를 찾을 수 없습니다.',404);
      store.update(w.id,current=>{db.prepare('UPDATE invitations SET used=1 WHERE token_hash=?').run(id);audit(current,a.memberId,null,'초대 취소','미사용 초대 링크 취소');});
    },
    changeRole(w,user,p) {
      check(permission(w,user).role==='owner','관리자만 권한을 변경할 수 있습니다.',403);
      const target=w.access.find(a=>a.userId===p.userId);
      check(target&&target.role!=='owner','관리자 계정은 여기에서 변경할 수 없습니다.');
      const role=enumField(p.role,['editor','viewer','remove'],'권한');
      store.update(w.id,current=>{
        if(role==='remove')current.access=current.access.filter(a=>a.userId!==p.userId);
        else current.access.find(a=>a.userId===p.userId).role=role;
        audit(current,permission(current,user).memberId,null,'접근 권한 변경',role);
      });
    }
  };
}
