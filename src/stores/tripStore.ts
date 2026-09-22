import { defineStore } from 'pinia';
import { TripStatus } from '../constants/trip';
import type { Trip } from '../models/trip';
import { tripApi } from '../api/tripApi';
import { dayPlanApi } from '../api/dayPlanApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { planOwnerReassignment, stripAssistant } from '../utils/assignment';

export const useTripStore = defineStore('trip', {
  state: () => ({ trips: tripApi.list() as Trip[], statusFilter: 'all' as TripStatus | 'all' }),
  getters: {
    filteredTrips: (state) => state.statusFilter === 'all' ? state.trips : state.trips.filter((trip) => trip.status === state.statusFilter),
  },
  actions: {
    createTrip(title = '杭州周末慢旅行') {
      const trip: Trip = {
        id: crypto.randomUUID(),
        title,
        destination: '杭州',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        budget: 3200,
        currency: 'CNY',
        members: ['我', '朋友'],
        status: TripStatus.PLANNING,
        created_at: new Date().toISOString(),
      };
      this.trips.unshift(trip);
      tripApi.save(this.trips);
      toast.ok(messages.tripCreated);
      return trip.id;
    },
    removeTrip(id: string) {
      this.trips = this.trips.filter((trip) => trip.id !== id);
      tripApi.save(this.trips);
      toast.ok(messages.tripDeleted);
    },
    addMember(tripId: string, name: string) {
      const trip = this.trips.find((item) => item.id === tripId);
      if (!trip) return false;
      const trimmed = name.trim();
      if (!trimmed) {
        toast.warn(messages.memberRequired);
        return false;
      }
      if (trip.members.includes(trimmed)) {
        toast.warn(messages.memberExists);
        return false;
      }
      trip.members.push(trimmed);
      tripApi.save(this.trips);
      toast.ok(messages.memberAdded);
      return true;
    },
    /**
     * 移除同行人：其负责项必须一次性全部转给仍在名单且接完后不重叠的成员。
     * 任何一项找不到接收人则整批拒绝，成员名单和分工都保持原样。
     */
    removeMember(tripId: string, name: string, dayPlans: import('../models/dayPlan').DayPlan[]) {
      const trip = this.trips.find((item) => item.id === tripId);
      if (!trip || !trip.members.includes(name)) return false;
      const remaining = trip.members.filter((member) => member !== name);
      if (!remaining.length) {
        toast.warn(messages.memberLastOne);
        return false;
      }
      const tripDays = dayPlans.filter((day) => day.trip_id === tripId);
      const plan = planOwnerReassignment(tripDays, name, remaining);
      if (plan === null) {
        toast.fail(messages.memberRemoveBlocked);
        return false;
      }
      // 一次性应用转交方案
      plan.forEach(({ item, nextOwner }) => { item.owner = nextOwner; });
      stripAssistant(tripDays, name);
      trip.members = remaining;
      tripApi.save(this.trips);
      dayPlanApi.save(dayPlans);
      toast.ok(messages.memberRemoved);
      return true;
    },
  },
});
