import type { Graph, Node } from '@antv/x6'

import { mutate } from './mutate'

/**
 * 节点居中与对称分布（spec: flow-canvas-editing「节点对齐与对称分布」）——散开·轴对称语义：
 * - 水平/垂直居中：选中节点作为整体平移，中心落到画布可视区中线（相对布局不变，不拆散）；
 * - 水平/垂直等距：按行/列分组，多节点行（列）以画布中线为轴等距展开（左右/上下对称），
 *   单节点行（列）保持原位，行列整体保持散开。
 * 均经 mutate 包装：整组合并为单次撤销单元。
 */

interface RectInfo {
  node: Node
  x: number
  y: number
  width: number
  height: number
}

function rectOf(node: Node): RectInfo {
  const position = node.getPosition()
  const size = node.getSize()
  return { node, x: position.x, y: position.y, width: size.width, height: size.height }
}

function selectedNodes(graph: Graph): Node[] {
  return graph.getSelectedCells().filter((cell) => cell.isNode()) as Node[]
}

/** 画布可视区中心（图坐标）：居中与对称分布共用的"中线" */
function viewportCenter(graph: Graph): { x: number; y: number } {
  const container = graph.container
  return graph.clientToLocal(container.clientWidth / 2, container.clientHeight / 2)
}

/**
 * 沿交叉轴把节点聚类为列/行：投影区间重叠达到较小边长的一半即视为同一组（链式合并）。
 * 例如横等距按 Y 区间重叠分行、纵等距按 X 区间重叠分列。
 */
function groupAlongAxis(rects: RectInfo[], axis: 'x' | 'y'): RectInfo[][] {
  const start = (rect: RectInfo): number => (axis === 'x' ? rect.x : rect.y)
  const size = (rect: RectInfo): number => (axis === 'x' ? rect.width : rect.height)
  const sorted = [...rects].sort((a, b) => start(a) - start(b))

  const groups: RectInfo[][] = []
  let current: RectInfo[] = []
  let currentEnd = 0
  let currentMinSize = 0

  const flush = (): void => {
    if (current.length > 0) groups.push(current)
  }

  for (const rect of sorted) {
    const rectStart = start(rect)
    const rectSize = size(rect)
    if (current.length === 0) {
      current = [rect]
      currentEnd = rectStart + rectSize
      currentMinSize = rectSize
      continue
    }
    const overlap = currentEnd - rectStart
    if (overlap >= 0.5 * Math.min(rectSize, currentMinSize)) {
      current.push(rect)
      currentEnd = Math.max(currentEnd, rectStart + rectSize)
      currentMinSize = Math.min(currentMinSize, rectSize)
    } else {
      flush()
      current = [rect]
      currentEnd = rectStart + rectSize
      currentMinSize = rectSize
    }
  }
  flush()
  return groups
}

/** 水平居中：选中节点整体水平移动到画布垂直中线（相对布局不变） */
export function alignHorizontalCenter(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length === 0) return false
  const rects = nodes.map(rectOf)
  const centerX = viewportCenter(graph).x
  const left = Math.min(...rects.map((rect) => rect.x))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const dx = Math.round(centerX - (left + right) / 2)
  if (dx === 0) return true
  mutate(graph, () => {
    for (const rect of rects) {
      rect.node.position(rect.x + dx, rect.y)
    }
  })
  return true
}

/** 垂直居中：选中节点整体垂直移动到画布水平中线（相对布局不变） */
export function alignVerticalCenter(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length === 0) return false
  const rects = nodes.map(rectOf)
  const centerY = viewportCenter(graph).y
  const top = Math.min(...rects.map((rect) => rect.y))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  const dy = Math.round(centerY - (top + bottom) / 2)
  if (dy === 0) return true
  mutate(graph, () => {
    for (const rect of rects) {
      rect.node.position(rect.x, rect.y + dy)
    }
  })
  return true
}

/**
 * 水平对称分布（横等距）：按行分组，多节点行以画布垂直中线为轴横向等距展开（左右对称、
 * 行内 Y 不动、行首尾总跨度保持）；单节点行保持原位。整体保持散开、不聚成一条线。
 */
export function distributeHorizontally(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 2) return false
  const centerX = viewportCenter(graph).x
  const rows = groupAlongAxis(nodes.map(rectOf), 'y')

  mutate(graph, () => {
    for (const row of rows) {
      if (row.length < 2) continue // 单节点行保持原位
      const sorted = [...row].sort(
        (a, b) => a.x + a.width / 2 - (b.x + b.width / 2),
      )
      const first = sorted[0]!
      const last = sorted[sorted.length - 1]!
      const span = last.x + last.width - first.x
      const widthSum = sorted.reduce((sum, rect) => sum + rect.width, 0)
      const gap = (span - widthSum) / (sorted.length - 1)
      let cursor = centerX - (widthSum + gap * (sorted.length - 1)) / 2
      for (const rect of sorted) {
        rect.node.position(Math.round(cursor), rect.y)
        cursor += rect.width + gap
      }
    }
  })
  return true
}

/**
 * 垂直对称分布（纵等距）：按列分组，多节点列以画布水平中线为轴纵向等距展开（上下对称、
 * 列内 X 不动、列首尾总跨度保持）；单节点列保持原位。整体保持散开、不聚成一条线。
 */
export function distributeVertically(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 2) return false
  const centerY = viewportCenter(graph).y
  const columns = groupAlongAxis(nodes.map(rectOf), 'x')

  mutate(graph, () => {
    for (const column of columns) {
      if (column.length < 2) continue // 单节点列保持原位
      const sorted = [...column].sort(
        (a, b) => a.y + a.height / 2 - (b.y + b.height / 2),
      )
      const first = sorted[0]!
      const last = sorted[sorted.length - 1]!
      const span = last.y + last.height - first.y
      const heightSum = sorted.reduce((sum, rect) => sum + rect.height, 0)
      const gap = (span - heightSum) / (sorted.length - 1)
      let cursor = centerY - (heightSum + gap * (sorted.length - 1)) / 2
      for (const rect of sorted) {
        rect.node.position(rect.x, Math.round(cursor))
        cursor += rect.height + gap
      }
    }
  })
  return true
}
