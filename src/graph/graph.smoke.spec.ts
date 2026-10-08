// @vitest-environment jsdom
import { Graph } from '@antv/x6'
import type { Edge, Node } from '@antv/x6'
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import NodePalette from '@/components/NodePalette.vue'
import { graphToSchema } from '@/schema'
import type { ExitCondition, RawEdge, RawNode } from '@/schema'
import { initDocumentTracking, useDocument } from '@/stores/document'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking, useSelection } from '@/stores/selection'
import { validate } from '@/validation'

import { CellStateController } from './cellState'
import { createGraph } from './createGraph'
import { readEdgeKind } from './edgeStyle'
import { removeSelectedCells } from './mutate'
import DecisionNode from './nodes/DecisionNode.vue'
import { insertRawGraph, isDuplicateConnection, projectRawGraph } from './project'
import { NODE_TYPES, SHAPE_BY_NODE_TYPE } from './shapes'
import { buildReactTemplateCells, insertReactTemplate } from './template'

/**
 * 图封装层的模型级冒烟测试（jsdom）：
 * 验证实例/插件、投影与撤销、态标注类名。节点视觉与交互仍由人工验收（design D13）。
 */

interface MatrixLike {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  [key: string]: unknown
}

/** 最小可用的 2D 仿射矩阵桩（X6 只读取 a-f 与少量链式方法） */
function matrixStub(init: Partial<MatrixLike> = {}): MatrixLike {
  const m: MatrixLike = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, ...init }
  m.multiply = (o: MatrixLike) =>
    matrixStub({ a: m.a * o.a, d: m.d * o.d, e: m.a * o.e + m.e, f: m.d * o.f + m.f })
  m.translate = (tx = 0, ty = 0) =>
    matrixStub({ a: m.a, b: m.b, c: m.c, d: m.d, e: m.e + m.a * tx, f: m.f + m.d * ty })
  m.scale = (sx = 1, sy = sx) =>
    matrixStub({ a: m.a * sx, b: m.b, c: m.c, d: m.d * sy, e: m.e, f: m.f })
  m.inverse = () =>
    matrixStub({
      a: m.a ? 1 / m.a : 1,
      b: m.b,
      c: m.c,
      d: m.d ? 1 / m.d : 1,
      e: m.a ? -m.e / m.a : 0,
      f: m.d ? -m.f / m.d : 0,
    })
  m.rotate = () => matrixStub({ a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f })
  return m
}

/** jsdom 缺失的浏览器 API（X6 渲染依赖） */
function installJsdomPolyfills(): void {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub })
  }

  const svgProto = (globalThis as { SVGElement?: { prototype: object } }).SVGElement?.prototype
  if (!svgProto) return
  if (!('getCTM' in svgProto)) {
    Object.defineProperty(svgProto, 'getCTM', { value: () => matrixStub() })
  }
  if (!('getScreenCTM' in svgProto)) {
    Object.defineProperty(svgProto, 'getScreenCTM', { value: () => matrixStub() })
  }
  if (!('createSVGMatrix' in svgProto)) {
    Object.defineProperty(svgProto, 'createSVGMatrix', { value: () => matrixStub() })
  }
  if (!('createSVGPoint' in svgProto)) {
    Object.defineProperty(svgProto, 'createSVGPoint', {
      value: () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) }),
    })
  }
}

beforeAll(() => {
  installJsdomPolyfills()
  // 真实节点渲染（vue-shape）由 registerNodes 注册；此处仅为投影逻辑提供等价 shape
  for (const type of NODE_TYPES) {
    Graph.registerNode(SHAPE_BY_NODE_TYPE[type], { inherit: 'rect', width: 100, height: 40 }, true)
  }
})

function makeGraph() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const graph = createGraph(container)
  return { graph, container }
}

/** 两节点一条 exit 边的最小图 */
function sampleRaw(): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodes: RawNode[] = [
    { id: 'n1', nodeType: 'start', x: 10, y: 10, data: { goal: '测试目标' } },
    { id: 'n2', nodeType: 'final', x: 10, y: 120, data: { answer: '答案' } },
  ]
  const edges: RawEdge[] = [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      kind: 'exit',
      condition: { type: 'max_iterations', params: { max: 3 } } satisfies ExitCondition,
    },
  ]
  return { nodes, edges }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

function labelTexts(edge: Edge): Array<string | undefined> {
  return edge.getLabels().map((label) => {
    const attrs = label.attrs as { label?: { text?: string } } | undefined
    return attrs?.label?.text
  })
}

