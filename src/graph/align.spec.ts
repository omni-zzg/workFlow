// @vitest-environment jsdom
import type { Node } from '@antv/x6'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
} from '@/testing/graphTestUtils'

import {
  alignHorizontalCenter,
  alignVerticalCenter,
  distributeHorizontally,
  distributeVertically,
} from './align'

/**
 * 居中与对称分布（散开·轴对称语义，spec: flow-canvas-editing）：
 * jsdom 中容器尺寸为 0，画布中线即图坐标原点 (0, 0)。
 */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

function addNode(
  graph: ReturnType<typeof makeTestGraph>['graph'],
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 40,
): Node {
  return graph.addNode({ id, shape: 'flow-task', x, y, width, height, data: {} })
}

describe('居中（整组平移到画布中线，不拆散）', () => {
  it('水平居中：整体水平移动到画布垂直中线，可单步撤销', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 200, 100)
    graph.select([a, b])
    await flush()

    // 组水平中心 150 → 中线 0，整体平移 dx=-150
    expect(alignHorizontalCenter(graph)).toBe(true)
    await flush()
    expect(a.getPosition()).toMatchObject({ x: -150, y: 0 })
    expect(b.getPosition()).toMatchObject({ x: 50, y: 100 }) // Y 不变（不拆散）

    graph.undo()
    await flush()
    expect(a.getPosition().x).toBe(0)
    expect(b.getPosition().x).toBe(200)

    graph.dispose()
  })

  it('垂直居中：整体垂直移动到画布水平中线（X 不变）', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 300, 200)
    graph.select([a, b])
    await flush()

    // 组垂直中心 120 → 中线 0，整体平移 dy=-120
    expect(alignVerticalCenter(graph)).toBe(true)
    await flush()
    expect(a.getPosition()).toMatchObject({ x: 0, y: -120 })
    expect(b.getPosition()).toMatchObject({ x: 300, y: 80 })

    graph.dispose()
  })
})

describe('对称分布（按行/列以中线为轴展开，单节点行/列不动）', () => {
  it('横等距：多节点行左右对称等距展开，单节点行保持原位', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 500, 0)
    const c = addNode(graph, 'c', 200, 200)
    graph.select([a, b, c])
    await flush()

    expect(distributeHorizontally(graph)).toBe(true)
    await flush()
    // 第 1 行 [a,b]：跨度 600、宽总和 200 → 间隙 400，以中线 0 为中心 → -300 / 200
    expect(a.getPosition()).toMatchObject({ x: -300, y: 0 })
    expect(b.getPosition()).toMatchObject({ x: 200, y: 0 })
    // 单节点行 c：保持原位（散开）
    expect(c.getPosition()).toMatchObject({ x: 200, y: 200 })

    graph.dispose()
  })

  it('纵等距：多节点列上下对称等距展开，单节点列保持原位', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 0, 500)
    const c = addNode(graph, 'c', 300, 200)
    graph.select([a, b, c])
    await flush()

    expect(distributeVertically(graph)).toBe(true)
    await flush()
    // 第 1 列 [a,b]：跨度 540、高总和 80 → 间隙 460，以中线 0 为中心 → -270 / 230
    expect(a.getPosition()).toMatchObject({ x: 0, y: -270 })
    expect(b.getPosition()).toMatchObject({ x: 0, y: 230 })
    // 单节点列 c：保持原位
    expect(c.getPosition()).toMatchObject({ x: 300, y: 200 })

    graph.dispose()
  })

  it('选中数量不足：选中 1 个节点时分布不可用（居中可用）', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 100, 100)
    graph.select([a])
    await flush()

    expect(distributeHorizontally(graph)).toBe(false)
    expect(distributeVertically(graph)).toBe(false)

    // 单个节点也可居中（整体中心 = 自身中心）
    expect(alignHorizontalCenter(graph)).toBe(true)
    await flush()
    expect(a.getPosition().x).toBe(-50)

    graph.dispose()
  })
})
