<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['final']>(props.node)
const answer = computed(() => (data.value.answer ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <div class="flow-capsule flow-capsule--final">
      <span class="flow-capsule__title">结束 · 最终产出</span>
      <span class="flow-capsule__body" :class="{ 'flow-capsule__body--empty': !answer }">
        {{ answer || '填写最终产出' }}
      </span>
    </div>
  </div>
</template>
