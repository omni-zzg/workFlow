<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['start']>(props.node)
const goal = computed(() => (data.value.goal ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <div class="flow-capsule flow-capsule--start">
      <span class="flow-capsule__title">开始 · 全局目标</span>
      <span class="flow-capsule__body" :class="{ 'flow-capsule__body--empty': !goal }">
        {{ goal || '未填写全局目标' }}
      </span>
    </div>
  </div>
</template>
