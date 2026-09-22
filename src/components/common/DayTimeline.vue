<template>
  <section class="band">
    <h3>第 {{ day.day_index }} 天 · {{ day.date }}</h3>
    <ol>
      <li v-for="item in day.items" :key="item.id">
        <strong>{{ spotName(item.spot_id) }}</strong>
        <span class="muted">{{ item.start_time }}-{{ item.end_time }} · {{ transportText[item.transport] }} · {{ item.note }}</span>
        <span class="assignment">
          <el-tag size="small" type="success" disable-transitions>负责：{{ item.owner || '未指派' }}</el-tag>
          <el-tag v-for="name in item.assistants" :key="name" size="small" type="info" disable-transitions>协助：{{ name }}</el-tag>
        </span>
      </li>
    </ol>
    <p v-if="!day.items.length" class="muted">这一天还没有安排。</p>
  </section>
</template>
<script setup lang="ts">
import type { DayPlan } from '../../models/dayPlan';
import type { Spot } from '../../models/spot';
import { transportText } from '../../utils/formatters';
const props = defineProps<{ day: DayPlan; spots: Spot[] }>();
const spotName = (id: string) => props.spots.find((spot) => spot.id === id)?.name || '未知景点';
</script>
<style scoped>
.assignment { display: inline-flex; flex-wrap: wrap; gap: 6px; margin-left: 8px; }
</style>
