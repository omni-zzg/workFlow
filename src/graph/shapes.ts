import type { Node } from '@antv/x6'

import type { NodeType } from '@/schema'

/**
 * 节点类型 <-> X6 shape 名映射。
 * 约定：节点的领域数据存放在 cell.data（即 schema 的 data），节点类型由 shape 推导。
 */
export const SHAPE_BY_NODE_TYPE: Record<NodeType, string> = {
  start: 'flow-start',
  task: 'flow-task',
  final: 'flow-final',
}

export const NODE_TYPE_BY_SHAPE: Record<string, NodeType> = Object.fromEntries(
  Object.entries(SHAPE_BY_NODE_TYPE).map(([type, shape]) => [shape, type as NodeType]),
)

/** 节点默认尺寸（尺寸不持久化，创建时按类型给定） */
export const NODE_SIZE_BY_TYPE: Record<NodeType, { width: number; height: number }> = {
  start: { width: 208, height: 58 },
  task: { width: 272, height: 196 },
  final: { width: 208, height: 58 },
}

export const NODE_TYPES: readonly NodeType[] = ['start', 'task', 'final']

/** 连接点样式：白色小圆点、悬停可辨（鼠标由此拖出连线） */
const PORT_BODY_ATTRS = {
  r: 5,
  magnet: true,
  stroke: '#94a3b8',
  strokeWidth: 1.5,
  fill: '#ffffff',
  style: { cursor: 'crosshair' },
}

/**
 * 节点连接点（spec: flow-canvas-editing「从节点的连接点拖拽创建连线」/ design D8）：
 * 四向各一个；由 shape 注册提供、随节点创建生效，不进入持久化格式（与节点尺寸同理）。
 */
export function createNodePorts(): Node.Metadata['ports'] {
  const group = { attrs: { circle: PORT_BODY_ATTRS } }
  return {
    groups: {
      top: { position: 'top', ...group },
      right: { position: 'right', ...group },
      bottom: { position: 'bottom', ...group },
      left: { position: 'left', ...group },
    },
    items: [
      { id: 'port-top', group: 'top' },
      { id: 'port-right', group: 'right' },
      { id: 'port-bottom', group: 'bottom' },
      { id: 'port-left', group: 'left' },
    ],
  }
}
