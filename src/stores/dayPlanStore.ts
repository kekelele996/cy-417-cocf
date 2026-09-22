import { defineStore } from 'pinia';
import type { DayPlan, DayPlanItem } from '../models/dayPlan';
import { dayPlanApi } from '../api/dayPlanApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { findDay, hasOwnerConflict } from '../utils/assignment';

export const useDayPlanStore = defineStore('dayPlan', {
  state: () => ({ dayPlans: dayPlanApi.list() as DayPlan[] }),
  actions: {
    ensureDay(tripId: string, dayIndex = 1, date = new Date().toISOString().slice(0, 10)) {
      let day = this.dayPlans.find((item) => item.trip_id === tripId && item.day_index === dayIndex);
      if (!day) {
        day = { id: crypto.randomUUID(), trip_id: tripId, day_index: dayIndex, date, items: [] };
        this.dayPlans.push(day);
      }
      return day;
    },
    addSpot(tripId: string, spotId: string, dayIndex = 1) {
      const day = this.ensureDay(tripId, dayIndex);
      const item: DayPlanItem = { spot_id: spotId, start_time: '10:00', end_time: '12:00', note: '现场调整', transport: 'metro' };
      day.items.push(item);
      dayPlanApi.save(this.dayPlans);
      toast.ok(messages.spotAdded);
    },
    /** 拖拽排序后若出现同一负责人的时间重叠，则拒绝本次移动并保持原序 */
    reorder(tripId: string, dayIndex: number, from: number, to: number) {
      const day = findDay(this.dayPlans, tripId, dayIndex);
      if (!day) return;
      const previous = day.items.slice();
      const [moved] = day.items.splice(from, 1);
      if (!moved) return;
      day.items.splice(to, 0, moved);
      if (moved.owner && hasOwnerConflict(day, moved.owner, moved)) {
        day.items = previous;
        toast.warn(messages.ownerConflict);
        return;
      }
      dayPlanApi.save(this.dayPlans);
    },
    /** 设置负责人；member 为空表示清空。同一成员同一天时间重叠的负责项最多 1 项 */
    assignOwner(tripId: string, dayIndex: number, item: DayPlanItem, member: string, members: string[]) {
      const day = findDay(this.dayPlans, tripId, dayIndex);
      const target = day?.items.find((candidate) => candidate === item);
      if (!day || !target) return false;
      if (!member) {
        target.owner = undefined;
        dayPlanApi.save(this.dayPlans);
        toast.ok(messages.ownerCleared);
        return true;
      }
      if (!members.includes(member)) {
        toast.fail(messages.ownerNotMember);
        return false;
      }
      if (hasOwnerConflict(day, member, target)) {
        toast.warn(messages.ownerConflict);
        return false;
      }
      target.owner = member;
      // 负责人不再出现在协助名单中
      if (target.assistants?.length) target.assistants = target.assistants.filter((name) => name !== member);
      dayPlanApi.save(this.dayPlans);
      toast.ok(messages.ownerAssigned);
      return true;
    },
    /** 设置协助人；协助不受时间重叠限制，但必须仍是同行人且不能与负责人重复 */
    setAssistants(tripId: string, dayIndex: number, item: DayPlanItem, assistants: string[], members: string[]) {
      const day = findDay(this.dayPlans, tripId, dayIndex);
      const target = day?.items.find((candidate) => candidate === item);
      if (!day || !target) return false;
      if (assistants.some((name) => !members.includes(name))) {
        toast.fail(messages.ownerNotMember);
        return false;
      }
      const next = [...new Set(assistants)].filter((name) => name !== target.owner);
      if (target.owner && assistants.includes(target.owner)) toast.warn(messages.assistantIsOwner);
      target.assistants = next;
      dayPlanApi.save(this.dayPlans);
      toast.ok(messages.assistantUpdated);
      return true;
    },
  },
});
