import type { Edge } from '@antv/x6'

import { conditionSummary } from '@/schema'
import type { EdgeKind, ExitCondition } from '@/schema'

/** 边在 X6 cell.data 中的存储结构（与 schema 的 kind/data 对应；kind 缺省视为 success） */
export interface EdgeCellData {
  kind?: EdgeKind
  condition?: ExitCondition | null
}

export function readEdgeKind(edge: Edge): EdgeKind {
  return edge.getData<EdgeCellData>()?.kind ?? 'success'
}

export function readEdgeCondition(edge: Edge): ExitCondition | null {
  return edge.getData<EdgeCellData>()?.condition ?? null
}

const EDGE_COLORS: Record<EdgeKind, string> = {
  success: '#64748b',
  failure: '#f97316',
}

/**
 * 两类边样式与标签（spec: flow-canvas-editing）：
 * success 实线青灰 + 前提条件摘要标签（草稿态无标签）；failure 橙色虚线 + 条件摘要或"异常"。
 * 纯展示派生：所有变更后可由 cell.data 重新推导，故不纳入撤销历史。
 */
export function applyEdgeStyle(edge: Edge): void {
  const kind = readEdgeKind(edge)
  const color = EDGE_COLORS[kind]

  edge.attr('line/stroke', color)
  edge.attr('line/strokeWidth', 1.7)
  edge.attr('line/strokeDasharray', kind === 'failure' ? '6 4' : null)
  edge.setRouter({ name: 'manhattan', args: { padding: kind === 'failure' ? 28 : 16 } })
  edge.setConnector({ name: 'rounded', args: { radius: 8 } })

  const condition = readEdgeCondition(edge)
  const text =
    kind === 'failure'
      ? (condition ? conditionSummary(condition) : '异常')
      : (condition ? conditionSummary(condition) : null)

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
