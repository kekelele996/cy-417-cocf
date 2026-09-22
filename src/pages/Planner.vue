<template>
  <main class="page" v-if="trip">
    <h1>行程编排 · {{ trip.title }}</h1>
    <section class="band">
      <p class="muted">拖拽排序由 SortableJS 接管；预算计算会同步影响详情页。</p>
      <div ref="listEl">
        <SpotMiniCard v-for="spot in daySpots" :key="spot.id" :spot="spot" />
      </div>
    </section>
    <section class="band" v-if="day">
      <h3>分工安排（第 {{ dayIndex }} 天）</h3>
      <p class="muted">每个日程项仅 1 名负责人，协助人不限；同一负责人时间重叠的日程项最多 1 项。</p>
      <div v-for="item in day.items" :key="item.id" class="item-assign">
        <div class="item-head">
          <strong>{{ spotName(item.spot_id) }}</strong>
          <span class="muted">{{ item.start_time }}-{{ item.end_time }}</span>
        </div>
        <AssignmentEditor :trip="trip" :day-index="dayIndex" :item="item" />
      </div>
      <p v-if="!day.items.length" class="muted">这一天还没有安排。</p>
    </section>
    <DayTimeline v-if="day" :day="day" :spots="spotStore.spots" />
  </main>
  <main v-else class="page">
    <EmptyState title="旅行不存在" description="请从行程详情页进入编排。" />
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Sortable, { type SortableEvent } from 'sortablejs';
import { useTripStore } from '../stores/tripStore';
import { useSpotStore } from '../stores/spotStore';
import { useDayPlanStore } from '../stores/dayPlanStore';
import SpotMiniCard from '../components/common/SpotMiniCard.vue';
import DayTimeline from '../components/common/DayTimeline.vue';
import AssignmentEditor from '../components/common/AssignmentEditor.vue';
import EmptyState from '../components/common/EmptyState.vue';
const route = useRoute();
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const listEl = ref<HTMLElement>();
const tripId = String(route.params.tripId);
const dayIndex = Number(route.params.dayIndex || 1);
const trip = computed(() => tripStore.getTrip(tripId));
const day = computed(() => dayPlanStore.ensureDay(tripId, dayIndex));
const daySpots = computed(() => day.value.items.map((item) => spotStore.spots.find((spot) => spot.id === item.spot_id)).filter(Boolean) as any[]);
const spotName = (id: string) => spotStore.spots.find((spot) => spot.id === id)?.name || '未知景点';
onMounted(() => {
  if (listEl.value) {
    new Sortable(listEl.value, {
      animation: 150,
      onEnd: (evt: SortableEvent) => dayPlanStore.reorder(tripId, dayIndex, evt.oldIndex || 0, evt.newIndex || 0),
    });
  }
});
</script>
<style scoped>
.item-assign { padding: 10px 0; border-bottom: 1px dashed #dbe7cf; }
.item-assign:last-of-type { border-bottom: none; }
.item-head { display: flex; gap: 10px; align-items: baseline; }
</style>
