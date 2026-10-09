import type { Graph, Node } from '@antv/x6'

import { mutate } from './mutate'

/**
 * 节点对齐与对称分布（spec: flow-canvas-editing「节点对齐与对称分布」）：
 * 对当前选中的节点——水平/垂直居中（对齐到同一中线）、水平/垂直等距分布（首尾不动、间隙均分）。
 * 均经 mutate 包装：整组调整合并为单次撤销单元。
 */

interface NodeRect {
  x: number
  y: number
  width: number
  height: number
}

function rectOf(node: Node): NodeRect {
  const position = node.getPosition()
  const size = node.getSize()
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

function selectedNodes(graph: Graph): Node[] {
  return graph.getSelectedCells().filter((cell) => cell.isNode()) as Node[]
}

/** 水平居中：选中节点对齐到同一水平中线（中心 Y 取平均） */
export function alignHorizontalCenter(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 2) return false
  const centers = nodes.map((node) => {
    const rect = rectOf(node)
    return rect.y + rect.height / 2
  })
  const target = centers.reduce((sum, center) => sum + center, 0) / centers.length
  mutate(graph, () => {
    nodes.forEach((node) => {
      const rect = rectOf(node)
      node.position(rect.x, Math.round(target - rect.height / 2))
    })
  })
  return true
}

/** 垂直居中：选中节点对齐到同一垂直中线（中心 X 取平均） */
export function alignVerticalCenter(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 2) return false
  const centers = nodes.map((node) => {
    const rect = rectOf(node)
    return rect.x + rect.width / 2
  })
  const target = centers.reduce((sum, center) => sum + center, 0) / centers.length
  mutate(graph, () => {
    nodes.forEach((node) => {
      const rect = rectOf(node)
      node.position(Math.round(target - rect.width / 2), rect.y)
    })
  })
  return true
}

/**
 * 水平对称分布（横等距）：先对齐到一条水平中线（平均中心 Y），
 * 再横向等距排列（首尾不动、间隙均分），整体左右对称。单次撤销。
 */
export function distributeHorizontally(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 3) return false
  const sorted = [...nodes].sort((a, b) => {
    const ra = rectOf(a)
    const rb = rectOf(b)
    return ra.x + ra.width / 2 - (rb.x + rb.width / 2)
  })

  const centerYs = sorted.map((node) => {
    const rect = rectOf(node)
    return rect.y + rect.height / 2
  })
  const targetCenterY = centerYs.reduce((sum, center) => sum + center, 0) / centerYs.length

  const first = rectOf(sorted[0]!)
  const last = rectOf(sorted[sorted.length - 1]!)
  const span = last.x + last.width - first.x
  const widthSum = sorted.reduce((sum, node) => sum + rectOf(node).width, 0)
  const gap = (span - widthSum) / (sorted.length - 1)

  mutate(graph, () => {
    let cursor = first.x
    for (const node of sorted) {
      const rect = rectOf(node)
      node.position(Math.round(cursor), Math.round(targetCenterY - rect.height / 2))
      cursor += rect.width + gap
    }
  })
  return true
}

/**
 * 垂直对称分布（纵等距）：先对齐到一条垂直中线（平均中心 X），
 * 再纵向等距排列（首尾不动、间隙均分），整体上下对称。单次撤销。
 */
export function distributeVertically(graph: Graph): boolean {
  const nodes = selectedNodes(graph)
  if (nodes.length < 3) return false
  const sorted = [...nodes].sort((a, b) => {
    const ra = rectOf(a)
    const rb = rectOf(b)
    return ra.y + ra.height / 2 - (rb.y + rb.height / 2)
  })

  const centerXs = sorted.map((node) => {
    const rect = rectOf(node)
    return rect.x + rect.width / 2
  })
  const targetCenterX = centerXs.reduce((sum, center) => sum + center, 0) / centerXs.length

  const first = rectOf(sorted[0]!)
  const last = rectOf(sorted[sorted.length - 1]!)
  const span = last.y + last.height - first.y
  const heightSum = sorted.reduce((sum, node) => sum + rectOf(node).height, 0)
  const gap = (span - heightSum) / (sorted.length - 1)

  mutate(graph, () => {
    let cursor = first.y
    for (const node of sorted) {
      const rect = rectOf(node)
      node.position(Math.round(targetCenterX - rect.width / 2), Math.round(cursor))
      cursor += rect.height + gap
    }
  })
  return true
}
