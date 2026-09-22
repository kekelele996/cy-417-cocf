<template>
  <main class="page" v-if="trip">
    <h1>行程编排 · {{ trip.title }}</h1>
    <section class="band">
      <p class="muted">拖拽排序由 SortableJS 接管；预算计算会同步影响详情页。</p>
      <div ref="listEl">
        <SpotMiniCard v-for="spot in daySpots" :key="spot.id" :spot="spot" />
      </div>
    </section>
    <DayTimeline
      v-if="day"
      :day="day"
      :spots="spotStore.spots"
      :members="members"
      @assign-owner="(item, member) => dayPlanStore.assignOwner(tripId, dayIndex, item, member, members)"
      @set-assistants="(item, members) => dayPlanStore.setAssistants(tripId, dayIndex, item, members, members)"
    />
  </main>
  <main v-else class="page"><EmptyState title="旅行不存在" /></main>
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
import EmptyState from '../components/common/EmptyState.vue';
const route = useRoute();
const tripStore = useTripStore();
const spotStore = useSpotStore();
const dayPlanStore = useDayPlanStore();
const listEl = ref<HTMLElement>();
const tripId = String(route.params.tripId);
const dayIndex = Number(route.params.dayIndex || 1);
const trip = computed(() => tripStore.trips.find((item) => item.id === tripId));
const members = computed(() => trip.value?.members || []);
const day = computed(() => dayPlanStore.ensureDay(tripId, dayIndex));
const daySpots = computed(() => day.value.items.map((item) => spotStore.spots.find((spot) => spot.id === item.spot_id)).filter(Boolean) as any[]);
onMounted(() => {
  if (listEl.value) {
    new Sortable(listEl.value, {
      animation: 150,
      onEnd: (evt: SortableEvent) => dayPlanStore.reorder(tripId, dayIndex, evt.oldIndex || 0, evt.newIndex || 0),
    });
  }
});
</script>
