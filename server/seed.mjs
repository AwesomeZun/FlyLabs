import { randomUUID } from 'node:crypto';
export const uid = () => randomUUID();
export const stamp = (previous = '') => new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
export function day(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function emptyWorkspace(name, kind = 'academic', owner = '연구원') {
  return { id: uid(), name, kind, demo: false, members: [{ id: uid(), name: owner, role: '연구원', color: 'violet' }], experiments: [], resources: [], reservations: [], notes: [], files: [], audit: [], revision: 0 };
}
export function seedWorkspace(kind) {
  const biotech = kind === 'biotech';
  const w = emptyWorkspace(biotech ? 'Helix Bio R&D' : 'Neurobiology Lab', kind, biotech ? '박지우' : '김서연');
  w.demo = true;
  w.members.push({ id: uid(), name: biotech ? '이도현' : '이준호', role: '연구원', color: 'blue' }, { id: uid(), name: biotech ? '최유진' : '박민지', role: '랩 매니저', color: 'rose' });
  const time = stamp();
  w.resources = [
    { id: uid(), name: 'Anti-Synapsin 항체', kind: 'reagent', quantity: 0, unit: 'vial', location: '냉동고 A · 선반 2', status: 'shortage', note: '입고일 확인 필요', updatedAt: time },
    { id: uid(), name: 'Confocal microscope', kind: 'equipment', quantity: 1, unit: '대', location: '공용장비실 302', status: 'available', note: '사용 후 렌즈 정리', updatedAt: time },
    { id: uid(), name: 'qPCR master mix', kind: 'reagent', quantity: 3, unit: 'tube', location: '냉동고 B · Box 04', status: 'available', note: '재고 직접 확인', updatedAt: time },
    { id: uid(), name: '96-well plate', kind: 'supply', quantity: 12, unit: '개', location: '시약장 C · 1단', status: 'available', note: '', updatedAt: time },
    { id: uid(), name: 'qPCR system', kind: 'equipment', quantity: 1, unit: '대', location: '분자생물학실 204', status: 'available', note: '', updatedAt: time },
    { id: uid(), name: 'RNA extraction kit', kind: 'reagent', quantity: 1, unit: 'kit', location: '시약장 B', status: 'unknown', note: '잔량 확인 필요', updatedAt: time },
  ];
  const create = (i, title, project, status, offset, refs, tasks) => ({ id: uid(), code: `FL-${String(i+1).padStart(3,'0')}`, title, project, ownerId: w.members[i%3].id, date: day(offset), priority: i === 0 ? 'high' : 'normal', status, description: '기능을 살펴보기 위한 예시 실험입니다. 실제 실험 조건이나 결과가 아닙니다.', protocol: '연구실에서 승인한 절차를 확인하고 진행합니다.', requirements: refs.map(([n, amount]) => ({ resourceId: w.resources[n].id, amount })), tasks: tasks.map(([title, done]) => ({ id: uid(), title, done })), createdAt: time, updatedAt: time });
  w.experiments = [
    create(0, biotech ? '오가노이드 배치 B · 면역염색 이미지 확보' : '신경세포 면역염색 · 시냅스 이미지 확보', biotech ? 'Organoid platform' : 'Synaptic plasticity', 'blocked', 0, [[0,1],[1,1]], [['시료 8개 식별번호 확인',true],['항체 입고 확인',false],['현미경 예약 확인',true]]),
    create(1, '처리군·대조군 유전자 발현 비교', biotech ? 'Assay development' : 'Gene expression', 'running', 0, [[2,1],[3,2],[4,1]], [['시료 및 대조군 목록 확인',true],['배치표 준비',true],['결과 파일 연결',false]]),
    create(2, 'RNA 추출 · 다음 실험 시료 준비', biotech ? 'Assay development' : 'Gene expression', 'planned', 1, [[5,1]], [['시료 보관 위치 확인',true],['키트 잔량 확인',false]]),
    create(3, '이미지 분석 · 시냅스 밀도 정량', biotech ? 'Organoid platform' : 'Synaptic plasticity', 'planned', 2, [], [['원본 이미지 위치 확인',false],['분석 설정과 코드 버전 기록',false]]),
  ];
  w.reservations = [
    { id: uid(), resourceId: w.resources[4].id, experimentId: w.experiments[1].id, ownerId: w.members[1].id, start: `${day()}T09:30`, end: `${day()}T11:00` },
    { id: uid(), resourceId: w.resources[1].id, experimentId: w.experiments[0].id, ownerId: w.members[0].id, start: `${day()}T14:00`, end: `${day()}T16:00` },
  ];
  w.notes = [{ id: uid(), experimentId: w.experiments[0].id, text: '항체가 아직 도착하지 않아 촬영 준비를 보류했습니다. 입고 예정일 확인이 필요합니다.', authorId: w.members[0].id, createdAt: time, source: 'manual', category: 'material_wait', review: 'none', proposal: null }];
  w.audit = [{ id: uid(), experimentId: null, actorId: w.members[0].id, action: '예시 공간 생성', detail: '표시된 실험·시료·멤버는 모두 예시 데이터입니다.', createdAt: time }];
  return w;
}
