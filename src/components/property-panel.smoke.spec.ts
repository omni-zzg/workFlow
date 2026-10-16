// @vitest-environment jsdom
import type { Edge, Node } from '@antv/x6'
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { readEdgeKind } from '@/graph/edgeStyle'
import { insertRawGraph } from '@/graph/project'
import type { TaskData } from '@/schema'
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

import PropertyPanel from './PropertyPanel.vue'

/** 属性面板冒烟测试（spec: flow-property-editing 的场景级验证） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

function mountPanel(graph: ReturnType<typeof makeTestGraph>['graph'], cellId: string) {
  setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
  const disposeSelection = initSelectionTracking(graph)
  graph.resetSelection(graph.getCellById(cellId))
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

function taskOf(graph: ReturnType<typeof makeTestGraph>['graph'], id = 'n2'): TaskData {
  return (graph.getCellById(id) as Node).getData<TaskData>()
}

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  element.value = value
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input'))
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

  it('任务表单：ReAct 单元字段齐全，必填项有标注', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    for (const text of ['任务名', '任务目标', '输入', 'ReAct 步骤', '循环退出条件', '前提条件', '异常处理']) {
      expect(host.textContent).toContain(text)
    }
    expect(host.textContent).toContain('必填')
    // 步骤与退出条件来自数据
    expect(host.querySelector('textarea[placeholder="这一步判断/推理什么"]')).not.toBeNull()
    expect(
      (host.querySelector('.property-panel__condition select') as HTMLSelectElement).value,
    ).toBe('goal_achieved')

    cleanup()
  })

  it('编辑任务名即时写入并纳入撤销（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const nameInput = host.querySelector('input[placeholder="如：查询天气"]') as HTMLInputElement
    setValue(nameInput, '查询天气')
    await nextTick()
    expect(taskOf(graph).name).toBe('查询天气')

    graph.undo()
    await nextTick()
    expect(taskOf(graph).name).toBe('测试任务')
    expect(nameInput.value).toBe('测试任务')

    cleanup()
  })

  it('步骤序列：可添加步骤、编辑思考与动作，数据即时同步', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    // 添加步骤
    const addStepButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加步骤'),
    ) as HTMLButtonElement
    addStepButton.click()
    await nextTick()
    expect(taskOf(graph).steps).toHaveLength(2)

    // 编辑第二步的思考
    const thoughtAreas = host.querySelectorAll('textarea[placeholder="这一步判断/推理什么"]')
    setValue(thoughtAreas[1] as HTMLTextAreaElement, '第二步的思考')
    await nextTick()
    expect(taskOf(graph).steps[1]!.thought).toBe('第二步的思考')

    // 为第一步添加动作与参数
    const firstStepBlock = host.querySelectorAll('.property-panel__step')[0]!
    const addActionButton = [...firstStepBlock.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加行动'),
    ) as HTMLButtonElement
    addActionButton.click()
    await nextTick()
    expect(taskOf(graph).steps[0]!.actions).toHaveLength(2)

    cleanup()
  })

  it('行动编辑：工具/目的/预期结果控件齐全，编辑即时同步并可撤销', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const toolInput = host.querySelector(
      'input[placeholder="工具（如：web_search）"]',
    ) as HTMLInputElement
    const purposeInput = host.querySelector(
      'input[placeholder="本次使用该工具完成什么"]',
    ) as HTMLInputElement
    const expectedInput = host.querySelector(
      'input[placeholder="可选，如：返回三条可用资料"]',
    ) as HTMLInputElement
    expect(toolInput).not.toBeNull()
    expect(purposeInput).not.toBeNull()
    expect(expectedInput).not.toBeNull()
    // 既有值回灌（sampleRaw：tool=tool / purpose=用途 / expectedResult=预期）
    expect(toolInput.value).toBe('tool')
    expect(purposeInput.value).toBe('用途')
    expect(expectedInput.value).toBe('预期')

    setValue(toolInput, 'web_search')
    setValue(purposeInput, '检索资料')
    setValue(expectedInput, '三条结果')
    await nextTick()
    expect(taskOf(graph).steps[0]!.actions[0]).toEqual({
      tool: 'web_search',
      purpose: '检索资料',
      expectedResult: '三条结果',
      params: { k: 'v' },
    })

    // 撤销一步：只回退最后一次编辑，且面板值同步回灌
    graph.undo()
    await nextTick()
    const action = taskOf(graph).steps[0]!.actions[0]!
    expect(action.tool).toBe('web_search')
    expect(action.expectedResult).toBe('预期')
    expect(expectedInput.value).toBe('预期')

    cleanup()
  })

  it('添加行动四字段完整；编辑参数不清空工具/目的/预期结果（整数组重建回归）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const firstStepBlock = host.querySelectorAll('.property-panel__step')[0]!
    const addActionButton = [...firstStepBlock.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加行动'),
    ) as HTMLButtonElement
    addActionButton.click()
    await nextTick()
    const actions = taskOf(graph).steps[0]!.actions
    expect(actions).toHaveLength(2)
    expect(actions[1]).toEqual({ tool: '', purpose: '', expectedResult: '', params: {} })

    // 编辑第一个行动的参数值：工具/目的/预期结果必须保留
    const valueInput = firstStepBlock.querySelector(
      'input[placeholder="值（自由填写）"]',
    ) as HTMLInputElement
    setValue(valueInput, 'v2')
    await nextTick()
    expect(taskOf(graph).steps[0]!.actions[0]).toEqual({
      tool: 'tool',
      purpose: '用途',
      expectedResult: '预期',
      params: { k: 'v2' },
    })

    cleanup()
  })

  it('循环退出条件：添加/修改类型/删除即时生效', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const addButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加退出条件'),
    ) as HTMLButtonElement
    addButton.click()
    await nextTick()
    expect(taskOf(graph).loop.exitConditions).toHaveLength(2)

    // 把新增条件改为 timeout
    const selects = host.querySelectorAll('.property-panel__condition select')
    setValue(selects[1] as HTMLSelectElement, 'timeout')
    await nextTick()
    expect(taskOf(graph).loop.exitConditions[1]).toEqual({
      type: 'timeout',
      params: { seconds: 30 },
    })

    // 删除第一个条件
    const removeButton = host.querySelector(
      '.property-panel__condition button',
    ) as HTMLButtonElement
    removeButton.click()
    await nextTick()
    expect(taskOf(graph).loop.exitConditions).toHaveLength(1)

    cleanup()
  })

  it('异常处理：反思与重试上限编辑即时生效', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'n2')
    await nextTick()

    const reflection = host.querySelector(
      'textarea[placeholder^="如：分析失败原因"]',
    ) as HTMLTextAreaElement
    setValue(reflection, '网络问题？')
    await nextTick()
    expect(taskOf(graph).onFailure.reflection).toBe('网络问题？')

    const retries = host.querySelector('input[type="number"]') as HTMLInputElement
    setValue(retries, '5')
    await nextTick()
    expect(taskOf(graph).onFailure.maxRetries).toBe(5)

    cleanup()
  })

  it('连线编辑：kind 切换（普通连线 / 异常出口）与样式同步（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, sampleRaw())
    await flush()
    const { host, cleanup } = mountPanel(graph, 'e2') // 普通连线
    await nextTick()

    expect(host.querySelectorAll('select')).toHaveLength(1) // 仅 kind 选择，无条件下拉
    const kindSelect = host.querySelector('select') as HTMLSelectElement
    expect(kindSelect.value).toBe('normal')

    // 改为异常出口 → 异常样式
    const edge = graph.getCellById('e2') as Edge
    setValue(kindSelect, 'exception')
    await nextTick()
    expect(readEdgeKind(edge)).toBe('exception')
    expect(edge.attr('line/strokeDasharray')).toBe('6 4')
    expect(labelTexts(edge)).toEqual(['异常'])

    graph.undo()
    await nextTick()
    expect(readEdgeKind(edge)).toBe('normal')
    expect(labelTexts(edge)).toHaveLength(0)

    cleanup()
  })
})
