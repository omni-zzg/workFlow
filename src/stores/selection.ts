import { shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import type { Graph } from '@antv/x6'

/**
 * 选中状态（属性面板的输入）。
 * 单选时给出 cellId 与对象类别；未选中或多选时为 null（spec: 选中多个显示空态）。
 */
export interface SelectionSnapshot {
  cellId: string
  kind: 'node' | 'edge'
}

const selected = shallowRef<SelectionSnapshot | null>(null)

export function useSelection(): ShallowRef<SelectionSnapshot | null> {
  return selected
}

export function initSelectionTracking(graph: Graph): () => void {
  const update = (): void => {
    const cells = graph.getSelectedCells()
    if (cells.length === 1) {
      const cell = cells[0]!
      selected.value = { cellId: cell.id, kind: cell.isNode() ? 'node' : 'edge' }
    } else {
      selected.value = null
    }
  }

  graph.on('selection:changed', update)
  update()

  return () => {
    graph.off('selection:changed', update)
    selected.value = null
  }
}
