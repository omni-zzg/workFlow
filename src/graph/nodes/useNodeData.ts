import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'
import type { Graph, Node } from '@antv/x6'

import { readEdgeCondition, readEdgeKind } from '@/graph/edgeStyle'
import { conditionSummary } from '@/schema'

/**
 * 订阅节点数据的变更（teleport 模式下组件经由 props 拿到 node/graph，
 * 响应式需显式订阅 change:data；撤销/重做同样触发该事件）。
 */
export function useNodeData<T>(node: Node): Ref<T> {
  const data = ref(node.getData<T>()) as Ref<T>
  const update = (): void => {
    data.value = node.getData<T>()
  }
  node.on('change:data', update)
  onBeforeUnmount(() => {
    node.off('change:data', update)
  })
  return data
}

/** 订阅本节点全部 exit 出边的条件摘要（decision 徽标用） */
export function useExitConditionSummaries(node: Node, graph: Graph): Ref<string[]> {
  const summaries = ref<string[]>([])

  const refresh = (): void => {
    const edges = graph.getOutgoingEdges(node) ?? []
    summaries.value = edges
      .filter((edge) => readEdgeKind(edge) === 'exit')
      .map((edge) => conditionSummary(readEdgeCondition(edge)))
  }

  refresh()
  graph.on('edge:added', refresh)
  graph.on('edge:removed', refresh)
  graph.on('edge:change:data', refresh)

  onBeforeUnmount(() => {
    graph.off('edge:added', refresh)
    graph.off('edge:removed', refresh)
    graph.off('edge:change:data', refresh)
  })

  return summaries
}
