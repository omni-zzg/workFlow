// @vitest-environment jsdom
import type { Node } from '@antv/x6'
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { mutate } from '@/graph/mutate'
import { insertRawGraph } from '@/graph/project'
import { buildReactTemplateCells } from '@/graph/template'
import type { TaskData } from '@/schema'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking, useSelection } from '@/stores/selection'
import { initValidation } from '@/stores/validation'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
} from '@/testing/graphTestUtils'

import ProblemsPanel from './ProblemsPanel.vue'

/** 问题面板集成冒烟（spec: flow-validation 的场景级验证） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

/** 等待防抖校验（DEBOUNCE_MS = 200） */
const waitDebounce = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 280))

describe('问题面板', () => {
  it('合法任务流无问题；清空循环退出条件后出现 E3 与角标；点击定位；补齐后恢复（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, buildReactTemplateCells())
    await flush()

    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
    const disposeSelection = initSelectionTracking(graph)
    const disposeValidation = initValidation(graph)

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(ProblemsPanel)
    app.mount(host)
    await nextTick()

    expect(host.textContent).toContain('暂无问题')

    // 清空任务的循环退出条件 → E3
    const task = graph.getCellById('tpl-task') as Node
    mutate(graph, () => {
      const data = task.getData<TaskData>()
      task.replaceData({ ...data, loop: { exitConditions: [] } })
    })
    await waitDebounce()
    await nextTick()

    expect(host.textContent).toContain('缺少循环退出条件')
    expect(host.textContent).toContain('错误')

    // 画布角标：任务节点带 error 态
    const view = graph.findViewByCell('tpl-task')
    expect(view?.container.classList.contains('flow-state--error')).toBe(true)

    // 点击问题条目 → 选中并闪烁定位
    const item = host.querySelector('.problems-panel__item') as HTMLElement
    expect(item).not.toBeNull()
    item.click()
    await nextTick()
    expect(useSelection().value?.cellId).toBe('tpl-task')
    expect(view?.container.classList.contains('flow-state--flash')).toBe(true)

    // 修复：补回退出条件 → 问题消失、角标清除
    mutate(graph, () => {
      const data = task.getData<TaskData>()
      task.replaceData({ ...data, loop: { exitConditions: [{ type: 'goal_achieved' }] } })
    })
    await waitDebounce()
    await nextTick()
    expect(host.textContent).toContain('暂无问题')
    expect(view?.container.classList.contains('flow-state--error')).toBe(false)

    app.unmount()
    disposeValidation()
    disposeSelection()
    setGraphRuntime(null)
    graph.dispose()
  })
})
