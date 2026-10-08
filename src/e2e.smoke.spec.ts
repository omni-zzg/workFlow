// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { exportFlowJson, importFlowText, resetGraph } from '@/graph/io'
import { mutate } from '@/graph/mutate'
import { projectRawGraph } from '@/graph/project'
import { insertReactTemplate } from '@/graph/template'
import { setGraphRuntime } from '@/stores/graphStore'
import { initValidation, useValidation, validateNow } from '@/stores/validation'
import {
  flush,
  installJsdomPolyfills,
  makeTestGraph,
  registerStubShapes,
} from '@/testing/graphTestUtils'

/**
 * 端到端冒烟（task 11.1 的自动化部分）：
 * 新建 → 插入模板 → 改属性 → 删除退出边出现死循环 error → 补回 → 导出 → 回导，
 * 覆盖验收流程的主干；纯视觉与鼠标交互仍由人工验收清单覆盖。
 */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

describe('端到端冒烟：建模 → 校验 → 导出 → 回导', () => {
  it('完整流程保持自洽', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
    const disposeValidation = initValidation(graph)
    const { issues } = useValidation()

    // 1. 新建：清空画布与撤销栈
    resetGraph(graph)
    expect(graph.getNodes()).toHaveLength(0)
    expect(graph.canUndo()).toBe(false)

    // 2. 插入 ReAct 模板 → 零校验问题
    insertReactTemplate(graph)
    await flush()
    validateNow()
    expect(issues.value).toEqual([])

    // 3. 改属性（模拟属性面板写入路径）→ 投影可见
    const startNode = graph.getNodes().find((node) => node.shape === 'flow-start')!
    mutate(graph, () => {
      startNode.replaceData({ goal: '查询北京天气并给出建议' })
    })
    validateNow()
    expect(issues.value).toEqual([])
    const startData = projectRawGraph(graph).nodes.find((node) => node.nodeType === 'start')?.data
    expect(startData).toEqual({ goal: '查询北京天气并给出建议' })

    // 4. 删除 exit 边 → 死循环 error（E2）
    const exitEdge = graph
      .getEdges()
      .find((edge) => (edge.getData() as { kind?: string } | undefined)?.kind === 'exit')!
    graph.removeCell(exitEdge.id)
    await flush()
    validateNow()
    const errorRules = issues.value
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.ruleId)
    expect(errorRules).toContain('E2')

    // 5. 补回 exit 边 → 恢复零问题
    const decision = graph.getNodes().find((node) => node.shape === 'flow-decision')!
    const finalNode = graph.getNodes().find((node) => node.shape === 'flow-final')!
    graph.addEdge({
      id: 'e2e-exit',
      source: decision.id,
      target: finalNode.id,
      data: { kind: 'exit', condition: { type: 'goal_achieved' } },
    })
    await flush()
    validateNow()
    expect(issues.value).toEqual([])

    // 6. 导出 → 回导到新图 → 再导出等价
    const text = exportFlowJson(graph, { name: 'E2E 流程' })
    const target = makeTestGraph().graph
    const result = importFlowText(target, text)
    expect(result.ok).toBe(true)
    await flush()
    expect(exportFlowJson(target, { name: 'E2E 流程' })).toEqual(text)

    disposeValidation()
    setGraphRuntime(null)
    graph.dispose()
    target.dispose()
  })
})
