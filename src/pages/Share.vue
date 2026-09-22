<template>
  <main class="page">
    <template v-if="trip">
      <TripHeader :trip="trip" />
      <DayTimeline v-for="day in tripDays" :key="day.id" :day="day" :spots="spotStore.spots" />
      <el-button @click="copyText">复制行程文本</el-button>
    </template>
    <EmptyState v-else title="旅行不存在" description="请从行程详情进入分享预览。" />
  </main>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import EmptyState from '../components/common/EmptyState.vue';
const route = useRoute();
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const trip = computed(() => tripStore.trips.find((item) => item.id === route.params.id) || tripStore.trips[0]);
const tripDays = computed(() =>
  trip.value ? dayPlanStore.dayPlans.filter((day) => day.trip_id === trip.value!.id) : [],
);
function copyText() {
  if (!trip.value) return;
  const lines = ['TripWeaver 行程单：' + trip.value.title];
  tripDays.value.forEach((day) => {
    lines.push('第 ' + day.day_index + ' 天 · ' + day.date);
    day.items.forEach((item) => {
      const spot = spotStore.spots.find((candidate) => candidate.id === item.spot_id);
      lines.push('  ' + item.start_time + '-' + item.end_time + ' ' + (spot?.name || '未知景点') + (item.owner ? '（负责人：' + item.owner + '）' : ''));
    });
  });
  navigator.clipboard?.writeText(lines.join('\n'));
}
</script>
