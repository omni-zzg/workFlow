// @vitest-environment jsdom
import type { Edge, Node } from '@antv/x6'
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import NodePalette from '@/components/NodePalette.vue'
import { graphToSchema } from '@/schema'
import { initDocumentTracking, useDocument } from '@/stores/document'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking, useSelection } from '@/stores/selection'
import {
  flush,
  installJsdomPolyfills,
  labelTexts,
  makeTestGraph,
  registerStubShapes,
  sampleRaw,
} from '@/testing/graphTestUtils'
import { validate } from '@/validation'

import { CellStateController } from './cellState'
import { readEdgeKind } from './edgeStyle'
import { removeSelectedCells } from './mutate'
import TaskNode from './nodes/TaskNode.vue'
import { insertRawGraph, isDuplicateConnection, projectRawGraph } from './project'
import { buildReactTemplateCells, insertReactTemplate } from './template'

/**
 * 图封装层的模型级冒烟测试（jsdom）：
 * 验证实例/插件、投影与撤销、态标注、任务卡片骨架、连线与模板。交互仍由人工验收。
 */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

describe('graph 冒烟：实例、插件、投影与撤销', () => {
  it('创建实例、插件就绪、dispose 无报错', () => {
    const { graph } = makeTestGraph()
    expect(graph.canUndo()).toBe(false)
    expect(graph.canRedo()).toBe(false)
    expect(() => graph.dispose()).not.toThrow()
  })

  it('程序化插入 → 投影一致 → 撤销整批恢复', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())

    const projected = projectRawGraph(graph)
    expect(projected.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3'])
    expect(projected.nodes.find((n) => n.id === 'n2')).toMatchObject({
      nodeType: 'task',
      data: { name: '测试任务', precondition: '前提' },
    })
    const edge = projected.edges.find((e) => e.id === 'e2')
    expect(edge).toMatchObject({ kind: 'normal', source: 'n2', target: 'n3' })

    expect(graph.canUndo()).toBe(true)
    graph.undo()
    await flush()
    expect(graph.getNodes()).toHaveLength(0)
    expect(graph.getEdges()).toHaveLength(0)

    graph.redo()
    await flush()
    expect(graph.getNodes()).toHaveLength(3)
    graph.dispose()
  })

  it('节点带四向连接点：视图存在 4 个 magnet 元素（鼠标由此创建连线）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    const view = graph.findViewByCell('n2')
    expect(view).not.toBeNull()
    const magnets = [...view!.container.querySelectorAll('[magnet]')]
    expect(magnets).toHaveLength(4)
    const portIds = magnets
      .map((element) => element.closest('[port]')?.getAttribute('port'))
      .sort()
    expect(portIds).toEqual(['port-bottom', 'port-left', 'port-right', 'port-top'])

    graph.dispose()
  })

  it('连线自带端点抓手（起点/终点各一，可直接拖动改接端点）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    const edge = graph.getCellById('e2') as Edge
    expect(edge.getTools()?.items).toHaveLength(2)
    // 抓手挂在与图装饰层（decorator），命中层级高于节点
    const decorator = graph.view.decorator
    expect(decorator.querySelector('.x6-edge-tool-source-arrowhead')).not.toBeNull()
    expect(decorator.querySelector('.x6-edge-tool-target-arrowhead')).not.toBeNull()

    graph.dispose()
  })

  it('态标注：类名可应用、可清除（cellView 容器）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    const controller = new CellStateController(graph)
    controller.applyStates(new Map([['n2', 'error']]))

    const view = graph.findViewByCell('n2')
    expect(view).not.toBeNull()
    expect(view!.container.classList.contains('flow-state--error')).toBe(true)

    controller.applyStates(new Map())
    expect(view!.container.classList.contains('flow-state--error')).toBe(false)

    controller.flash('n2')
    expect(view!.container.classList.contains('flow-state--flash')).toBe(true)
    controller.clearAll()
    expect(view!.container.classList.contains('flow-state--flash')).toBe(false)

    graph.dispose()
  })

  it('store 联动：选中快照与文档状态为图的派生视图', async () => {
    const { graph } = makeTestGraph()
    const disposeSelection = initSelectionTracking(graph)
    const disposeDocument = initDocumentTracking(graph)
    const { nodeCount, dirty, markClean } = useDocument()

    markClean()
    insertRawGraph(graph, sampleRaw())
    await flush()
    expect(nodeCount.value).toBe(3)
    expect(dirty.value).toBe(true)

    graph.select(graph.getCellById('n2'))
    await flush()
    expect(useSelection().value).toEqual({ cellId: 'n2', kind: 'node' })

    // 多选 => 空态（spec: 选中多个对象时面板显示空态）
    graph.select([graph.getCellById('n1'), graph.getCellById('n2')])
    await flush()
    expect(useSelection().value).toBeNull()

    disposeSelection()
    disposeDocument()
    graph.dispose()
  })

  it('两类边样式：normal 实线无标签；exception 橙虚线 +「异常」标签', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    const normalEdge = graph.getCellById('e2') as Edge
    expect(normalEdge.getLabels()).toHaveLength(0)
    expect(normalEdge.attr('line/strokeDasharray')).toBeFalsy()

    const exceptionEdge = graph.getCellById('e3') as Edge
    expect(labelTexts(exceptionEdge)).toEqual(['异常'])
    expect(exceptionEdge.attr('line/strokeDasharray')).toBe('6 4')

    // 普通连线的起点边同样无标签
    const startEdge = graph.getCellById('e1') as Edge
    expect(startEdge.getLabels()).toHaveLength(0)

    graph.dispose()
  })

  it('任务卡片常驻 ReAct 骨架：内容随数据更新（含退出条件徽标与占位）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const node = graph.getCellById('n2') as Node

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(TaskNode, { node, graph })
    app.mount(host)

    // 骨架摘要
    expect(host.textContent).toContain('测试任务')
    expect(host.textContent).toContain('输入')
    expect(host.textContent).toContain('思考')
    expect(host.textContent).toContain('观察')
    expect(host.textContent).toContain('目标达成') // 退出条件徽标
    expect(host.textContent).toContain('前提')
    expect(host.textContent).toContain('失败重试 ≤3')

    // 更新数据（names / 退出条件）→ 即时刷新
    const current = node.getData<Record<string, unknown>>()
    node.replaceData({
      ...current,
      name: '新任务名',
      loop: { exitConditions: [{ type: 'error' }] },
    })
    await nextTick()
    expect(host.textContent).toContain('新任务名')
    expect(host.textContent).toContain('异常终止')
    expect(host.textContent).not.toContain('目标达成')

    // 清空退出条件 → 占位
    node.replaceData({ ...node.getData<Record<string, unknown>>(), loop: { exitConditions: [] } })
    await nextTick()
    expect(host.textContent).toContain('未定义退出条件')

    app.unmount()
    graph.dispose()
  })

  it('调色板点击创建：三类节点 + 模板按钮，创建节点落于画布且数据为空', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(NodePalette)
    app.mount(host)

    const buttons = host.querySelectorAll('button')
    expect(buttons.length).toBe(4) // 三类节点 + 插入任务流模板
    ;(buttons[1] as HTMLButtonElement).click() // 任务
    await flush()

    expect(graph.getNodes()).toHaveLength(1)
    const node = graph.getNodes()[0]!
    expect(node.shape).toBe('flow-task')
    const data = node.getData<{ name: string; steps: unknown[] }>()
    expect(data.name).toBe('')
    expect(data.steps).toHaveLength(1) // 新任务自带一个空步骤

    app.unmount()
    setGraphRuntime(null)
    graph.dispose()
  })

  it('删除选中节点连带删边，撤销可恢复（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    graph.select(graph.getCellById('n2'))
    removeSelectedCells(graph)
    await flush()
    expect(graph.getNodes()).toHaveLength(2)
    expect(graph.getEdges()).toHaveLength(0)

    graph.undo()
    await flush()
    expect(graph.getNodes()).toHaveLength(3)
    expect(graph.getEdges()).toHaveLength(3)
    graph.dispose()
  })

  it('新连线默认 normal（不做回边自动识别），且不产生额外撤销步骤', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()

    // n2 -> n1 构成环，但按普通连线模型不做任何自动识别
    const edge = graph.addEdge({ id: 'back-edge', source: 'n2', target: 'n1' })
    await flush()
    expect(readEdgeKind(edge)).toBe('normal')
    expect(edge.getLabels()).toHaveLength(0)

    graph.undo()
    await flush()
    expect(graph.getEdges().find((item) => item.id === 'back-edge')).toBeUndefined()
    graph.dispose()
  })

  it('重复连线判定按 (source, target, kind)：同向同类拒绝，异类允许', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    expect(isDuplicateConnection(graph, 'n2', 'n3', 'normal')).toBe(true) // e2
    expect(isDuplicateConnection(graph, 'n2', 'n3', 'exception')).toBe(true) // e3
    expect(isDuplicateConnection(graph, 'n1', 'n2', 'exception')).toBe(false) // 仅存在 normal
    expect(isDuplicateConnection(graph, 'n2', 'n3', 'normal', 'e2')).toBe(false) // 重连自身
    graph.dispose()
  })

  it('任务流模板：开始 → 任务1 → 任务2 → 结束（三条普通连线）且零校验问题', () => {
    const cells = buildReactTemplateCells()
    expect(cells.nodes).toHaveLength(4)
    expect(cells.nodes.map((node) => node.nodeType)).toEqual(['start', 'task', 'task', 'final'])
    expect(cells.edges).toHaveLength(3)
    expect(cells.edges.every((edge) => edge.kind === 'normal')).toBe(true)
    expect(cells.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      'tpl-start->tpl-task-1',
      'tpl-task-1->tpl-task-2',
      'tpl-task-2->tpl-final',
    ])

    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: cells.meta })
    expect(validate(schema)).toEqual([])
  })

  it('插入模板：可重复插入且 id 不冲突', async () => {
    const { graph } = makeTestGraph()
    insertReactTemplate(graph)
    insertReactTemplate(graph)
    await flush()
    expect(graph.getNodes()).toHaveLength(8)
    expect(graph.getEdges()).toHaveLength(6)
    graph.dispose()
  })
})
