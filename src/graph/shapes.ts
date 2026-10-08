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
