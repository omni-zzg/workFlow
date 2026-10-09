// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { insertRawGraph, projectRawGraph } from '@/graph/project'
import { detachCurrentDocument, reloadDocuments, saveCurrentDocument } from '@/stores/documents'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking } from '@/stores/selection'
import { initValidation } from '@/stores/validation'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
  sampleRaw,
} from '@/testing/graphTestUtils'

import DocumentDialog from './DocumentDialog.vue'

/** 文档管理对话框冒烟（spec: flow-document-management 的场景级验证） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

beforeEach(() => {
  localStorage.clear()
  reloadDocuments()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('文档管理对话框', () => {
  it('无文档时显示空态提示', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(DocumentDialog, { onClose: () => {} })
    app.mount(host)
    await nextTick()

    expect(host.textContent).toContain('暂无保存的流程图')

    app.unmount()
    setGraphRuntime(null)
    graph.dispose()
  })

  it('列出已保存文档：点击「打开」还原画布并关闭', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // 先造一份已保存文档，并解除关联（模拟未打开任何文档）
    const source = makeTestGraph()
    insertRawGraph(source.graph, sampleRaw())
    await flush()
    saveCurrentDocument(source.graph, { name: '已存流程' })
    source.graph.dispose()
    detachCurrentDocument()

    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
    const disposeSelection = initSelectionTracking(graph)
    const disposeValidation = initValidation(graph)

    let closed = 0
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(DocumentDialog, {
      onClose: () => {
        closed += 1
      },
    })
    app.mount(host)
    await nextTick()

    expect(host.textContent).toContain('已存流程')
    expect(host.textContent).toContain('共 1 份')

    const openButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('打开'),
    ) as HTMLButtonElement
    openButton.click()
    await flush()

    expect(projectRawGraph(graph).nodes).toHaveLength(3)
    expect(closed).toBe(1)

    app.unmount()
    disposeValidation()
    disposeSelection()
    setGraphRuntime(null)
    graph.dispose()
  })
})
