import type { DayPlan, DayPlanItem } from '../models/dayPlan';

/** 把 HH:mm 转成当日分钟数，无法解析时返回 null */
export function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 两个日程项在同一天的时间是否重叠（端点相接不算重叠） */
export function isOverlap(a: DayPlanItem, b: DayPlanItem): boolean {
  const aStart = toMinutes(a.start_time);
  const aEnd = toMinutes(a.end_time);
  const bStart = toMinutes(b.start_time);
  const bEnd = toMinutes(b.end_time);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** 该成员在指定日期（dayPlan）内，除 excludeItem 外是否已有时间重叠的负责项 */
export function hasOwnerConflict(
  day: DayPlan,
  member: string,
  target: DayPlanItem,
): boolean {
  return day.items.some(
    (item) => item !== target && item.owner === member && isOverlap(item, target),
  );
}

/** 取行程内某天的日程 */
export function findDay(dayPlans: DayPlan[], tripId: string, dayIndex: number) {
  return dayPlans.find((day) => day.trip_id === tripId && day.day_index === dayIndex);
}

/**
 * 移除同行人时，一次性为其全部负责项寻找接收人。
 * 接收人必须：仍在名单内，且接完所有已分配给 TA 的项目后仍然不产生时间重叠。
 * 任一项找不到可行接收人则整批拒绝（返回 null），调用方保持成员和分工原样。
 */
export function planOwnerReassignment(
  dayPlans: DayPlan[],
  leavingMember: string,
  remainingMembers: string[],
): { day: DayPlan; item: DayPlanItem; nextOwner: string }[] | null {
  const owned: { day: DayPlan; item: DayPlanItem }[] = [];
  dayPlans.forEach((day) => {
    day.items.forEach((item) => {
      if (item.owner === leavingMember) owned.push({ day, item });
    });
  });

  if (!owned.length) return [];

  // 模拟各候选成员"接管后"的占用区间：先放入其现有负责项（按天分组，跨天互不冲突）
  const busy = new Map<string, Map<string, DayPlanItem[]>>();
  remainingMembers.forEach((member) => {
    const byDay = new Map<string, DayPlanItem[]>();
    dayPlans.forEach((day) => {
      byDay.set(day.id, day.items.filter((item) => item.owner === member));
    });
    busy.set(member, byDay);
  });

  const plan: { day: DayPlan; item: DayPlanItem; nextOwner: string }[] = [];
  // 按日期与起点排序，区间多的/长的先分配，降低后续无解概率
  const ordered = [...owned].sort((a, b) => {
    if (a.day.day_index !== b.day.day_index) return a.day.day_index - b.day.day_index;
    return (toMinutes(a.item.start_time) ?? 0) - (toMinutes(b.item.start_time) ?? 0);
  });

  for (const entry of ordered) {
    const candidate = remainingMembers.find((member) => {
      const schedule = busy.get(member)?.get(entry.day.id) || [];
      return !schedule.some((other) => isOverlap(other, entry.item));
    });
    if (!candidate) return null; // 整批拒绝
    busy.get(candidate)!.get(entry.day.id)!.push(entry.item);
    plan.push({ ...entry, nextOwner: candidate });
  }
  return plan;
}

/** 移除成员在所有日程项中的协助身份（协助不受限，直接清理） */
export function stripAssistant(dayPlans: DayPlan[], member: string) {
  dayPlans.forEach((day) => {
    day.items.forEach((item) => {
      if (item.assistants?.length) {
        item.assistants = item.assistants.filter((name) => name !== member);
      }
    });
  });
}
