import type { Graph } from '@antv/x6'

const BATCH_NAME = 'flow-mutate'

/**
 * 统一修改包装（design D7）：所有程序化修改（含属性面板）经此执行。
 * batch 内的多次变更合并为一次撤销单元。
 */
export function mutate<T>(graph: Graph, fn: () => T): T {
  graph.startBatch(BATCH_NAME)
  try {
    return fn()
  } finally {
    graph.stopBatch(BATCH_NAME)
  }
}

/** 删除全部选中 cell（关联连线由 X6 一并处理） */
export function removeSelectedCells(graph: Graph): void {
  const cells = graph.getSelectedCells()
  if (cells.length === 0) return
  mutate(graph, () => {
    graph.removeCells(cells)
  })
}
