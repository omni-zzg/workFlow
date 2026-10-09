import type { FlowEdge, FlowMeta, FlowNode, FlowSchema, RawEdge, RawNode } from './types'

/**
 * 持久化格式 <-> 编辑期中间形态 的双向转换（纯函数，不依赖 X6/Vue）。
 * graph/ 层负责 X6 cell 与 RawNode/RawEdge 之间的投影。
 */

export interface RawGraph {
  nodes: RawNode[]
  edges: RawEdge[]
  meta?: FlowMeta
}

export const DEFAULT_META: FlowMeta = { name: '未命名任务流' }

/** 中间形态 -> 持久化格式 */
export function graphToSchema(graph: RawGraph): FlowSchema {
  const nodes = graph.nodes.map(
    (node) =>
      ({
        id: node.id,
        type: node.nodeType,
        position: { x: node.x, y: node.y },
        ...(node.width != null && node.height != null
          ? { size: { width: node.width, height: node.height } }
          : {}),
        data: node.data,
      }) as FlowNode,
  )

  const edges = graph.edges.map(
    (edge): FlowEdge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
    }),
  )

  return {
    version: 1,
    meta: graph.meta ?? DEFAULT_META,
    nodes,
    edges,
  }
}

/** 持久化格式 -> 中间形态 */
export function schemaToCells(schema: FlowSchema): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodes = schema.nodes.map(
    (node) =>
      ({
        id: node.id,
        nodeType: node.type,
        x: node.position.x,
        y: node.position.y,
        ...(node.size ? { width: node.size.width, height: node.size.height } : {}),
        data: node.data,
      }) as RawNode,
  )

  const edges = schema.edges.map(
    (edge): RawEdge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
    }),
  )

  return { nodes, edges }
}

/** 深拷贝一份 schema（导出/测试用，避免引用别名） */
export function cloneSchema(schema: FlowSchema): FlowSchema {
  return structuredClone(schema)
}
