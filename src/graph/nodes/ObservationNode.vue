<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import NodeFrame from './NodeFrame.vue'
import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['observation']>(props.node)
const content = computed(() => (data.value.content ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <NodeFrame node-type="observation" title="观察">
      <span v-if="content" class="flow-node-text">{{ content }}</span>
      <span v-else class="flow-node-placeholder">填写工具返回结果</span>
    </NodeFrame>
  </div>
</template>
