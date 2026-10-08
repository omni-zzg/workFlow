// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { insertRawGraph } from '@/graph/project'
import { buildReactTemplateCells } from '@/graph/template'
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
  it('合法流程无问题；删除退出边后出现死循环 error 与节点角标；点击定位；补齐后恢复（spec 场景）', async () => {
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

    // 删除 goal_achieved 退出边（模板默认 id：tpl-e6）→ 循环失去出口
    graph.removeCell('tpl-e6')
    await waitDebounce()
    await nextTick()

    expect(host.textContent).toContain('死循环')
    expect(host.textContent).toContain('错误')

    // 画布角标：循环内节点带 error 态
    const view = graph.findViewByCell('tpl-thought')
    expect(view?.container.classList.contains('flow-state--error')).toBe(true)

    // 点击问题条目 → 选中并闪烁定位（定位到问题的第一个相关 cell）
    const item = host.querySelector('.problems-panel__item') as HTMLElement
    expect(item).not.toBeNull()
    item.click()
    await nextTick()
    expect(useSelection().value?.kind).toBe('node')
    const selectedCellId = useSelection().value!.cellId
    const flashedView = graph.findViewByCell(selectedCellId)
    expect(flashedView?.container.classList.contains('flow-state--flash')).toBe(true)

    // 修复：补回 exit 边 → 问题消失、角标清除
    graph.addEdge({
      id: 'fix-exit',
      source: 'tpl-decision',
      target: 'tpl-final',
      data: { kind: 'exit', condition: { type: 'goal_achieved' } },
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