describe('graph 冒烟：实例、插件、投影与撤销', () => {
  it('创建实例、插件就绪、dispose 无报错', () => {
    const { graph } = makeGraph()
    expect(graph.canUndo()).toBe(false)
    expect(graph.canRedo()).toBe(false)
    expect(() => graph.dispose()).not.toThrow()
  })

  it('程序化插入 → 投影一致 → 撤销整批恢复', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, sampleRaw())

    const projected = projectRawGraph(graph)
    expect(projected.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
    expect(projected.nodes.find((n) => n.id === 'n1')).toMatchObject({
      nodeType: 'start',
      data: { goal: '测试目标' },
    })
    const edge = projected.edges.find((e) => e.id === 'e1')
    expect(edge).toMatchObject({ kind: 'exit', source: 'n1', target: 'n2' })
    expect(edge?.condition).toEqual({ type: 'max_iterations', params: { max: 3 } })

    expect(graph.canUndo()).toBe(true)
    graph.undo()
    await flush()
    expect(graph.getNodes()).toHaveLength(0)
    expect(graph.getEdges()).toHaveLength(0)

    graph.redo()
    await flush()
    expect(graph.getNodes()).toHaveLength(2)
    graph.dispose()
  })

  it('态标注：类名可应用、可清除（cellView 容器）', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    const controller = new CellStateController(graph)
    controller.applyStates(new Map([['n1', 'error']]))

    const view = graph.findViewByCell('n1')
    expect(view).not.toBeNull()
    expect(view!.container.classList.contains('flow-state--error')).toBe(true)

    controller.applyStates(new Map())
    expect(view!.container.classList.contains('flow-state--error')).toBe(false)

    controller.flash('n1')
    expect(view!.container.classList.contains('flow-state--flash')).toBe(true)
    controller.clearAll()
    expect(view!.container.classList.contains('flow-state--flash')).toBe(false)

    graph.dispose()
  })

  it('store 联动：选中快照与文档状态为图的派生视图', async () => {
    const { graph } = makeGraph()
    const disposeSelection = initSelectionTracking(graph)
    const disposeDocument = initDocumentTracking(graph)
    const { nodeCount, dirty, markClean } = useDocument()

    markClean()
    insertRawGraph(graph, sampleRaw())
    await flush()
    expect(nodeCount.value).toBe(2)
    expect(dirty.value).toBe(true)

    graph.select(graph.getCellById('n1'))
    await flush()
    expect(useSelection().value).toEqual({ cellId: 'n1', kind: 'node' })

    // 多选 => 空态（spec: 选中多个对象时面板显示空态）
    graph.select([graph.getCellById('n1'), graph.getCellById('n2')])
    await flush()
    expect(useSelection().value).toBeNull()

    disposeSelection()
    disposeDocument()
    graph.dispose()
  })

  it('三类边样式：loop 虚线 +「循环」标签；exit 条件摘要标签；sequence 无标签', async () => {
    const { graph } = makeGraph()
    const nodes: RawNode[] = [
      { id: 'n1', nodeType: 'start', x: 0, y: 0, data: { goal: 'g' } },
      { id: 'n2', nodeType: 'thought', x: 0, y: 100, data: { content: 'c' } },
      { id: 'n3', nodeType: 'final', x: 220, y: 100, data: { answer: 'a' } },
    ]
    const edges: RawEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', kind: 'sequence', condition: null },
      { id: 'e2', source: 'n2', target: 'n1', kind: 'loop', condition: null },
      {
        id: 'e3',
        source: 'n1',
        target: 'n3',
        kind: 'exit',
        condition: { type: 'max_iterations', params: { max: 8 } },
      },
    ]
    insertRawGraph(graph, { nodes, edges })
    await flush()

    const loop = graph.getCellById('e2') as Edge
    expect(labelTexts(loop)).toEqual(['循环'])
    expect(loop.attr('line/strokeDasharray')).toBe('6 4')

    const exit = graph.getCellById('e3') as Edge
    expect(labelTexts(exit)).toEqual(['max=8'])
    expect(exit.attr('line/strokeDasharray')).toBeFalsy()

    const seq = graph.getCellById('e1') as Edge
    expect(seq.getLabels()).toHaveLength(0)

    graph.dispose()
  })

  it('decision 节点渲染退出条件徽标（无则占位，随边数据更新）', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, {
      nodes: [
        { id: 'd1', nodeType: 'decision', x: 0, y: 0, data: { criteria: '资料是否足够' } },
        { id: 'f1', nodeType: 'final', x: 220, y: 0, data: { answer: 'a' } },
      ],
      edges: [],
    })
    const node = graph.getCellById('d1') as Node

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(DecisionNode, { node, graph })
    app.mount(host)

    expect(host.textContent).toContain('未定义退出条件')
    expect(host.textContent).toContain('资料是否足够')

    graph.addEdge({
      id: 'e1',
      source: 'd1',
      target: 'f1',
      data: { kind: 'exit', condition: { type: 'goal_achieved' } },
    })
    await nextTick()
    await flush()
    expect(host.textContent).toContain('目标达成')
    expect(host.textContent).not.toContain('未定义退出条件')

    app.unmount()
    graph.dispose()
  })

  it('调色板点击创建：节点落在画布中心、数据为空并纳入撤销', async () => {
    const { graph } = makeGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(NodePalette)
    app.mount(host)

    const buttons = host.querySelectorAll('button')
    expect(buttons.length).toBe(7) // 六类节点 + 插入 ReAct 模板
    ;(buttons[0] as HTMLButtonElement).click()
    await flush()

    expect(graph.getNodes()).toHaveLength(1)
    expect(graph.getNodes()[0]!.getData()).toEqual({ goal: '' })
    expect(graph.canUndo()).toBe(true)

    app.unmount()
    setGraphRuntime(null)
    graph.dispose()
  })

  it('删除选中节点连带删边，撤销可恢复（spec 场景）', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    graph.select(graph.getCellById('n1'))
    removeSelectedCells(graph)
    await flush()
    expect(graph.getNodes()).toHaveLength(1)
    expect(graph.getEdges()).toHaveLength(0)

    graph.undo()
    await flush()
    expect(graph.getNodes()).toHaveLength(2)
    expect(graph.getEdges()).toHaveLength(1)
    graph.dispose()
  })

  it('新连线按拓扑自动识别回边（loop），且不产生额外撤销步骤', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, sampleRaw()) // n1 -> n2
    await flush()

    // n2 -> n1：n1 是 n2 的祖先，构成环 => loop
    const edge = graph.addEdge({ id: 'loop-edge', source: 'n2', target: 'n1' })
    await flush()
    expect(readEdgeKind(edge)).toBe('loop')
    expect(labelTexts(edge)).toEqual(['循环'])

    // 推断写入不计入独立撤销步骤：一次撤销即移除整条边
    graph.undo()
    await flush()
    expect(graph.getEdges().find((item) => item.id === 'loop-edge')).toBeUndefined()
    graph.dispose()
  })

  it('重复连线判定：同向已存在则拒绝，重连自身与反向连线除外', async () => {
    const { graph } = makeGraph()
    insertRawGraph(graph, sampleRaw()) // e1: n1 -> n2
    await flush()
    expect(isDuplicateConnection(graph, 'n1', 'n2')).toBe(true)
    expect(isDuplicateConnection(graph, 'n2', 'n1')).toBe(false) // 反向允许（构成回边）
    expect(isDuplicateConnection(graph, 'n1', 'n2', 'e1')).toBe(false) // 重连自身
    graph.dispose()
  })

  it('ReAct 模板：结构完整（四条顺序边 + loop + goal_achieved exit）且零校验问题', () => {
    const cells = buildReactTemplateCells()
    expect(cells.nodes).toHaveLength(6)
    const kinds = cells.edges.map((edge) => edge.kind)
    expect(kinds.filter((kind) => kind === 'sequence')).toHaveLength(4)
    expect(kinds.filter((kind) => kind === 'loop')).toHaveLength(1)
    expect(kinds.filter((kind) => kind === 'exit')).toHaveLength(1)
    expect(cells.edges.find((edge) => edge.kind === 'exit')?.condition).toEqual({
      type: 'goal_achieved',
    })

    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: cells.meta })
    expect(validate(schema)).toEqual([])
  })

  it('插入模板：可重复插入且 id 不冲突', async () => {
    const { graph } = makeGraph()
    insertReactTemplate(graph)
    insertReactTemplate(graph)
    await flush()
    expect(graph.getNodes()).toHaveLength(12)
    expect(graph.getEdges()).toHaveLength(12)
    graph.dispose()
  })
})
