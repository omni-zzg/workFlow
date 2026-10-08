<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import NodeFrame from './NodeFrame.vue'
import { useNodeData } from './useNodeData'

const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['action']>(props.node)

const toolName = computed(() => (data.value.tool?.name ?? '').trim())

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const paramsText = computed(() => {
  const params = data.value.tool?.params ?? {}
  const entries = Object.entries(params)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}=${formatParamValue(value)}`).join('  ')
})
</script>

<template>
  <div class="flow-node">
    <NodeFrame node-type="action" title="行动" :meta="toolName || null">
      <span v-if="paramsText" class="flow-node-text">{{ paramsText }}</span>
      <span v-else class="flow-node-placeholder">
        {{ toolName ? '未填写参数' : '填写工具名与参数' }}
      </span>
    </NodeFrame>
  </div>
</template>
