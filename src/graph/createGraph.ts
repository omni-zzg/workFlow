import { Graph } from '@antv/x6'
import type { Edge } from '@antv/x6'
import { Clipboard } from '@antv/x6-plugin-clipboard'
import { History } from '@antv/x6-plugin-history'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Selection } from '@antv/x6-plugin-selection'
import { Snapline } from '@antv/x6-plugin-snapline'

import { applyEdgeStyle } from './edgeStyle'
import type { EdgeCellData } from './edgeStyle'
import { removeSelectedCells } from './mutate'
import { inferEdgeKind, isDuplicateConnection } from './project'

export interface CreateGraphOptions {
  /** 连线被拒绝时的提示回调（如重复连线，spec 要求给出提示） */
  onConnectionRejected?: (reason: string) => void
}

/**
 * 样式类变更不纳入撤销历史：边样式由 cell.data 派生（applyEdgeStyle），撤销恢复数据后样式会自动重算。
 * 注意：history 的 beforeAddCommand 收到的事件名是通配的 'cell:change:*'，具体字段在 args.key。
 */
const NON_UNDOABLE_CHANGE_KEYS = new Set<string>([
  'attrs',
  'router',
  'connector',
  'labels',
  'vertices',
])

function shouldRecordHistory(event: string, args: unknown): boolean {
  if (event === 'cell:change:*') {
    const key = (args as { key?: string }).key
    if (key !== undefined && NON_UNDOABLE_CHANGE_KEYS.has(key)) return false
  }
  return true
}

/**
 * 回边自动识别（spec: flow-canvas-editing）：用户新连线若指向源节点的祖先则标记为 loop。
 * sequence 为缺省值（无需写入）；推断写入使用 X6 的 dryrun 选项，不占独立撤销步骤。
 */
function inferKindForNewEdge(graph: Graph, edge: Edge): void {
  const data = edge.getData<EdgeCellData>()
  if (data?.kind) return // 程序化插入/导入的边自带 kind

  const sourceId = edge.getSourceCellId()
  const targetId = edge.getTargetCellId()
  if (!sourceId || !targetId) return

  const kind = inferEdgeKind(graph, sourceId, targetId)
  if (kind === 'sequence') return

  edge.setData({ kind }, { dryrun: true })
}

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
      validateConnection: ({ sourceCell, targetCell, edge }) => {
        if (!sourceCell || !targetCell) return false
        if (sourceCell.id === targetCell.id) return false
        if (isDuplicateConnection(graph, sourceCell.id, targetCell.id, edge?.id)) {
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
      beforeAddCommand: (event, args) => shouldRecordHistory(event, args),
    }),
  )
  graph.use(new Keyboard({ enabled: true, global: false }))
  graph.use(new Clipboard({ enabled: true }))

  // 新边：推断 kind（回边识别）后重算样式；数据变更后同步样式（撤销/重做后保持一致）
  graph.on('edge:added', ({ edge }) => {
    inferKindForNewEdge(graph, edge)
    applyEdgeStyle(edge)
  })
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
