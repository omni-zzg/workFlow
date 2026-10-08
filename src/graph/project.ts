import type { Edge, Graph, Node } from '@antv/x6'

import { buildIndex, isAncestor } from '@/analysis'
import { DEFAULT_META } from '@/schema'
import type {
  EdgeKind,
  ExitCondition,
  FlowMeta,
  NodeData,
  NodeType,
  RawEdge,
  RawGraph,
  RawNode,
} from '@/schema'

import { applyEdgeStyle, readEdgeCondition, readEdgeKind } from './edgeStyle'
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
    const kind = readEdgeKind(edge)
    return {
      id: edge.id,
      source: edge.getSourceCellId(),
      target: edge.getTargetCellId(),
      kind,
      condition: kind === 'exit' ? readEdgeCondition(edge) : null,
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
    data: { kind: raw.kind, condition: raw.condition } satisfies {
      kind: EdgeKind
      condition: ExitCondition | null
    },
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

/** 依据当前图拓扑推断新连线的 kind：目标节点是源节点祖先 => 回边（复用 analysis 纯算法） */
export function inferEdgeKind(graph: Graph, sourceId: string, targetId: string): EdgeKind {
  const raw = projectRawGraph(graph)
  const index = buildIndex(raw.nodes, raw.edges)
  return isAncestor(index, targetId, sourceId) ? 'loop' : 'sequence'
}
