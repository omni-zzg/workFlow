// @vitest-environment jsdom
import { Graph } from '@antv/x6'
import { beforeAll, describe, expect, it } from 'vitest'

import type { ExitCondition, RawEdge, RawNode } from '@/schema'
import { initDocumentTracking, useDocument } from '@/stores/document'
import { initSelectionTracking, useSelection } from '@/stores/selection'

import { CellStateController } from './cellState'
import { createGraph } from './createGraph'
import { insertRawGraph, projectRawGraph } from './project'
import { NODE_TYPES, SHAPE_BY_NODE_TYPE } from './shapes'

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
})
