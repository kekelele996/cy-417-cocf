<template>
  <section class="band">
    <h3>第 {{ day.day_index }} 天 · {{ day.date }}</h3>
    <ol>
      <li v-for="item in day.items" :key="item.spot_id + item.start_time" class="schedule-item">
        <div>
          <strong>{{ spotName(item.spot_id) }}</strong>
          <span class="muted">{{ item.start_time }}-{{ item.end_time }} · {{ transportText[item.transport] }} · {{ item.note }}</span>
        </div>
        <div class="assign">
          <el-tag v-if="item.owner" type="success" size="small" class="owner-tag">负责人：{{ item.owner }}</el-tag>
          <el-tag v-else-if="editable" type="info" size="small" effect="plain">未指定负责人</el-tag>
          <template v-if="item.assistants && item.assistants.length">
            <el-tag v-for="name in item.assistants" :key="name" size="small" type="warning" effect="plain" class="assistant-tag">协助：{{ name }}</el-tag>
          </template>
          <template v-if="editable">
            <el-select
              :model-value="item.owner || ''"
              size="small"
              style="width: 132px"
              placeholder="指定负责人"
              @change="(value: string) => emit('assign-owner', item, value)"
            >
              <el-option label="（清空负责人）" value="" />
              <el-option v-for="member in members" :key="member" :label="member" :value="member" :disabled="member === item.owner" />
            </el-select>
            <el-select
              :model-value="item.assistants || []"
              size="small"
              style="width: 180px"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="协助人"
              @change="(value: string[]) => emit('set-assistants', item, value)"
            >
              <el-option v-for="member in assistantOptions(item)" :key="member" :label="member" :value="member" />
            </el-select>
          </template>
        </div>
      </li>
    </ol>
    <p v-if="!day.items.length" class="muted">这一天还没有安排。</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { DayPlan, DayPlanItem } from '../../models/dayPlan';
import type { Spot } from '../../models/spot';
import { transportText } from '../../utils/formatters';
const props = defineProps<{ day: DayPlan; spots: Spot[]; members?: string[] }>();
const emit = defineEmits<{
  (e: 'assign-owner', item: DayPlanItem, member: string): void;
  (e: 'set-assistants', item: DayPlanItem, members: string[]): void;
}>();
const editable = computed(() => !!props.members);
const spotName = (id: string) => props.spots.find((spot) => spot.id === id)?.name || '未知景点';
const assistantOptions = (item: DayPlanItem) => (props.members || []).filter((member) => member !== item.owner);
</script>
<style scoped>
.schedule-item { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; padding: 6px 0; }
.assign { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.owner-tag { font-weight: 600; }
.assistant-tag { margin-left: 0; }
</style>
