<template>
  <div class="assign">
    <div class="row">
      <span class="label">负责人</span>
      <el-select
        :model-value="item.owner || ''"
        size="small"
        style="width: 150px"
        placeholder="未指派"
        clearable
        @change="onOwnerChange"
      >
        <el-option v-for="name in trip.members" :key="name" :label="name" :value="name" />
      </el-select>
    </div>
    <div class="row">
      <span class="label">协助人</span>
      <el-select
        :model-value="item.assistants"
        size="small"
        multiple
        collapse-tags
        collapse-tags-tooltip
        style="width: 230px"
        placeholder="无人协助"
        @change="onAssistantsChange"
      >
        <el-option
          v-for="name in assistantOptions"
          :key="name"
          :label="name"
          :value="name"
        />
      </el-select>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { Trip } from '../../models/trip';
import type { DayPlanItem } from '../../models/dayPlan';
import { useDayPlanStore } from '../../stores/dayPlanStore';

const props = defineProps<{
  trip: Trip;
  dayIndex: number;
  item: DayPlanItem;
}>();
const dayPlanStore = useDayPlanStore();

const assistantOptions = computed(() =>
  props.trip.members.filter((name) => name !== props.item.owner),
);

function onOwnerChange(value: string | undefined) {
  dayPlanStore.setOwner(
    props.trip.id,
    props.dayIndex,
    props.item.id,
    value || '',
    props.trip.members,
  );
}

function onAssistantsChange(values: unknown) {
  const assistants = Array.isArray(values) ? (values as string[]) : [];
  dayPlanStore.setAssistants(
    props.trip.id,
    props.dayIndex,
    props.item.id,
    assistants,
    props.trip.members,
  );
}
</script>
<style scoped>
.assign { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.label { font-size: 12px; color: #61706b; }
</style>
