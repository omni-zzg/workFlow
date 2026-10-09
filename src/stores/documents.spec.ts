// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { insertRawGraph, projectRawGraph } from '@/graph'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
  sampleRaw,
} from '@/testing/graphTestUtils'

import {
  deleteDocument,
  detachCurrentDocument,
  openDocument,
  reloadDocuments,
  renameDocument,
  saveCurrentDocument,
  useDocuments,
} from './documents'

/** 本地文档管理（spec: flow-document-management 的场景级验证） */

const STORAGE_KEY = 'agent-flow-editor/documents'

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

beforeEach(() => {
  localStorage.clear()
  reloadDocuments()
})

describe('本地文档管理', () => {
  it('保存 → 列表可见 → 打开还原 → 重命名 → 删除', async () => {
    const source = makeTestGraph()
    insertRawGraph(source.graph, sampleRaw())
    await flush()

    const id = saveCurrentDocument(source.graph, { name: '流程A' })
    expect(useDocuments().documents.value.map((doc) => doc.name)).toEqual(['流程A'])
    expect(useDocuments().currentId.value).toBe(id)

    // 再次保存：更新当前文档而非新增
    saveCurrentDocument(source.graph, { name: '流程A' })
    expect(useDocuments().documents.value).toHaveLength(1)

    // 打开到新图：节点还原
    const target = makeTestGraph()
    const result = openDocument(target.graph, id)
    expect(result.ok).toBe(true)
    await flush()
    expect(projectRawGraph(target.graph).nodes).toHaveLength(3)
    expect(useDocuments().currentId.value).toBe(id)

    // 重命名
    expect(renameDocument(id, '流程A2')).toBe(true)
    expect(useDocuments().documents.value[0]!.name).toBe('流程A2')
    expect(renameDocument(id, '   ')).toBe(false)

    // 删除（当前文档解除关联）
    deleteDocument(id)
    expect(useDocuments().documents.value).toHaveLength(0)
    expect(useDocuments().currentId.value).toBeNull()

    source.graph.dispose()
    target.graph.dispose()
  })

  it('持久化到 localStorage：重新加载后仍在，可继续打开', async () => {
    const source = makeTestGraph()
    insertRawGraph(source.graph, sampleRaw())
    await flush()
    const id = saveCurrentDocument(source.graph, { name: '持久化' })
    source.graph.dispose()

    reloadDocuments() // 模拟刷新页面后重新读取
    expect(useDocuments().documents.value.map((doc) => doc.name)).toEqual(['持久化'])
    expect(useDocuments().currentId.value).toBe(id)

    const target = makeTestGraph()
    expect(openDocument(target.graph, id).ok).toBe(true)
    await flush()
    expect(projectRawGraph(target.graph).edges).toHaveLength(3)
    target.graph.dispose()
  })

  it('解除关联与打开不存在的文档', () => {
    detachCurrentDocument()
    expect(useDocuments().currentId.value).toBeNull()

    const graph = makeTestGraph()
    const result = openDocument(graph.graph, 'doc-missing')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('文档不存在')
    graph.graph.dispose()
  })

  it('损坏的文档：打开失败并给出错误，画布保持原样', async () => {
    const source = makeTestGraph()
    insertRawGraph(source.graph, sampleRaw())
    await flush()
    const id = saveCurrentDocument(source.graph, { name: '坏档' })
    source.graph.dispose()

    // 手工破坏存储内容（旧模型节点类型）
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      docs: Array<{ schema: { nodes: Array<{ type: string }> } }>
    }
    raw.docs[0]!.schema.nodes[0]!.type = 'thought'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
    reloadDocuments()

    const target = makeTestGraph()
    insertRawGraph(target.graph, sampleRaw())
    await flush()
    const before = projectRawGraph(target.graph).nodes.length

    const result = openDocument(target.graph, id)
    expect(result.ok).toBe(false)
    await flush()
    expect(projectRawGraph(target.graph).nodes.length).toBe(before) // 画布不动
    target.graph.dispose()
  })
})
