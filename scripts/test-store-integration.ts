// 集成测试：在 Node 中模拟 localStorage，验证 store 层原子移除与刷新一致性
import assert from 'node:assert';
import { createPinia, setActivePinia } from 'pinia';
import { useTripStore } from '../src/stores/tripStore';
import { useDayPlanStore } from '../src/stores/dayPlanStore';
import { STORAGE_KEYS } from '../src/constants/storageVersion';

// ---- 浏览器环境垫片 ----
const memory = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
(globalThis as any).indexedDB = {};

function freshPinia() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

// 初始数据：旅行 t1，成员 [我, 阿明, 阿华]；阿明负责两个互相重叠项
const members = ['我', '阿明', '阿华'];
memory.set(STORAGE_KEYS.trips, JSON.stringify({
  version: 'tripweaver-v1',
  data: [{
    id: 't1', title: '测试旅行', destination: '杭州',
    start_date: '2026-10-01', end_date: '2026-10-02',
    budget: 1000, currency: 'CNY', members,
    status: 'planning', created_at: new Date().toISOString(),
  }],
  updatedAt: new Date().toISOString(),
}));
// 旧形态数据（无 id / 无 assistants 字段），验证归一化
memory.set(STORAGE_KEYS.dayPlans, JSON.stringify({
  version: 'tripweaver-v1',
  data: [{
    id: 'd1', trip_id: 't1', day_index: 1, date: '2026-10-01',
    items: [
      { spot_id: 's1', start_time: '09:00', end_time: '12:00', note: '', transport: 'metro', owner: '阿明' },
      { spot_id: 's2', start_time: '09:30', end_time: '10:30', note: '', transport: 'walk', owner: '阿华' },
      { spot_id: 's3', start_time: '13:00', end_time: '14:00', note: '', transport: 'taxi', owner: '阿明', assistants: ['阿华'] },
    ],
  }],
  updatedAt: new Date().toISOString(),
}));
memory.set(STORAGE_KEYS.spots, JSON.stringify({ version: 'tripweaver-v1', data: [], updatedAt: '' }));

freshPinia();
const tripStore = useTripStore();
const dayPlanStore = useDayPlanStore();

const day = dayPlanStore.dayPlans.find((plan) => plan.id === 'd1')!;
assert.equal(day.items.length, 3);
for (const item of day.items) {
  assert.ok(item.id, '旧数据补齐 item.id');
  assert.deepEqual(Array.isArray(item.assistants), true);
}

// 场景 A：移除阿明 —— 两项 (09-12 与 13-14) 均可转给“我”（13-14 不与任何项冲突，09-12 不与阿华的 09:30-10:30 冲突）
assert.equal(tripStore.removeMember('t1', '阿明'), true);
const tripAfter = tripStore.getTrip('t1')!;
assert.deepEqual(tripAfter.members, ['我', '阿华'], '成员已移除');
const [i1, i2, i3] = day.items;
assert.equal(i1.owner, '我');
assert.equal(i2.owner, '阿华');
assert.equal(i3.owner, '我');
assert.deepEqual(i3.assistants, ['阿华']);

// “刷新”：重建 pinia，store 从 localStorage 重新读盘
freshPinia();
const tripStore2 = useTripStore();
const dayPlanStore2 = useDayPlanStore();
assert.deepEqual(tripStore2.getTrip('t1')!.members, ['我', '阿华'], '刷新后成员一致');
const reloaded = dayPlanStore2.dayPlans.find((plan) => plan.id === 'd1')!.items;
assert.equal(reloaded[0].owner, '我');
assert.equal(reloaded[2].owner, '我', '刷新后分工一致');

// 场景 B：制造无法整批接收的局面 —— 我和阿华在 09-12 各已有一项，再让阿明背两项重叠
const t2id = tripStore2.createTrip('冲突旅行');
const t2 = tripStore2.getTrip(t2id)!;
assert.ok(tripStore2.addMember(t2id, '阿明'));
assert.ok(tripStore2.addMember(t2id, '阿华'));
// t2 默认成员 [我, 朋友] + 阿明 + 阿华
dayPlanStore2.addSpot(t2id, 's1', 1); // 默认 10:00-12:00
dayPlanStore2.addSpot(t2id, 's2', 1);
dayPlanStore2.addSpot(t2id, 's3', 1);
dayPlanStore2.addSpot(t2id, 's4', 1);
const d2 = dayPlanStore2.dayPlans.find((plan) => plan.trip_id === t2id && plan.day_index === 1)!;
const [j1, j2, j3, j4] = d2.items;
// 四项都默认 10:00-12:00，互相重叠。我负责 j1，朋友负责 j2，阿华负责 j3，阿明负责 j4
dayPlanStore2.setOwner(t2id, 1, j1.id, '我', t2.members);
dayPlanStore2.setOwner(t2id, 1, j2.id, '朋友', t2.members);
dayPlanStore2.setOwner(t2id, 1, j3.id, '阿华', t2.members);
dayPlanStore2.setOwner(t2id, 1, j4.id, '阿明', t2.members);

// 现在让阿明再多背一项：先把 j2（朋友 10-12）改给阿明应被拒绝（冲突）
assert.equal(dayPlanStore2.setOwner(t2id, 1, j2.id, '阿明', t2.members).ok, false, '同时间重叠不能指派给阿明');
assert.equal(j2.owner, '朋友', '被拒后负责人保持原样');

// 移除阿明：j4 需转交给“我/朋友/阿华”之外…… 实际上其他三人 10-12 全被占用 → 无接收人 → 整批拒绝
const beforeMembers = [...t2.members];
assert.equal(tripStore2.removeMember(t2id, '阿明'), false);
assert.deepEqual(tripStore2.getTrip(t2id)!.members, beforeMembers, '成员保持原样');
assert.equal(j4.owner, '阿明', '分工保持原样');

// 场景 C：协助人不受时间重叠限制
assert.equal(
  dayPlanStore2.setAssistants(t2id, 1, j4.id, ['我', '朋友', '阿华'], t2.members).ok,
  true,
  '协助人即使全部时间重叠也允许',
);

console.log('store integration tests passed');
