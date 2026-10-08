// @vitest-environment jsdom
import type { Edge } from '@antv/x6'
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { readEdgeCondition } from '@/graph/edgeStyle'
import { insertRawGraph, projectRawGraph } from '@/graph/project'
import { graphToSchema } from '@/schema'
import type { RawEdge, RawNode } from '@/schema'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking } from '@/stores/selection'
import {
  flush,
  installJsdomPolyfills,
  labelTexts,
  makeTestGraph,
  registerStubShapes,
  sampleRaw,
} from '@/testing/graphTestUtils'
import { validate } from '@/validation'

import PropertyPanel from './PropertyPanel.vue'

/** 属性面板冒烟测试（spec: flow-property-editing 的场景级验证） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

function mountPanel(graph: ReturnType<typeof makeTestGraph>['graph'], cellId: string) {
  setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
  const disposeSelection = initSelectionTracking(graph)
  graph.select(graph.getCellById(cellId))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(PropertyPanel)
  app.mount(host)
  return {
    host,
    cleanup: () => {
      app.unmount()
      disposeSelection()
      setGraphRuntime(null)
      graph.dispose()
    },
  }
}

describe('属性面板', () => {
  it('空态：未选中时显示提示', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
    const disposeSelection = initSelectionTracking(graph)

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(PropertyPanel)
    app.mount(host)
    await nextTick()

    expect(host.textContent).toContain('选中一个节点或连线以编辑属性')

    app.unmount()
    disposeSelection()
    setGraphRuntime(null)
    graph.dispose()
  })

  it('六类节点表单字段正确，必填项有标注（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    const nodes: RawNode[] = [
      { id: 's', nodeType: 'start', x: 0, y: 0, data: { goal: 'g' } },
      { id: 't', nodeType: 'thought', x: 0, y: 80, data: { content: 'c' } },
      {
        id: 'a',
        nodeType: 'action',
        x: 0,
        y: 160,
        data: { tool: { name: 'get_weather', params: { city: '北京' } } },
      },
      { id: 'o', nodeType: 'observation', x: 0, y: 240, data: { content: 'r' } },
      { id: 'd', nodeType: 'decision', x: 0, y: 320, data: { criteria: 'q' } },
      { id: 'f', nodeType: 'final', x: 0, y: 400, data: { answer: 'a' } },
    ]
    insertRawGraph(graph, { nodes, edges: [] })
    await flush()
    const { host, cleanup } = mountPanel(graph, 's')
    await nextTick()

    expect(host.textContent).toContain('任务目标')
    expect(host.textContent).toContain('必填')

    graph.resetSelection(graph.getCellById('t'))
    await nextTick()
    expect(host.textContent).toContain('推理内容')

    graph.resetSelection(graph.getCellById('a'))
    await nextTick()
    expect(host.textContent).toContain('工具名')
    expect(host.textContent).toContain('工具参数')
    expect(host.textContent).toContain('必填')
    const inputs = host.querySelectorAll('input')
    const values = [...inputs].map((input) => input.value)
    expect(values).toContain('get_weather')
    expect(values).toContain('city')
    expect(values).toContain('北京')

    graph.resetSelection(graph.getCellById('o'))
    await nextTick()
    expect(host.textContent).toContain('观察结果')

    graph.resetSelection(graph.getCellById('d'))
    await nextTick()
    expect(host.textContent).toContain('判断依据')

    graph.resetSelection(graph.getCellById('f'))
    await nextTick()
    expect(host.textContent).toContain('最终答案')

    cleanup()
  })

  it('选中 final 节点：编辑答案即时写入并纳入撤销（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const textarea = host.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('答案')

    textarea.value = '新答案'
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    expect(graph.getCellById('n2').getData()).toEqual({ answer: '新答案' })

    graph.undo()
    await nextTick()
    expect(graph.getCellById('n2').getData()).toEqual({ answer: '答案' })
    expect(textarea.value).toBe('答案') // 外部变更回灌到表单

    cleanup()
  })

  it('选中 exit 边：条件类型化编辑即时生效并同步标签，撤销可恢复（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw()) // e1: exit, max_iterations(max=3)
    await flush()
    const { host, cleanup } = mountPanel(graph, 'e1')
    await nextTick()

    const selects = host.querySelectorAll('select')
    expect(selects.length).toBe(2) // 连线类型 + 条件类型
    const conditionSelect = selects[1] as HTMLSelectElement
    expect(conditionSelect.value).toBe('max_iterations')

    conditionSelect.value = 'timeout'
    conditionSelect.dispatchEvent(new Event('change'))
    await nextTick()

    const edge = graph.getCellById('e1') as Edge
    expect(readEdgeCondition(edge)).toEqual({ type: 'timeout', params: { seconds: 30 } })
    expect(labelTexts(edge)).toEqual(['超时 30s']) // 边标签即时同步

    graph.undo()
    await nextTick()
    expect(readEdgeCondition(edge)).toEqual({ type: 'max_iterations', params: { max: 3 } })

    cleanup()
  })

  it('sequence 边改为 exit 且未选条件：条件为空并被校验标记 E4（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    const nodes: RawNode[] = [
      { id: 'n1', nodeType: 'start', x: 0, y: 0, data: { goal: 'g' } },
      { id: 'n2', nodeType: 'final', x: 0, y: 100, data: { answer: 'a' } },
    ]
    const edges: RawEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', kind: 'sequence', condition: null },
    ]
    insertRawGraph(graph, { nodes, edges })
    await flush()
    const { host, cleanup } = mountPanel(graph, 'e1')
    await nextTick()

    const kindSelect = host.querySelectorAll('select')[0] as HTMLSelectElement
    kindSelect.value = 'exit'
    kindSelect.dispatchEvent(new Event('change'))
    await nextTick()

    const edge = graph.getCellById('e1') as Edge
    expect(readEdgeCondition(edge)).toBeNull()
    expect(host.textContent).toContain('该退出边尚未设置条件')

    const schema = graphToSchema(projectRawGraph(graph))
    expect(validate(schema).some((issue) => issue.ruleId === 'E4')).toBe(true)

    cleanup()
  })
})
