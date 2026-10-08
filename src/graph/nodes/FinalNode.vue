<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import NodeFrame from './NodeFrame.vue'
import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['final']>(props.node)
const answer = computed(() => (data.value.answer ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <NodeFrame node-type="final" title="结束">
      <span v-if="answer" class="flow-node-text">{{ answer }}</span>
      <span v-else class="flow-node-placeholder">填写最终答案</span>
    </NodeFrame>
  </div>
</template>
