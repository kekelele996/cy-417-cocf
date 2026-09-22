<template>
  <section class="band member-panel">
    <h3>同行人（{{ trip.members.length }}）</h3>
    <ul class="member-list">
      <li v-for="member in trip.members" :key="member" class="member-row">
        <el-tag type="success" effect="plain">{{ member }}</el-tag>
        <el-button
          link
          type="danger"
          size="small"
          :disabled="trip.members.length <= 1"
          @click="emit('remove', member)"
        >移除</el-button>
      </li>
    </ul>
    <div class="member-add">
      <el-input v-model="name" placeholder="新同行人姓名" size="small" style="max-width: 200px" @keyup.enter="add" />
      <el-button type="primary" size="small" @click="add">添加同行人</el-button>
    </div>
    <p class="muted member-hint">移除同行人时，其负责的日程项会一次性转交给时间不冲突的成员；找不到接收人将整批拒绝。</p>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import type { Trip } from '../../models/trip';
const props = defineProps<{ trip: Trip }>();
const emit = defineEmits<{ (e: 'add', name: string): void; (e: 'remove', name: string): void }>();
const name = ref('');
function add() {
  if (!name.value.trim()) return;
  emit('add', name.value);
  name.value = '';
}
</script>
<style scoped>
.member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.member-row { display: flex; align-items: center; gap: 6px; }
.member-add { display: flex; gap: 8px; margin-top: 12px; }
.member-hint { margin-top: 10px; font-size: 12px; }
</style>
