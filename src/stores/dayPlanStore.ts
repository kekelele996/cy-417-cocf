import { defineStore } from 'pinia';
import type { DayPlan, DayPlanItem } from '../models/dayPlan';
import { dayPlanApi } from '../api/dayPlanApi';
import { tripApi } from '../api/tripApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import {
  assignOwner,
  normalizeDayPlans,
  removeMember,
  sanitizeAssistants,
  setAssistants,
  type AssignResult,
  type RemoveMemberResult,
} from '../utils/assignments';
import type { Trip } from '../models/trip';

function membersByTrip(trips: Trip[]) {
  const map = new Map<string, string[]>();
  for (const trip of trips) map.set(trip.id, trip.members);
  return map;
}

export const useDayPlanStore = defineStore('dayPlan', {
  state: () => {
    const trips = tripApi.list();
    const plans = normalizeDayPlans(dayPlanApi.list() as DayPlan[], membersByTrip(trips));
    return { dayPlans: plans };
  },
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
      const item: DayPlanItem = {
        id: crypto.randomUUID(),
        spot_id: spotId,
        start_time: '10:00',
        end_time: '12:00',
        note: '现场调整',
        transport: 'metro',
        assistants: [],
      };
      day.items.push(item);
      dayPlanApi.save(this.dayPlans);
      toast.ok(messages.spotAdded);
      return item.id;
    },
    reorder(tripId: string, dayIndex: number, from: number, to: number) {
      const day = this.ensureDay(tripId, dayIndex);
      const [moved] = day.items.splice(from, 1);
      if (moved) day.items.splice(to, 0, moved);
      dayPlanApi.save(this.dayPlans);
    },
    /** 设置负责人：冲突或成员不在名单时给出对应提示且不落盘 */
    setOwner(tripId: string, dayIndex: number, itemId: string, owner: string, members: string[]): AssignResult {
      const result = assignOwner(this.dayPlans, members, tripId, dayIndex, itemId, owner);
      if (result.ok) {
        dayPlanApi.save(this.dayPlans);
        toast.ok(messages.ownerAssigned);
      } else if (result.reason === 'conflict') {
        toast.warn(messages.ownerConflict);
      } else {
        toast.fail(messages.memberNotFound);
      }
      return result;
    },
    setAssistants(tripId: string, dayIndex: number, itemId: string, assistants: string[], members: string[]): AssignResult {
      const result = setAssistants(this.dayPlans, members, tripId, dayIndex, itemId, assistants);
      if (result.ok) {
        dayPlanApi.save(this.dayPlans);
        toast.ok(messages.assistantsUpdated);
      } else {
        toast.fail(messages.memberNotFound);
      }
      return result;
    },
    /** 移除同行人时的整批转交：失败时保持原样，成功时落盘 */
    reassignAfterRemoval(tripId: string, member: string, members: string[]): RemoveMemberResult {
      const snapshot = JSON.parse(JSON.stringify(this.dayPlans)) as DayPlan[];
      const result = removeMember(this.dayPlans, members, tripId, member);
      if (result.ok) {
        dayPlanApi.save(this.dayPlans);
      } else {
        this.dayPlans = snapshot;
      }
      return result;
    },
    /** 成员名单变化后兜底清洗（正常流程下分工已在移除动作内处理） */
    reconcileWithMembers(tripId: string, members: string[]) {
      let changed = false;
      for (const day of this.dayPlans) {
        if (day.trip_id !== tripId) continue;
        for (const item of day.items) {
          if (item.owner && !members.includes(item.owner)) {
            item.owner = undefined;
            changed = true;
          }
          const cleaned = sanitizeAssistants(item.assistants || [], members, item.owner);
          if (cleaned.length !== (item.assistants || []).length || cleaned.some((name, i) => name !== item.assistants?.[i])) {
            item.assistants = cleaned;
            changed = true;
          }
        }
      }
      if (changed) dayPlanApi.save(this.dayPlans);
    },
  },
});
