import type { DayPlan, DayPlanItem } from '../models/dayPlan';

/** 把 'HH:MM' 转成分钟数；非法时间返回 null */
export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 半开区间重叠判定：首尾相接（如 10:00-11:00 与 11:00-12:00）不算重叠 */
export function isTimeOverlap(a: DayPlanItem, b: DayPlanItem): boolean {
  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  if (aStart >= aEnd || bStart >= bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** 同一行程内的同一天（day_index 相同即同一天） */
function sameDay(day: DayPlan, tripId: string, dayIndex: number) {
  return day.trip_id === tripId && day.day_index === dayIndex;
}

export interface ConflictInfo {
  dayIndex: number;
  itemId: string;
  spotId: string;
}

/**
 * 检查 owner 在同一天是否已有时间重叠的负责项。
 * 排除自身（itemId），忽略 owner 为空的日程项。
 */
export function findOwnerConflict(
  dayPlans: DayPlan[],
  tripId: string,
  dayIndex: number,
  itemId: string,
  owner: string,
): ConflictInfo | null {
  for (const day of dayPlans) {
    if (!sameDay(day, tripId, dayIndex)) continue;
    for (const other of day.items) {
      if (other.id === itemId || other.owner !== owner) continue;
      const current = day.items.find((item) => item.id === itemId);
      if (current && isTimeOverlap(current, other)) {
        return { dayIndex: day.day_index, itemId: other.id, spotId: other.spot_id };
      }
    }
  }
  return null;
}

export type AssignResult =
  | { ok: true }
  | { ok: false; reason: 'not-member' | 'conflict'; conflict?: ConflictInfo };

/**
 * 设置某个日程项的负责人。
 * 规则：负责人必须仍在同行名单中；同一负责人同一天时间重叠的日程项最多 1 项。
 * 传空字符串表示清空负责人。
 */
export function assignOwner(
  dayPlans: DayPlan[],
  members: string[],
  tripId: string,
  dayIndex: number,
  itemId: string,
  owner: string,
): AssignResult {
  const day = dayPlans.find((plan) => sameDay(plan, tripId, dayIndex));
  const item = day?.items.find((entry) => entry.id === itemId);
  if (!day || !item) return { ok: false, reason: 'not-member' };
  if (!owner) {
    item.owner = undefined;
    item.assistants = sanitizeAssistants(item.assistants, members, undefined);
    return { ok: true };
  }
  if (!members.includes(owner)) return { ok: false, reason: 'not-member' };
  const conflict = findOwnerConflict(dayPlans, tripId, dayIndex, itemId, owner);
  if (conflict) return { ok: false, reason: 'conflict', conflict };
  item.owner = owner;
  item.assistants = sanitizeAssistants(item.assistants, members, owner);
  return { ok: true };
}

/** 协助人过滤：必须在名单内、去重、不能与负责人重复 */
export function sanitizeAssistants(assistants: string[], members: string[], owner?: string): string[] {
  return [...new Set(assistants)].filter((name) => members.includes(name) && name !== owner);
}

/** 设置协助人（协助不受时间重叠限制） */
export function setAssistants(
  dayPlans: DayPlan[],
  members: string[],
  tripId: string,
  dayIndex: number,
  itemId: string,
  assistants: string[],
): AssignResult {
  const day = dayPlans.find((plan) => sameDay(plan, tripId, dayIndex));
  const item = day?.items.find((entry) => entry.id === itemId);
  if (!day || !item) return { ok: false, reason: 'not-member' };
  if (assistants.some((name) => !members.includes(name))) return { ok: false, reason: 'not-member' };
  item.assistants = sanitizeAssistants(assistants, members, item.owner);
  return { ok: true };
}

interface OrphanItem {
  day: DayPlan;
  item: DayPlanItem;
}

/** 成员在某次转移方案中临时承接的日程项（用于模拟整批分配） */
type TentativePlan = Map<string, DayPlanItem[]>;

export interface RemoveMemberResult {
  ok: boolean;
  reason?: 'not-member' | 'no-receiver';
  /** 转移结果：日程项 id -> 新负责人 */
  transfers: { itemId: string; spotId: string; dayIndex: number; from: string; to: string }[];
}

/**
 * 移除同行人（原子操作）：
 * 1. 该成员负责的所有日程项需要一次性转交给仍在名单中的其他成员；
 * 2. 接收人接完后不得出现同日时间重叠（含其原有负责项与本次接收的其他项）；
 * 3. 只要有一个日程项找不到接收人，整批拒绝，成员和分工保持原样。
 *
 * 调用方拿到 ok 后自行持久化；ok=false 时入参数组不会被修改。
 */
export function removeMember(
  dayPlans: DayPlan[],
  members: string[],
  tripId: string,
  member: string,
): RemoveMemberResult {
  const empty: RemoveMemberResult = { ok: false, transfers: [] };
  if (!members.includes(member)) return { ...empty, reason: 'not-member' };

  const remainingMembers = members.filter((name) => name !== member);

  // 收集该成员负责的全部日程项（仅本行程）
  const orphans: OrphanItem[] = [];
  for (const day of dayPlans) {
    if (day.trip_id !== tripId) continue;
    for (const item of day.items) {
      if (item.owner === member) orphans.push({ day, item });
    }
  }

  // 剩余成员原本负责的日程项索引（成员 -> 其出现的日程分组）
  const existing = new Map<string, OrphanItem[]>();
  for (const day of dayPlans) {
    if (day.trip_id !== tripId) continue;
    for (const item of day.items) {
      if (item.owner && remainingMembers.includes(item.owner)) {
        const list = existing.get(item.owner) || [];
        list.push({ day, item });
        existing.set(item.owner, list);
      }
    }
  }

  // 可分配约束最高的孤儿项优先（与其他孤儿项重叠越多越先安排）
  const ordered = [...orphans].sort((a, b) => overlapCount(b.item, orphans) - overlapCount(a.item, orphans));

  const tentative: TentativePlan = new Map();
  const transfers: RemoveMemberResult['transfers'] = [];

  for (const { day, item } of ordered) {
    const receiver = remainingMembers.find((candidate) => {
      // 与候选成员原有负责项（同一天）比较
      for (const group of existing.get(candidate) || []) {
        if (group.day.day_index === day.day_index) {
          for (const owned of group.day.items) {
            if (owned.owner === candidate && owned.id !== item.id && isTimeOverlap(owned, item)) {
              return false;
            }
          }
        }
      }
      // 与本次暂分方案比较（只可能是同一天的项）
      for (const taken of tentative.get(candidate) || []) {
        if (isTimeOverlap(taken, item)) return false;
      }
      return true;
    });
    if (!receiver) return { ...empty, reason: 'no-receiver' };
    const list = tentative.get(receiver) || [];
    list.push(item);
    tentative.set(receiver, list);
    transfers.push({ itemId: item.id, spotId: item.spot_id, dayIndex: day.day_index, from: member, to: receiver });
  }

  // 全部可分配 → 一次性提交
  for (const [receiver, items] of tentative) {
    for (const item of items) item.owner = receiver;
  }
  // 从所有日程项的协助名单中移除该成员
  for (const day of dayPlans) {
    if (day.trip_id !== tripId) continue;
    for (const item of day.items) {
      item.assistants = (item.assistants || []).filter((name) => name !== member);
    }
  }
  return { ok: true, transfers };
}

function overlapCount(target: DayPlanItem, orphans: OrphanItem[]): number {
  return orphans.reduce((sum, { item }) => sum + (item !== target && isTimeOverlap(item, target) ? 1 : 0), 0);
}

/** 旧数据兼容：补齐日程项 id 与 assistants，清掉已不在名单中的负责人/协助人 */
export function normalizeDayPlans(dayPlans: DayPlan[], membersByTrip: Map<string, string[]>): DayPlan[] {
  return dayPlans.map((day) => ({
    ...day,
    items: day.items.map((raw) => {
      const item: DayPlanItem = {
        ...raw,
        id: raw.id || crypto.randomUUID(),
        assistants: Array.isArray(raw.assistants) ? [...raw.assistants] : [],
      };
      const members = membersByTrip.get(day.trip_id) || [];
      if (item.owner && !members.includes(item.owner)) item.owner = undefined;
      item.assistants = sanitizeAssistants(item.assistants, members, item.owner);
      return item;
    }),
  }));
}
