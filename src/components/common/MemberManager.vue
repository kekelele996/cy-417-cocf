<template>
  <section class="band members">
    <h3>同行人（{{ trip.members.length }}）</h3>
    <div class="chips">
      <el-tag
        v-for="name in trip.members"
        :key="name"
        size="large"
        closable
        disable-transitions
        @close="remove(name)"
      >{{ name }}</el-tag>
    </div>
    <div class="toolbar">
      <el-input
        v-model="draft"
        placeholder="输入同行人姓名"
        style="max-width: 220px"
        @keyup.enter="add"
      />
      <el-button type="primary" @click="add">添加同行人</el-button>
      <span class="muted tip">移除时其负责项会一次性转交，无法整批接收则移除被拒绝。</span>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import type { Trip } from '../../models/trip';
import { useTripStore } from '../../stores/tripStore';
const props = defineProps<{ trip: Trip }>();
const tripStore = useTripStore();
const draft = ref('');

function add() {
  if (tripStore.addMember(props.trip.id, draft.value)) draft.value = '';
}
function remove(name: string) {
  tripStore.removeMember(props.trip.id, name);
}
</script>
<style scoped>
.members .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.tip { font-size: 12px; }
</style>
