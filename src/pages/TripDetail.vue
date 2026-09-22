<template>
  <main class="page" v-if="trip">
    <TripHeader :trip="trip" />
    <div class="toolbar">
      <el-button type="primary" @click="router.push('/spots')">添加景点</el-button>
      <el-button @click="router.push('/planner/' + trip.id + '/1')">编排第 1 天</el-button>
      <el-button @click="router.push('/share/' + trip.id)">分享预览</el-button>
    </div>
    <section class="grid">
      <BudgetChart :spent="stats.value.budget.spent" :remaining="stats.value.budget.remaining" />
      <MemberPanel :trip="trip" @add="(name) => tripStore.addMember(tripId, name)" @remove="removeMember" />
      <div class="band"><strong>统计</strong><p>天数 {{ stats.value.days }} · 景点 {{ stats.value.spotCount }}</p><p class="muted">{{ stats.value.budget.warning }}</p></div>
    </section>
    <DayTimeline
      v-for="day in tripDays"
      :key="day.id"
      :day="day"
      :spots="spotStore.spots"
      :members="members"
      @assign-owner="(item, member) => dayPlanStore.assignOwner(tripId, day.day_index, item, member, members)"
      @set-assistants="(item, members) => dayPlanStore.setAssistants(tripId, day.day_index, item, members, members)"
    />
  </main>
  <main v-else class="page"><EmptyState title="旅行不存在" /></main>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import { useTripStats } from '../hooks/useTripStats';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import BudgetChart from '../components/common/BudgetChart.vue';
import EmptyState from '../components/common/EmptyState.vue';
import MemberPanel from '../components/common/MemberPanel.vue';
const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const trip = computed(() => tripStore.trips.find((item) => item.id === route.params.id));
const tripId = computed(() => String(route.params.id));
const members = computed(() => trip.value?.members || []);
const tripDays = computed(() => dayPlanStore.dayPlans.filter((day) => day.trip_id === route.params.id));
const stats = computed(() => trip.value ? useTripStats(trip.value, dayPlanStore.dayPlans, spotStore.spots) : { value: { days: 0, spotCount: 0, budget: { spent: 0, remaining: 0, warning: '' } } });
function removeMember(name: string) {
  tripStore.removeMember(tripId.value, name, dayPlanStore.dayPlans);
}
</script>
