import { Graph } from '@antv/x6'
import { Clipboard } from '@antv/x6-plugin-clipboard'
import { History } from '@antv/x6-plugin-history'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Selection } from '@antv/x6-plugin-selection'
import { Snapline } from '@antv/x6-plugin-snapline'

import { applyEdgeStyle } from './edgeStyle'
import { removeSelectedCells } from './mutate'

export interface CreateGraphOptions {
  /** 连线被拒绝时的提示回调（如重复连线，spec 要求给出提示） */
  onConnectionRejected?: (reason: string) => void
}

/**
 * 样式类事件不纳入撤销历史：边样式由 cell.data 派生（applyEdgeStyle），
 * 撤销恢复数据后样式会自动重算，避免产生多余的撤销步骤。
 */
const HISTORY_FILTERED_EVENTS = new Set<string>([
  'cell:change:attrs',
  'cell:change:router',
  'cell:change:connector',
  'cell:change:labels',
])

/** 创建并配置图实例（插件、交互、快捷键）；调用方负责 dispose */
export function createGraph(container: HTMLElement, options: CreateGraphOptions = {}): Graph {
  const graph = new Graph({
    container,
    autoResize: true,
    background: { color: '#f6f7f9' },
    grid: { visible: true, type: 'dot', size: 12, args: { color: '#d9dde5', thickness: 1 } },
    panning: {
      enabled: true,
      modifiers: 'space',
      eventTypes: ['leftMouseDown', 'rightMouseDown'],
    },
    mousewheel: {
      enabled: true,
      modifiers: [],
      minScale: 0.25,
      maxScale: 2.5,
      zoomAtMousePosition: true,
    },
    connecting: {
      snap: { radius: 24 },
      allowBlank: false,
      allowLoop: false,
      allowEdge: false,
      // 重复连线由 validateConnection 显式判断，以便给出提示
      allowMulti: true,
      highlight: true,
      router: { name: 'manhattan', args: { padding: 16 } },
      connector: { name: 'rounded', args: { radius: 8 } },
      validateConnection: ({ sourceCell, targetCell }) => {
        if (!sourceCell || !targetCell) return false
        if (sourceCell.id === targetCell.id) return false
        const isDuplicate = graph
          .getEdges()
          .some(
            (edge) =>
              edge.getSourceCellId() === sourceCell.id &&
              edge.getTargetCellId() === targetCell.id,
          )
        if (isDuplicate) {
          options.onConnectionRejected?.('已存在同方向的连线')
          return false
        }
        return true
      },
    },
  })

  graph.use(
    new Selection({ enabled: true, multiple: true, rubberband: true, showNodeSelectionBox: true }),
  )
  graph.use(new Snapline({ enabled: true, sharp: true }))
  graph.use(
    new History({
      enabled: true,
      stackSize: 100,
      beforeAddCommand: (event) => !HISTORY_FILTERED_EVENTS.has(event),
    }),
  )
  graph.use(new Keyboard({ enabled: true, global: false }))
  graph.use(new Clipboard({ enabled: true }))

  // 新边与数据变更后重算样式（撤销/重做后保持一致）
  graph.on('edge:added', ({ edge }) => applyEdgeStyle(edge))
  graph.on('edge:change:data', ({ edge }) => applyEdgeStyle(edge))

  bindShortcuts(graph)
  return graph
}

function bindShortcuts(graph: Graph): void {
  graph.bindKey(['delete', 'backspace'], () => {
    removeSelectedCells(graph)
    return false
  })
  graph.bindKey(['ctrl+z', 'meta+z'], () => {
    if (graph.canUndo()) graph.undo()
    return false
  })
  graph.bindKey(['ctrl+shift+z', 'meta+shift+z', 'ctrl+y'], () => {
    if (graph.canRedo()) graph.redo()
    return false
  })
  graph.bindKey(['ctrl+c', 'meta+c'], () => {
    graph.copy(graph.getSelectedCells())
    return false
  })
  graph.bindKey(['ctrl+x', 'meta+x'], () => {
    graph.cut(graph.getSelectedCells())
    return false
  })
  graph.bindKey(['ctrl+v', 'meta+v'], () => {
    graph.paste({ offset: 24 })
    return false
  })
  graph.bindKey(['ctrl+a', 'meta+a'], () => {
    graph.select(graph.getCells())
    return false
  })
}
