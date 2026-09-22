import assert from 'node:assert';
import type { DayPlan, DayPlanItem } from '../src/models/dayPlan';
import {
  assignOwner,
  isTimeOverlap,
  removeMember,
  setAssistants,
  timeToMinutes,
} from '../src/utils/assignments';

let seq = 0;
function makeItem(partial: Partial<DayPlanItem> & Pick<DayPlanItem, 'start_time' | 'end_time'>): DayPlanItem {
  return {
    id: 'item-' + ++seq,
    spot_id: 'spot-' + seq,
    note: '',
    transport: 'metro',
    assistants: [],
    ...partial,
  };
}
function makeDay(tripId: string, dayIndex: number, items: DayPlanItem[]): DayPlan {
  return { id: 'day-' + ++seq, trip_id: tripId, day_index: dayIndex, date: '2026-10-01', items };
}

// 1. 时间工具
assert.equal(timeToMinutes('10:00'), 600);
assert.equal(timeToMinutes('25:00'), null);
assert.equal(timeToMinutes('10:70'), null);
const a = makeItem({ start_time: '10:00', end_time: '11:00' });
const b = makeItem({ start_time: '11:00', end_time: '12:00' });
const c = makeItem({ start_time: '10:30', end_time: '11:30' });
assert.equal(isTimeOverlap(a, b), false, '首尾相接不算重叠');
assert.equal(isTimeOverlap(a, c), true, '区间相交算重叠');

// 2. 同一负责人同天重叠负责项最多 1 项
{
  const i1 = makeItem({ start_time: '10:00', end_time: '11:00' });
  const i2 = makeItem({ start_time: '10:30', end_time: '11:30' });
  const i3 = makeItem({ start_time: '11:00', end_time: '12:00' });
  const plans = [makeDay('t1', 1, [i1, i2, i3])];
  const members = ['我', '阿明', '阿华'];
  assert.equal(assignOwner(plans, members, 't1', 1, i1.id, '阿明').ok, true);
  assert.equal(assignOwner(plans, members, 't1', 1, i2.id, '阿明').ok, false, '同天重叠，拒绝');
  assert.equal(assignOwner(plans, members, 't1', 1, i3.id, '阿明').ok, true, '首尾相接，允许');
  assert.equal(assignOwner(plans, members, 't1', 1, i2.id, '阿华').ok, true);
  // 不在名单
  assert.equal(assignOwner(plans, members, 't1', 1, i2.id, '路人甲').ok, false);
  // 协助人不受限制，且不能是负责人自己
  const res = setAssistants(plans, members, 't1', 1, i1.id, ['阿华', '阿华', '阿明']);
  assert.equal(res.ok, true);
  assert.deepEqual(i1.assistants, ['阿华'], '协助人去重并排除负责人');
}

// 3. 跨天不冲突
{
  const i1 = makeItem({ start_time: '10:00', end_time: '11:00' });
  const i2 = makeItem({ start_time: '10:00', end_time: '11:00' });
  const plans = [makeDay('t2', 1, [i1]), makeDay('t2', 2, [i2])];
  const members = ['我', '阿明'];
  assignOwner(plans, members, 't2', 1, i1.id, '阿明');
  assert.equal(assignOwner(plans, members, 't2', 2, i2.id, '阿明').ok, true, '不同天即使时间相同也允许');
}

// 4. 移除成员：可整批转交时成功
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '10:00', owner: '阿明' });
  const i2 = makeItem({ start_time: '15:00', end_time: '16:00', owner: '阿明' });
  const plans = [makeDay('t3', 1, [i1, i2])];
  const members = ['我', '阿明'];
  const result = removeMember(plans, members, 't3', '阿明');
  assert.equal(result.ok, true);
  assert.equal(result.transfers.length, 2);
  assert.equal(i1.owner, '我');
  assert.equal(i2.owner, '我');
}

// 5. 移除成员：两项互相重叠且只剩 1 名成员 → 整批拒绝，保持原样
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '11:00', owner: '阿明' });
  const i2 = makeItem({ start_time: '10:00', end_time: '12:00', owner: '阿明' });
  const plans = [makeDay('t4', 1, [i1, i2])];
  const members = ['我', '阿明'];
  const snapshot = JSON.parse(JSON.stringify(plans));
  const result = removeMember(plans, members, 't4', '阿明');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-receiver');
  assert.equal(i1.owner, '阿明', '拒绝后负责人不变');
  assert.equal(i2.owner, '阿明');
  assert.deepEqual(plans, snapshot, '拒绝后数据与操作前一致');
}

// 6. 移除成员：接收人已有同时间负责项 → 寻找其他接收人
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '10:00', owner: '阿明' });
  const i2 = makeItem({ start_time: '09:30', end_time: '10:30', owner: '阿华' });
  const plans = [makeDay('t5', 1, [i1, i2])];
  const members = ['我', '阿明', '阿华'];
  const result = removeMember(plans, members, 't5', '阿明');
  assert.equal(result.ok, true, '阿华同时间冲突，应转交给我');
  assert.equal(i1.owner, '我');
  assert.equal(i2.owner, '阿华');
}

// 7. 移除成员时同步从协助名单中清除
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '10:00', owner: '阿华', assistants: ['阿明'] });
  const plans = [makeDay('t6', 1, [i1])];
  const members = ['我', '阿明', '阿华'];
  const result = removeMember(plans, members, 't6', '阿明');
  assert.equal(result.ok, true);
  assert.deepEqual(i1.assistants, []);
}

// 8. 移除无负责项的成员：直接成功、零转移
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '10:00', owner: '阿华' });
  const plans = [makeDay('t7', 1, [i1])];
  const members = ['阿明', '阿华'];
  const result = removeMember(plans, members, 't7', '阿明');
  assert.equal(result.ok, true);
  assert.equal(result.transfers.length, 0);
  assert.equal(i1.owner, '阿华');
}

// 9. 三项重叠、只剩两人：其中一人原本有冲突 → 仍无法整批接收
{
  seq = 0;
  const i1 = makeItem({ start_time: '09:00', end_time: '12:00', owner: '阿明' });
  const i2 = makeItem({ start_time: '09:00', end_time: '12:00', owner: '阿明' });
  const i3 = makeItem({ start_time: '09:00', end_time: '12:00', owner: '阿华' });
  const plans = [makeDay('t8', 1, [i1, i2, i3])];
  const members = ['我', '阿明', '阿华'];
  const result = removeMember(plans, members, 't8', '阿明');
  assert.equal(result.ok, false, '阿华 09-12 已占用，我只能接一项，两项孤儿无法安置');
  assert.equal(i1.owner, '阿明');
  assert.equal(i2.owner, '阿明');
  assert.equal(i3.owner, '阿华');
}

console.log('all assignment tests passed');
