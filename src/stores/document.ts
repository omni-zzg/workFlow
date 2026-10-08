import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Graph } from '@antv/x6'

import { DEFAULT_META } from '@/schema'
import type { FlowMeta } from '@/schema'

/**
 * 文档级状态：元信息、脏标记、节点计数（空画布引导用）。
 * 校验结果等其它派生视图见 stores/validation。
 */
const meta = ref<FlowMeta>({ ...DEFAULT_META })
const dirty = ref(false)
const nodeCount = ref(0)

export function useDocument(): {
  meta: Ref<FlowMeta>
  dirty: Ref<boolean>
  nodeCount: Ref<number>
  setMeta: (next: FlowMeta) => void
  markDirty: () => void
  markClean: () => void
} {
  return { meta, dirty, nodeCount, setMeta, markDirty, markClean }
}

function setMeta(next: FlowMeta): void {
  meta.value = next
}

function markDirty(): void {
  dirty.value = true
}

function markClean(): void {
  dirty.value = false
}

export function initDocumentTracking(graph: Graph): () => void {
  const onNodeCount = (): void => {
    nodeCount.value = graph.getNodes().length
    markDirty()
  }
  const onEdit = (): void => {
    markDirty()
  }

  graph.on('node:added', onNodeCount)
  graph.on('node:removed', onNodeCount)
  graph.on('node:moved', onEdit)
  graph.on('node:change:position', onEdit)
  graph.on('node:change:data', onEdit)
  graph.on('edge:added', onEdit)
  graph.on('edge:removed', onEdit)
  graph.on('edge:change:data', onEdit)

  nodeCount.value = graph.getNodes().length

  return () => {
    graph.off('node:added', onNodeCount)
    graph.off('node:removed', onNodeCount)
    graph.off('node:moved', onEdit)
    graph.off('node:change:position', onEdit)
    graph.off('node:change:data', onEdit)
    graph.off('edge:added', onEdit)
    graph.off('edge:removed', onEdit)
    graph.off('edge:change:data', onEdit)
  }
}
