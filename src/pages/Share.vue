<template>
  <main class="page">
    <template v-if="trip">
      <TripHeader :trip="trip" />
      <div class="toolbar">
        <el-select v-model="sharedTripId" style="width: 240px" placeholder="选择要分享的旅行">
          <el-option v-for="item in tripStore.trips" :key="item.id" :label="item.title" :value="item.id" />
        </el-select>
        <el-button type="primary" @click="copyText">复制行程文本</el-button>
        <span class="muted">分享单按负责人列出分工。</span>
      </div>
      <DayTimeline v-for="day in tripDays" :key="day.id" :day="day" :spots="spotStore.spots" />
    </template>
    <EmptyState v-else title="还没有可分享的旅行" description="先创建一次旅行并编排行程。" />
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import TripHeader from '../components/common/TripHeader.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import EmptyState from '../components/common/EmptyState.vue';
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const sharedTripId = ref(tripStore.trips[0]?.id || '');
const trip = computed(() => tripStore.getTrip(sharedTripId.value));
const tripDays = computed(() => dayPlanStore.dayPlans.filter((day) => day.trip_id === sharedTripId.value));
function copyText() {
  const lines: string[] = [];
  const current = trip.value;
  if (!current) return;
  lines.push(`TripWeaver 行程单：${current.title}`);
  for (const day of tripDays.value) {
    lines.push(`第 ${day.day_index} 天 · ${day.date}`);
    for (const item of day.items) {
      const spotName = spotStore.spots.find((spot) => spot.id === item.spot_id)?.name || '未知景点';
      const assistants = item.assistants.length ? `（协助：${item.assistants.join('、')}）` : '';
      lines.push(`  ${item.start_time}-${item.end_time} ${spotName}｜负责：${item.owner || '未指派'}${assistants}`);
    }
  }
  navigator.clipboard?.writeText(lines.join('\n'));
}
</script>
