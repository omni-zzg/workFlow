import type { Edge } from '@antv/x6'
import type { ToolsView } from '@antv/x6'

import type { EdgeKind } from '@/schema'

/** 边在 X6 cell.data 中的存储结构（与 schema 的 kind 对应；kind 缺省视为 normal） */
export interface EdgeCellData {
  kind?: EdgeKind
}

/**
 * 连线端点抓手（X6 arrowhead 工具，spec: flow-canvas-editing「连线端点改接」）：
 * 每条连线在起点/终点各带一个抓手，可直接拖动改接到其他节点或连接点。
 * 随连线创建时写入 cell.tools 并常驻（避免 X6 removeTools 不触发视图刷新的问题）；
 * 改接沿用 validateConnection（自环/重复连线被拒绝），拖到空白处自动回退。
 */
export function createEdgeEndpointTools(): NonNullable<ToolsView.Options['items']> {
  const attrs = {
    d: 'M -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
    fill: '#ffffff',
    stroke: '#3370ff',
    'stroke-width': 2,
    cursor: 'move',
  }
  return [
    { name: 'source-arrowhead', args: { attrs } },
    { name: 'target-arrowhead', args: { attrs } },
  ]
}

export function readEdgeKind(edge: Edge): EdgeKind {
  return edge.getData<EdgeCellData>()?.kind ?? 'normal'
}

const EDGE_COLORS: Record<EdgeKind, string> = {
  normal: '#64748b',
  exception: '#f97316',
}

/**
 * 两类边样式与标签（spec: flow-canvas-editing / design D12）：
 * normal 实线青灰、无标签；exception 橙色虚线 +「异常」标签。
 * 纯展示派生：所有变更后可由 cell.data 重新推导，故不纳入撤销历史。
 */
export function applyEdgeStyle(edge: Edge): void {
  const kind = readEdgeKind(edge)
  const color = EDGE_COLORS[kind]

  edge.attr('line/stroke', color)
  edge.attr('line/strokeWidth', 1.7)
  edge.attr('line/strokeDasharray', kind === 'exception' ? '6 4' : null)
  edge.setRouter({ name: 'manhattan', args: { padding: kind === 'exception' ? 28 : 16 } })
  edge.setConnector({ name: 'rounded', args: { radius: 8 } })

  if (kind === 'exception') {
    edge.setLabels([
      {
        attrs: { label: { text: '异常', fill: color, fontSize: 11 } },
        position: 0.5,
      },
    ])
    return
  }
  edge.setLabels([])
}
