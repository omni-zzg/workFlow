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

/** 节点对齐与对称分布（spec: flow-canvas-editing 的场景级验证） */

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

function centerY(node: Node): number {
  return node.getPosition().y + node.getSize().height / 2
}

function centerX(node: Node): number {
  return node.getPosition().x + node.getSize().width / 2
}

describe('节点对齐与分布', () => {
  it('水平居中：中心 Y 对齐到平均中线，可单步撤销', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 200, 100)
    graph.select([a, b])
    await flush()

    expect(alignHorizontalCenter(graph)).toBe(true)
    await flush()
    expect(centerY(a)).toBe(70)
    expect(centerY(b)).toBe(70)

    graph.undo()
    await flush()
    expect(a.getPosition().y).toBe(0)
    expect(b.getPosition().y).toBe(100)

    graph.dispose()
  })

  it('垂直居中：中心 X 对齐到平均中线', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 200, 300)
    graph.select([a, b])
    await flush()

    expect(alignVerticalCenter(graph)).toBe(true)
    await flush()
    expect(centerX(a)).toBe(150)
    expect(centerX(b)).toBe(150)

    graph.dispose()
  })

  it('横等距（对称分布）：先对齐水平中线，再横向等距、左右对称', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 150, 100)
    const c = addNode(graph, 'c', 500, 50)
    graph.select([a, b, c])
    await flush()

    expect(distributeHorizontally(graph)).toBe(true)
    await flush()
    // 中线：平均中心 Y = (20 + 120 + 70) / 3 = 70 → 全部对齐（高 40 → y=50）
    expect(centerY(a)).toBe(70)
    expect(centerY(b)).toBe(70)
    expect(centerY(c)).toBe(70)
    // 横向等距：跨度 600、宽总和 300 → 间隙 150：a 不动、b=250、c 不动
    expect(a.getPosition().x).toBe(0)
    expect(b.getPosition().x).toBe(250)
    expect(c.getPosition().x).toBe(500)

    graph.dispose()
  })

  it('纵等距（对称分布）：先对齐垂直中线，再纵向等距、上下对称', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    const b = addNode(graph, 'b', 300, 50)
    const c = addNode(graph, 'c', 100, 400)
    graph.select([a, b, c])
    await flush()

    expect(distributeVertically(graph)).toBe(true)
    await flush()
    // 中线：平均中心 X = (50 + 350 + 150) / 3 ≈ 183.33 → x = round(183.33 - 50) = 133
    expect(centerX(a)).toBe(183)
    expect(centerX(b)).toBe(183)
    expect(centerX(c)).toBe(183)
    // 纵向等距：跨度 440、高总和 120 → 间隙 160：a=0、b=200、c 不动
    expect(a.getPosition().y).toBe(0)
    expect(b.getPosition().y).toBe(200)
    expect(c.getPosition().y).toBe(400)

    graph.dispose()
  })

  it('选中数量不足时返回 false（居中需 ≥2、分布需 ≥3）', async () => {
    const { graph } = makeTestGraph()
    const a = addNode(graph, 'a', 0, 0)
    graph.select([a])
    await flush()

    expect(alignHorizontalCenter(graph)).toBe(false)
    expect(alignVerticalCenter(graph)).toBe(false)
    expect(distributeHorizontally(graph)).toBe(false)
    expect(distributeVertically(graph)).toBe(false)

    graph.dispose()
  })
})
