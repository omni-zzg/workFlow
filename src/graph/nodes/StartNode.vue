<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import NodeFrame from './NodeFrame.vue'
import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['start']>(props.node)
const goal = computed(() => (data.value.goal ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <NodeFrame node-type="start" title="开始">
      <span v-if="goal" class="flow-node-text">{{ goal }}</span>
      <span v-else class="flow-node-placeholder">未填写目标</span>
    </NodeFrame>
  </div>
</template>
