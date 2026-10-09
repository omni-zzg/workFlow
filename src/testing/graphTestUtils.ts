import { Graph } from '@antv/x6'
import type { Edge } from '@antv/x6'

import { createGraph } from '@/graph/createGraph'
import { NODE_TYPES, SHAPE_BY_NODE_TYPE } from '@/graph/shapes'
import type { RawEdge, RawNode } from '@/schema'

/** jsdom 冒烟测试的共享夹具（仅测试使用，不进入应用包） */

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
export function installJsdomPolyfills(): void {
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

/** 真实节点渲染（vue-shape）由 registerNodes 注册；测试仅为投影逻辑提供等价 shape */
export function registerStubShapes(): void {
  for (const type of NODE_TYPES) {
    Graph.registerNode(SHAPE_BY_NODE_TYPE[type], { inherit: 'rect', width: 100, height: 40 }, true)
  }
}

export function makeTestGraph(): { graph: Graph; container: HTMLDivElement } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const graph = createGraph(container)
  return { graph, container }
}

/** 最小任务流：start → task → final，含普通连线与异常出口 */
export function sampleRaw(): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodes: RawNode[] = [
    { id: 'n1', nodeType: 'start', x: 10, y: 10, data: { goal: '测试目标' } },
    {
      id: 'n2',
      nodeType: 'task',
      x: 10,
      y: 120,
      data: {
        name: '测试任务',
        goal: '完成任务',
        input: '输入',
        steps: [
          {
            id: 'n2-s1',
            thought: '思考',
            actions: [{ name: 'tool', params: { k: 'v' } }],
            observation: '观察',
          },
        ],
        loop: { exitConditions: [{ type: 'goal_achieved' }] },
        precondition: '前提',
        onFailure: { reflection: '反思', replan: '重规划', maxRetries: 3 },
      },
    },
    { id: 'n3', nodeType: 'final', x: 10, y: 400, data: { answer: '答案' } },
  ]
  const edges: RawEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2', kind: 'normal' },
    { id: 'e2', source: 'n2', target: 'n3', kind: 'normal' },
    { id: 'e3', source: 'n2', target: 'n3', kind: 'exception' },
  ]
  return { nodes, edges }
}

export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

export function labelTexts(edge: Edge): Array<string | undefined> {
  return edge.getLabels().map((label) => {
    const attrs = label.attrs as { label?: { text?: string } } | undefined
    return attrs?.label?.text
  })
}
