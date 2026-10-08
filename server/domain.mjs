import { uid, stamp } from './seed.mjs';
import { notebookText } from './notebook.mjs';

export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const check = (condition, message, status = 400) => { if (!condition) throw new ApiError(message, status); };
export function textField(value, label, max = 300, required = true) {
  check(typeof value === 'string', label + ' 형식을 확인해 주세요.');
  const result = value.trim();
  check((!required || result.length > 0) && result.length <= max, label + '은(는) ' + (required ? '1~' : '0~') + max + '자여야 합니다.');
  return result;
}
export function enumField(value, allowed, label) { check(allowed.includes(value), label + ' 값이 올바르지 않습니다.'); return value; }
export function dateField(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), '날짜를 선택해 주세요.');
  const d = new Date(value + 'T12:00:00Z');
  check(!Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === value, '유효한 날짜를 선택해 주세요.');
  return value;
}
export function dateTime(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), '예약 시간을 확인해 주세요.');
  dateField(value.slice(0,10));
  check(Number(value.slice(11,13)) < 24 && Number(value.slice(14,16)) < 60, '예약 시간을 확인해 주세요.');
  return value;
}
export function entity(list, id, label) { const found = list.find(x => x.id === id); check(found, label + '을(를) 찾을 수 없습니다.', 404); return found; }
export const member = (w, id) => entity(w.members, id, '구성원');
export const experiment = (w, id) => entity(w.experiments, id, '실험');
export const statusLabels = { planned: '준비 중', running: '진행 중', blocked: '진행 보류', completed: '완료' };
export function audit(w, actorId, experimentId, action, detail) {
  w.audit.unshift({ id: uid(), actorId, experimentId, action, detail, createdAt: stamp() });
}
export function issuesFor(w, exp) {
  if (exp.status === 'completed') return [];
  const issues = [];
  for (const req of exp.requirements) {
    const r = w.resources.find(x => x.id === req.resourceId);
    if (!r) { issues.push({ kind: 'unknown', text: '연결된 자원 정보 없음', resourceId: req.resourceId }); continue; }
    if (r.status === 'unknown') issues.push({ kind: 'unknown', text: r.name + ' · 상태 미확인', resourceId: r.id });
    else if (r.status === 'maintenance') issues.push({ kind: 'blocker', text: r.name + ' · 점검 중', resourceId: r.id });
    else if (r.status === 'shortage' || (r.kind !== 'equipment' && r.quantity < req.amount)) issues.push({ kind: 'blocker', text: r.name + ' · 수량 부족', resourceId: r.id });
    if (r.kind === 'equipment' && !w.reservations.some(b => b.resourceId === r.id && b.experimentId === exp.id && b.start.slice(0,10) === exp.date)) {
      issues.push({ kind: 'unknown', text: r.name + ' · 예정일 예약 미확인', resourceId: r.id });
    }
  }
  return issues;
}
function requirements(w, items) {
  check(Array.isArray(items) && items.length <= 30, '필요 자원 목록을 확인해 주세요.');
  const seen = new Set();
  return items.map(x => {
    check(x && typeof x === 'object', '필요 자원 항목을 확인해 주세요.');
    entity(w.resources, x.resourceId, '자원');
    check(!seen.has(x.resourceId), '같은 자원이 중복되었습니다.'); seen.add(x.resourceId);
    check(Number.isFinite(x.amount) && x.amount > 0, '필요 수량은 0보다 커야 합니다.');
    return { resourceId: x.resourceId, amount: x.amount };
  });
}
function canComplete(w, e) {
  check(e.tasks.every(t => t.done), '준비 항목을 모두 확인한 뒤 완료해 주세요.');
  check(w.files.some(f => f.experimentId === e.id && f.kind === 'result'), '완료 전에 결과 파일을 연결해 주세요.');
}
export function applyAction(w, input) {
  check(input && typeof input === 'object', '작업 내용이 필요합니다.');
  const actor = member(w, input.actorId);
  const p = input.payload || {};
  let result = null;
  switch (input.type) {
    case 'experiment.create': {
      const title = textField(p.title, '실험명', 160);
      const tasks = textField(p.checklist || '', '준비 항목', 3000, false).split('\n').map(s=>s.trim()).filter(Boolean);
      check(tasks.length <= 40, '준비 항목은 40개까지 등록할 수 있습니다.');
      const e = { id: uid(), code: 'FL-' + String(w.experiments.length + 1).padStart(3,'0'), title, project: textField(p.project, '프로젝트', 80), ownerId: member(w, p.ownerId).id, date: dateField(p.date), priority: enumField(p.priority || 'normal', ['normal','high'], '우선순위'), status: 'planned', description: textField(p.description || '', '설명', 3000, false), protocol: textField(p.protocol || '', '실험 절차', 10000, false), requirements: requirements(w, p.requirements || []), tasks: tasks.map(title=>({ id: uid(), title, done: false })), createdAt: stamp(), updatedAt: stamp() };
      w.experiments.unshift(e); audit(w, actor.id, e.id, '실험 등록', e.title); result = e.id; break;
    }
    case 'experiment.update': {
      const e = experiment(w, p.id);
      if (p.expectedUpdatedAt) check(e.updatedAt === p.expectedUpdatedAt, '다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 확인해 주세요.', 409);
      if (p.status !== undefined) { enumField(p.status, Object.keys(statusLabels), '진행 상태'); if (p.status === 'completed') canComplete(w, e); e.status = p.status; }
      if (p.date !== undefined) e.date = dateField(p.date);
      if (p.ownerId !== undefined) e.ownerId = member(w, p.ownerId).id;
      if (p.title !== undefined) e.title = textField(p.title, '실험명', 160);
      if (p.description !== undefined) e.description = textField(p.description, '설명', 3000, false);
      if (p.protocol !== undefined) e.protocol = textField(p.protocol, '실험 절차', 10000, false);
      if (p.requirements !== undefined) e.requirements = requirements(w, p.requirements);
      e.updatedAt = stamp(e.updatedAt); audit(w, actor.id, e.id, '실험 변경', e.title + ' · ' + statusLabels[e.status]); break;
    }
    case 'task.toggle': {
      const e = experiment(w, p.experimentId);
      check(e.status !== 'completed', '완료된 실험은 진행 상태를 변경한 뒤 수정해 주세요.');
      const t = entity(e.tasks, p.id, '준비 항목');
      check(typeof p.done === 'boolean', '확인 상태가 올바르지 않습니다.');
      t.done = p.done; e.updatedAt = stamp(e.updatedAt);
      audit(w, actor.id, e.id, p.done ? '준비 확인' : '준비 확인 취소', t.title); break;
    }
    case 'task.add': {
      const e = experiment(w, p.experimentId);
      check(e.status !== 'completed', '완료된 실험은 진행 상태를 변경한 뒤 수정해 주세요.');
      check(e.tasks.length < 40, '준비 항목은 40개까지 등록할 수 있습니다.');
      e.tasks.push({ id: uid(), title: textField(p.title, '준비 항목', 200), done: false });
      e.updatedAt = stamp(e.updatedAt); audit(w, actor.id, e.id, '준비 항목 추가', p.title); break;
    }
    case 'resource.save': {
      const r = { id: p.id || uid(), name: textField(p.name, '자원명', 120), kind: enumField(p.kind, ['reagent','equipment','supply'], '자원 종류'), quantity: Number(p.quantity), unit: textField(p.unit, '단위', 30), location: textField(p.location || '', '보관 위치', 120, false), status: enumField(p.status, ['available','shortage','unknown','maintenance'], '자원 상태'), note: textField(p.note || '', '메모', 1000, false), updatedAt: stamp() };
      check(Number.isFinite(r.quantity) && r.quantity >= 0, '재고 수량은 0 이상이어야 합니다.');
      if (p.id) {
        const existing = entity(w.resources, p.id, '자원');
        const linked = w.experiments.some(e=>e.requirements.some(x=>x.resourceId === r.id)) || w.reservations.some(b=>b.resourceId === r.id);
        check(!linked || (existing.unit === r.unit && existing.kind === r.kind), '사용 중인 자원의 단위·종류는 변경할 수 없습니다. 새 자원을 등록해 주세요.');
        Object.assign(existing, r);
      } else w.resources.push(r);
      audit(w, actor.id, null, p.id ? '자원 상태 갱신' : '자원 등록', r.name + ' · ' + r.quantity + ' ' + r.unit); result = r.id; break;
    }
    case 'reservation.create': {
      const r = entity(w.resources, p.resourceId, '장비');
      check(r.kind === 'equipment', '장비만 예약할 수 있습니다.');
      check(r.status === 'available' && r.quantity >= 1, '장비 상태와 수량을 사용 가능으로 확인한 뒤 예약해 주세요.');
      const e = experiment(w, p.experimentId);
      const start = dateTime(p.start), end = dateTime(p.end);
      check(end > start, '종료 시간은 시작 시간보다 늦어야 합니다.');
      check(!w.reservations.some(b=>b.resourceId===r.id && start < b.end && end > b.start), '다른 예약과 시간이 겹칩니다. 다른 시간을 선택해 주세요.', 409);
      const b = { id: uid(), resourceId: r.id, experimentId: e.id, ownerId: member(w, p.ownerId).id, start, end };
      w.reservations.push(b); audit(w, actor.id, e.id, '장비 예약', r.name + ' · ' + start + ' ~ ' + end); result = b.id; break;
    }
    case 'reservation.remove': {
      const b = entity(w.reservations, p.id, '예약');
      w.reservations = w.reservations.filter(x=>x.id !== b.id);
      audit(w, actor.id, b.experimentId, '예약 취소', entity(w.resources, b.resourceId, '장비').name); break;
    }
    case 'note.review': {
      const n = entity(w.notes, p.id, '기록');
      check(n.review === 'pending', '이미 검토한 제안입니다.', 409);
      enumField(p.decision, ['apply','dismiss'], '검토 결과');
      if (p.decision === 'apply') {
        const e = experiment(w, n.experimentId);
        check(n.proposal && n.proposal.status, '반영할 변경안이 없습니다.');
        check(e.updatedAt === n.expectedUpdatedAt, '실험 상태가 변경되어 제안이 오래되었습니다. 제안을 제외하고 새 기록으로 다시 확인해 주세요.', 409);
        if (n.proposal.status === 'completed') canComplete(w, e);
        e.status = n.proposal.status; e.updatedAt = stamp(e.updatedAt); n.review = 'applied';
      } else n.review = 'dismissed';
      audit(w, actor.id, n.experimentId, p.decision === 'apply' ? '변경안 반영' : '변경안 제외', n.text.slice(0,160)); break;
    }
    case 'member.add': {
      const m = { id: uid(), name: textField(p.name, '이름', 60), role: textField(p.role || '연구원', '역할', 40), color: ['violet','blue','rose','teal'][w.members.length%4] };
      w.members.push(m); audit(w, actor.id, null, '구성원 등록', m.name); result = m.id; break;
    }
    default: throw new ApiError('지원하지 않는 작업입니다.');
  }
  return result;
}
export function handover(w, ids = [], from = '', to = '') {
  if (from) dateField(from); if (to) dateField(to);
  check(!from || !to || from <= to, '조회 기간을 확인해 주세요.');
  const es = w.experiments.filter(e=>(!ids.length || ids.includes(e.id)) && (!from || e.date >= from) && (!to || e.date <= to));
  const lines = ['# ' + w.name + ' · 인수인계', '', '작성 시각: ' + stamp(), '유형: 기록 기반 초안 · 실제 입력된 기록만 사용', '기간 기준: 실험 예정일' + (from || to ? ' (' + (from || '전체') + ' ~ ' + (to || '전체') + ')' : ' (전체)'), '공간 ID: ' + w.id, ''];
  if (!es.length) lines.push('선택한 조건에 해당하는 실험이 없습니다.');
  for (const e of es) {
    lines.push('## ' + e.code + ' · ' + e.title, '', '- 프로젝트: ' + e.project, '- 담당자: ' + member(w,e.ownerId).name, '- 예정일: ' + e.date, '- 상태: ' + statusLabels[e.status], '- 실험 ID: ' + e.id, '', '### 확인할 준비 항목', '');
    for (const t of e.tasks) lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.title);
    if (!e.tasks.length) lines.push('등록된 준비 항목 없음');
    lines.push('', '### 자원과 예약 확인', '');
    const issues = issuesFor(w,e); lines.push(...(issues.length ? issues.map(i=>'- ' + i.text) : ['등록된 자원에 대한 확인 이슈 없음 · 미등록 조건은 평가하지 않음']));
    lines.push('', '### 진행 기록', '');
    const notes = w.notes.filter(n=>n.experimentId === e.id);
    for (const n of notes) lines.push('- ' + n.createdAt + ' / ' + member(w,n.authorId).name + ' / 원문 기록 ' + n.id, '  ' + n.text.replace(/\n/g,'\n  '), '  검토 상태: ' + ({pending:'확인 대기',applied:'반영됨',dismissed:'제외됨',none:'기록만 저장'}[n.review]));
    if (!notes.length) lines.push('등록된 기록 없음');
    lines.push('', '### 연결 파일', '');
    const files = w.files.filter(f=>f.experimentId===e.id);
    for (const f of files) lines.push('- ' + f.name + ' (' + f.size + ' bytes, ' + f.kind + ') · 파일 ID: ' + f.id + ' · SHA-256: ' + f.sha256);
    if (!files.length) lines.push('연결된 파일 없음');
    lines.push('', '### 사용한 실험 절차 / 메모', '', e.protocol || '등록된 절차 없음', '');
    if(e.notebook)lines.push('### 랩노트 원문 (리비전 '+e.notebook.revision+')','',notebookText(w,e).text,'');
  }
  return { text: lines.join('\n'), count: es.length, generatedAt: stamp() };
}
