<script setup lang="ts">
import type { NodeType } from '@/schema'

/** 常规节点（start/thought/action/observation/final）的共享卡片外框 */
const props = defineProps<{
  nodeType: NodeType
  title: string
  meta?: string | null
}>()
</script>

<template>
  <div class="flow-node-card" :class="`flow-node-card--${props.nodeType}`">
    <div class="flow-node-card__head">
      <span class="flow-node-card__title">{{ props.title }}</span>
      <span v-if="props.meta" class="flow-node-card__meta">{{ props.meta }}</span>
    </div>
    <div class="flow-node-card__body"><slot /></div>
    <div v-if="$slots.foot" class="flow-node-card__foot"><slot name="foot" /></div>
  </div>
</template>

<style scoped>
.flow-node-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.45;
  background: #fff;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  user-select: none;
}

.flow-node-card__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.flow-node-card__title {
  font-weight: 600;
}

.flow-node-card__meta {
  padding: 0 6px;
  font-size: 11px;
  color: #334155;
  background: rgb(241 245 249 / 90%);
  border-radius: 4px;
}

.flow-node-card__body {
  display: -webkit-box;
  flex: 1;
  margin-top: 3px;
  overflow: hidden;
  color: #475569;
  word-break: break-word;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.flow-node-card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

/* ---- 类型变体（design D12 视觉语言） ---- */

.flow-node-card--start {
  background: #ecfdf5;
  border-color: #34d399;
  border-radius: 999px;
}

.flow-node-card--start .flow-node-card__title {
  color: #065f46;
}

.flow-node-card--thought {
  background: #eef2ff;
  border-color: #818cf8;
  border-style: dashed;
}

.flow-node-card--thought .flow-node-card__title {
  color: #4338ca;
}

.flow-node-card--action {
  background: #fff7ed;
  border-color: #fb923c;
}

.flow-node-card--action .flow-node-card__title {
  color: #c2410c;
}

.flow-node-card--observation {
  background: #f8fafc;
  border-color: #94a3b8;
}

.flow-node-card--observation .flow-node-card__title {
  color: #475569;
}

.flow-node-card--final {
  background: #ecfdf5;
  border-color: #059669;
  border-width: 3px;
  border-radius: 999px;
}

.flow-node-card--final .flow-node-card__title {
  color: #065f46;
}
</style>
