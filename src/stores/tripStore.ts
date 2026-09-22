import { defineStore } from 'pinia';
import { TripStatus } from '../constants/trip';
import type { Trip } from '../models/trip';
import { tripApi } from '../api/tripApi';
import { messages } from '../constants/messages';
import { toast } from '../utils/message';
import { required } from '../utils/validators';
import { useDayPlanStore } from './dayPlanStore';

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
    getTrip(id: string) {
      return this.trips.find((trip) => trip.id === id);
    },
    /** 添加同行人：重名/空名拒绝 */
    addMember(tripId: string, rawName: string): boolean {
      const trip = this.getTrip(tripId);
      if (!trip) return false;
      let name = rawName;
      try {
        name = required(rawName, '同行人姓名');
      } catch (error) {
        toast.fail((error as Error).message);
        return false;
      }
      if (trip.members.includes(name)) {
        toast.warn(messages.memberDuplicated);
        return false;
      }
      trip.members.push(name);
      tripApi.save(this.trips);
      toast.ok(messages.memberAdded);
      return true;
    },
    /**
     * 移除同行人（原子操作）：
     * 先尝试把其负责项一次性整批转交，任何一项找不到不冲突的接收人则整批拒绝，
     * 成员与分工均保持原样。
     */
    removeMember(tripId: string, member: string): boolean {
      const trip = this.getTrip(tripId);
      if (!trip || !trip.members.includes(member)) {
        toast.fail(messages.memberNotFound);
        return false;
      }
      if (trip.members.length <= 1) {
        toast.warn(messages.memberLastOne);
        return false;
      }
      const dayPlanStore = useDayPlanStore();
      const result = dayPlanStore.reassignAfterRemoval(tripId, member, trip.members);
      if (!result.ok) {
        if (result.reason === 'no-receiver') toast.fail(messages.memberRemoveBlocked);
        else toast.fail(messages.memberNotFound);
        return false;
      }
      trip.members = trip.members.filter((name) => name !== member);
      tripApi.save(this.trips);
      const count = result.transfers.length;
      toast.ok(count > 0 ? messages.memberRemovedWithTransfer(count) : messages.memberRemoved);
      return true;
    },
  },
});
