// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { beforeAll, describe, expect, it } from 'vitest'

import ImportFlowDialog from '@/components/ImportFlowDialog.vue'
import { useDocument } from '@/stores/document'
import { setGraphRuntime } from '@/stores/graphStore'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
} from '@/testing/graphTestUtils'

import { CellStateController } from './cellState'
import { exportFlowJson, importFlowText } from './io'
import { insertRawGraph, projectRawGraph } from './project'
import { buildReactTemplateCells } from './template'

/** 导入导出冒烟（spec: flow-json-storage 的场景级验证） */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

describe('导入导出', () => {
  it('导出 JSON 仅含 version/meta/nodes/edges，无派生数据（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, buildReactTemplateCells())
    await flush()

    const text = exportFlowJson(graph, { name: '测试流程' })
    const parsed = JSON.parse(text) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(['edges', 'meta', 'nodes', 'version'])
    expect(parsed.version).toBe(1)

    const firstNode = (parsed.nodes as Array<Record<string, unknown>>)[0]!
    expect(Object.keys(firstNode).sort()).toEqual(['data', 'id', 'position', 'type'])

    // 不含校验结果等派生字段
    expect(text).not.toContain('severity')
    expect(text).not.toContain('ruleId')
    expect(text).not.toContain('issue')

    graph.dispose()
  })

  it('往返一致：导出 → 导入新图 → 再导出语义等价', async () => {
    const source = makeTestGraph().graph
    insertRawGraph(source, buildReactTemplateCells())
    await flush()
    const text1 = exportFlowJson(source, { name: '往返流程' })

    const target = makeTestGraph().graph
    const result = importFlowText(target, text1)
    expect(result.ok).toBe(true)
    await flush()

    const text2 = exportFlowJson(target, { name: '往返流程' })
    expect(JSON.parse(text2)).toEqual(JSON.parse(text1))

    source.dispose()
    target.dispose()
  })

  it('导入非法 JSON：报错且画布不动（spec 场景）', async () => {
    const { graph } = makeTestGraph()
    insertRawGraph(graph, buildReactTemplateCells())
    await flush()
    const before = exportFlowJson(graph, { name: 'x' })

    const result = importFlowText(graph, '{ "version": 1, ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('JSON 解析失败')

    expect(exportFlowJson(graph, { name: 'x' })).toEqual(before) // 画布保持原样
    graph.dispose()
  })

  it('导入合法文件：完整还原（位置/kind/条件）并清空撤销栈', async () => {
    const source = makeTestGraph().graph
    insertRawGraph(source, buildReactTemplateCells())
    await flush()
    const text = exportFlowJson(source, { name: '还原流程' })

    const target = makeTestGraph().graph
    insertRawGraph(target, {
      nodes: [{ id: 'tmp', nodeType: 'start', x: 0, y: 0, data: { goal: '' } }],
      edges: [],
    })
    expect(target.canUndo()).toBe(true) // 制造非空撤销栈

    const result = importFlowText(target, text)
    expect(result.ok).toBe(true)
    await flush()

    expect(target.getNodes()).toHaveLength(6)
    expect(target.getEdges()).toHaveLength(6)
    expect(target.canUndo()).toBe(false) // 撤销栈已清空

    const projected = projectRawGraph(target)
    expect(projected.edges.find((edge) => edge.kind === 'exit')?.condition).toEqual({
      type: 'goal_achieved',
    })
    const start = projected.nodes.find((node) => node.nodeType === 'start')
    expect(start?.x).toBe(360)

    source.dispose()
    target.dispose()
  })
})

describe('导入对话框', () => {
  it('粘贴非法内容：列出错误且画布不动；合法内容：导入成功并标记为已保存', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(ImportFlowDialog)
    app.mount(host)
    await nextTick()

    const textarea = host.querySelector('textarea') as HTMLTextAreaElement
    const importButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('导入'),
    ) as HTMLButtonElement
    expect(importButton).not.toBeUndefined()

    // 非法内容
    textarea.value = 'not json'
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    importButton.click()
    await nextTick()
    expect(host.textContent).toContain('JSON 解析失败')
    expect(graph.getNodes()).toHaveLength(0) // 画布不动

    // 合法内容
    const source = makeTestGraph().graph
    insertRawGraph(source, buildReactTemplateCells())
    await flush()
    const valid = exportFlowJson(source, { name: '对话导入' })

    textarea.value = valid
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    importButton.click()
    await nextTick()

    expect(graph.getNodes()).toHaveLength(6)
    expect(useDocument().dirty.value).toBe(false) // 导入后视为已保存
    expect(useDocument().meta.value.name).toBe('对话导入')

    app.unmount()
    setGraphRuntime(null)
    graph.dispose()
    source.dispose()
  })
})
