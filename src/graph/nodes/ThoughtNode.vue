<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import NodeFrame from './NodeFrame.vue'
import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['thought']>(props.node)
const content = computed(() => (data.value.content ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <NodeFrame node-type="thought" title="思考">
      <span v-if="content" class="flow-node-text">{{ content }}</span>
      <span v-else class="flow-node-placeholder">填写推理内容</span>
    </NodeFrame>
  </div>
</template>
