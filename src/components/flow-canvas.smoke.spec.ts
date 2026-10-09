// @vitest-environment jsdom
import { createApp } from 'vue'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { insertRawGraph } from '@/graph/project'
import { useDocument } from '@/stores/document'
import { reloadDocuments, saveCurrentDocument, useDocuments } from '@/stores/documents'
import { useGraphRuntime } from '@/stores/graphStore'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
  sampleRaw,
} from '@/testing/graphTestUtils'

import FlowCanvas from './FlowCanvas.vue'

/** 画布启动恢复（spec: flow-document-management「刷新后仍在/自动恢复」） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

beforeEach(() => {
  localStorage.clear()
  reloadDocuments()
})

describe('FlowCanvas 启动恢复', () => {
  it('刷新后自动恢复上次打开的文档并清除未保存标记', async () => {
    // 准备一份"上次会话"保存的文档（currentId 保留）
    const source = makeTestGraph()
    insertRawGraph(source.graph, sampleRaw())
    await flush()
    saveCurrentDocument(source.graph, { name: '上次的流程' })
    source.graph.dispose()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(FlowCanvas)
    app.mount(host)
    await flush()
    await flush()

    const runtime = useGraphRuntime().value
    expect(runtime).not.toBeNull()
    expect(runtime!.graph.getNodes()).toHaveLength(3)
    expect(runtime!.graph.getEdges()).toHaveLength(3)
    expect(useDocument().meta.value.name).toBe('上次的流程')
    expect(useDocument().dirty.value).toBe(false)

    app.unmount()
    host.remove()
  })

  it('当前文档不存在（损坏）时解除关联，画布保持空白', async () => {
    localStorage.setItem(
      'agent-flow-editor/documents',
      JSON.stringify({ version: 1, currentId: 'doc-missing', docs: [] }),
    )
    reloadDocuments()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(FlowCanvas)
    app.mount(host)
    await flush()
    await flush()

    const runtime = useGraphRuntime().value
    expect(runtime).not.toBeNull()
    expect(runtime!.graph.getNodes()).toHaveLength(0)
    expect(useDocuments().currentId.value).toBeNull()

    app.unmount()
    host.remove()
  })
})
