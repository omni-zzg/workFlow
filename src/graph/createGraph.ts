import { Graph } from '@antv/x6'
import type { Edge, Node } from '@antv/x6'
import { Clipboard } from '@antv/x6-plugin-clipboard'
import { Transform } from '@antv/x6-plugin-transform'
import { History } from '@antv/x6-plugin-history'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Selection } from '@antv/x6-plugin-selection'
import { Snapline } from '@antv/x6-plugin-snapline'

import { applyEdgeStyle, createEdgeEndpointTools } from './edgeStyle'
import type { EdgeCellData } from './edgeStyle'
import { mutate, removeSelectedCells } from './mutate'
import { isDuplicateConnection } from './project'
import { NODE_PORT_IDS } from './shapes'

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

/** 导入/模板恢复连线时的缺省连接点（源出底部、目标入顶部） */
const DEFAULT_ENDPOINT_PORTS = { source: NODE_PORT_IDS.bottom, target: NODE_PORT_IDS.top } as const

/** 按落点方向选择节点上最近的连接点 */
function nearestPortForPoint(node: Node, point: { x: number; y: number }): string {
  const center = node.getBBox().getCenter()
  const dx = point.x - center.x
  const dy = point.y - center.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? NODE_PORT_IDS.right : NODE_PORT_IDS.left
  }
  return dy >= 0 ? NODE_PORT_IDS.bottom : NODE_PORT_IDS.top
}

/**
 * 端点固定到具体连接点（spec: flow-canvas-editing「连线端点稳定」）：
 * X6 缺省端点基于 bbox 锚点，空间不足时会自动切换到节点其他侧；这里在连线建立/改接后
 * 把缺省端点改写为具体连接点（鼠标操作按落点方向取最近侧，导入/模板用缺省值），
 * 此后端点不随布局自动变化，仅用户改接时才改变。
 */
function anchorEdgeTerminals(
  graph: Graph,
  edge: Edge,
  pointer?: { clientX: number; clientY: number },
): void {
  for (const type of ['source', 'target'] as const) {
    const terminal = (type === 'source' ? edge.getSource() : edge.getTarget()) as {
      cell?: string
      port?: string
    }
    const cellId = terminal.cell
    if (!cellId || terminal.port) continue
    const node = graph.getCellById(cellId)
    if (!node || !node.isNode()) continue
    const port = pointer
      ? nearestPortForPoint(node, graph.clientToLocal(pointer.clientX, pointer.clientY))
      : DEFAULT_ENDPOINT_PORTS[type]
    mutate(graph, () => {
      edge.setTerminal(type, { cell: cellId, port })
    })
  }
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
      // 拖拽画布空白处直接平移（Shift+拖拽留给框选）
      modifiers: null,
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
      // 交互创建的连线同样自带端点抓手（可拖动改接）
      createEdge() {
        return this.createEdge({ tools: createEdgeEndpointTools() })
      },
      validateConnection: ({ sourceCell, targetCell, edge }) => {
        if (!sourceCell || !targetCell) return false
        if (sourceCell.id === targetCell.id) return false
        // 新连线默认 normal；重连既有边时按其自身 kind 判重——允许同向不同 kind（普通 + 异常出口并存）
        const prospectiveKind = edge?.getData<EdgeCellData>()?.kind ?? 'normal'
        if (isDuplicateConnection(graph, sourceCell.id, targetCell.id, prospectiveKind, edge?.id)) {
          options.onConnectionRejected?.('已存在同方向的同类连线')
          return false
        }
        return true
      },
    },
  })

  graph.use(
    new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      // 框选需按住 Shift（空白处直接拖拽为平移画布）
      modifiers: 'shift',
      // 多选也统一为 Shift+点击（Ctrl/⌘+点击同样可用）
      multipleSelectionModifiers: ['shift', 'ctrl', 'meta'],
      showNodeSelectionBox: true,
    }),
  )
  graph.use(
    new Transform({
      // 选中节点后拖拽控制点调整大小（尺寸随文档持久化，见 spec: flow-canvas-editing）
      resizing: { enabled: true, minWidth: 140, minHeight: 60, preserveAspectRatio: false },
      rotating: false,
    }),
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

  // 新边默认 normal（不做自动识别）；数据变更后同步样式（撤销/重做后保持一致）
  graph.on('edge:added', ({ edge }) => applyEdgeStyle(edge))
  graph.on('edge:change:data', ({ edge }) => applyEdgeStyle(edge))
  // 连线建立/改接完成后固定端点到具体连接点（不再自动漂移）
  graph.on('edge:connected', ({ edge, e }) => anchorEdgeTerminals(graph, edge, e))

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
