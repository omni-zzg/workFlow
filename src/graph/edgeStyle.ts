import type { Edge } from '@antv/x6'

import { conditionSummary } from '@/schema'
import type { EdgeKind, ExitCondition } from '@/schema'

/** 边在 X6 cell.data 中的存储结构（与 schema 的 kind/data 对应） */
export interface EdgeCellData {
  kind: EdgeKind
  condition: ExitCondition | null
}

export function readEdgeKind(edge: Edge): EdgeKind {
  return edge.getData<EdgeCellData>()?.kind ?? 'sequence'
}

export function readEdgeCondition(edge: Edge): ExitCondition | null {
  return edge.getData<EdgeCellData>()?.condition ?? null
}

const EDGE_COLORS: Record<EdgeKind, string> = {
  sequence: '#94a3b8',
  loop: '#8b5cf6',
  exit: '#10b981',
}

/**
 * 三类边样式与标签（spec: flow-canvas-editing）：
 * sequence 实线灰；loop 虚线紫 + "循环"标签；exit 高亮绿 + 条件摘要标签。
 * 纯展示派生：所有变更后可由 cell.data 重新推导，故不纳入撤销历史。
 */
export function applyEdgeStyle(edge: Edge): void {
  const kind = readEdgeKind(edge)
  const color = EDGE_COLORS[kind]

  edge.attr('line/stroke', color)
  edge.attr('line/strokeWidth', 1.6)
  edge.attr('line/strokeDasharray', kind === 'loop' ? '6 4' : null)
  edge.setRouter({ name: 'manhattan', args: { padding: kind === 'loop' ? 28 : 16 } })
  edge.setConnector({ name: 'rounded', args: { radius: 8 } })

  const text =
    kind === 'exit' ? conditionSummary(readEdgeCondition(edge)) : kind === 'loop' ? '循环' : null

  if (text === null) {
    edge.setLabels([])
    return
  }
  edge.setLabels([
    {
      attrs: { label: { text, fill: color, fontSize: 11 } },
      position: 0.5,
    },
  ])
}
