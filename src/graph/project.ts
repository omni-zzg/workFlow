import type { Edge, Graph, Node } from '@antv/x6'

import { DEFAULT_META } from '@/schema'
import type {
  EdgeKind,
  FlowMeta,
  NodeData,
  NodeType,
  RawEdge,
  RawGraph,
  RawNode,
} from '@/schema'

import { applyEdgeStyle, createEdgeEndpointTools, readEdgeKind } from './edgeStyle'
import type { EdgeCellData } from './edgeStyle'
import { mutate } from './mutate'
import { NODE_SIZE_BY_TYPE, NODE_TYPE_BY_SHAPE, SHAPE_BY_NODE_TYPE } from './shapes'

/**
 * X6 cell <-> schema 中间形态（RawGraph）的投影（design D1）：
 * - 编辑期真源是 X6 Graph；projectRawGraph 产出纯数据供校验/导出
 * - insertRawGraph 用于导入与模板插入
 */

export function requireNodeType(node: Node): NodeType {
  const nodeType = NODE_TYPE_BY_SHAPE[node.shape]
  if (!nodeType) throw new Error(`未知节点类型：shape=${node.shape}`)
  return nodeType
}

/** 从当前图投影出中间形态（纯数据，不修改图） */
export function projectRawGraph(graph: Graph, meta: FlowMeta = DEFAULT_META): RawGraph {
  const nodes = graph.getNodes().map((node): RawNode => {
    const nodeType = requireNodeType(node)
    const position = node.getPosition()
    return {
      id: node.id,
      nodeType,
      x: position.x,
      y: position.y,
      data: node.getData<NodeData>(),
    } as RawNode
  })

  const edges = graph.getEdges().map((edge): RawEdge => {
    return {
      id: edge.id,
      source: edge.getSourceCellId(),
      target: edge.getTargetCellId(),
      kind: readEdgeKind(edge),
    }
  })

  return { nodes, edges, meta }
}

export function createNodeMetadata(raw: RawNode): Node.Metadata {
  const size = NODE_SIZE_BY_TYPE[raw.nodeType]
  return {
    id: raw.id,
    shape: SHAPE_BY_NODE_TYPE[raw.nodeType],
    x: raw.x,
    y: raw.y,
    width: size.width,
    height: size.height,
    data: raw.data,
  }
}

export function createEdgeMetadata(raw: RawEdge): Edge.Metadata {
  return {
    id: raw.id,
    source: raw.source,
    target: raw.target,
    data: { kind: raw.kind } satisfies EdgeCellData,
    tools: createEdgeEndpointTools(),
  }
}

export interface InsertRawGraphOptions {
  /** 插入前清空画布（导入为整体替换） */
  clear?: boolean
}

/** 将中间形态插入图（导入、模板插入共用路径） */
export function insertRawGraph(
  graph: Graph,
  raw: Pick<RawGraph, 'nodes' | 'edges'>,
  options: InsertRawGraphOptions = {},
): void {
  mutate(graph, () => {
    if (options.clear) graph.clearCells()
    graph.addNodes(raw.nodes.map(createNodeMetadata))
    for (const edgeRaw of raw.edges) {
      const edge = graph.addEdge(createEdgeMetadata(edgeRaw))
      applyEdgeStyle(edge)
    }
  })
}

/**
 * 重复连线判定（spec: flow-canvas-editing —— 阻止相同 source、target 与 kind 的重复连线；
 * 同向不同 kind——如同时存在普通连线与异常出口——允许）。
 * excludeEdgeId 用于重连场景：正在调整端点的边不与自己比较。
 */
export function isDuplicateConnection(
  graph: Graph,
  sourceId: string,
  targetId: string,
  kind: EdgeKind,
  excludeEdgeId?: string | null,
): boolean {
  return graph
    .getEdges()
    .some(
      (edge) =>
        edge.id !== excludeEdgeId &&
        edge.getSourceCellId() === sourceId &&
        edge.getTargetCellId() === targetId &&
        readEdgeKind(edge) === kind,
    )
}
