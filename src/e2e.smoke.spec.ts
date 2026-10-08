// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'

import { CellStateController } from '@/graph/cellState'
import { exportFlowJson, importFlowText, resetGraph } from '@/graph/io'
import { mutate } from '@/graph/mutate'
import { projectRawGraph } from '@/graph/project'
import { insertReactTemplate } from '@/graph/template'
import type { TaskData } from '@/schema'
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
 * 新建 → 插入任务流模板 → 改任务属性 → 清空循环退出条件出现 E3 → 补回 → 导出 → 回导，
 * 覆盖验收流程的主干；纯视觉与鼠标交互仍由人工验收清单覆盖。
 */

beforeAll(() => {
  installJsdomPolyfills()
  registerStubShapes()
})

describe('端到端冒烟：任务流建模 → 校验 → 导出 → 回导', () => {
  it('完整流程保持自洽', async () => {
    const { graph } = makeTestGraph()
    setGraphRuntime({ graph, cellStates: new CellStateController(graph) })
    const disposeValidation = initValidation(graph)
    const { issues } = useValidation()

    // 1. 新建：清空画布与撤销栈
    resetGraph(graph)
    expect(graph.getNodes()).toHaveLength(0)
    expect(graph.canUndo()).toBe(false)

    // 2. 插入任务流模板 → 零校验问题
    insertReactTemplate(graph)
    await flush()
    validateNow()
    expect(issues.value).toEqual([])

    // 3. 改任务属性（模拟属性面板写入路径）→ 投影可见
    const taskNode = graph.getNodes().find((node) => node.shape === 'flow-task')!
    mutate(graph, () => {
      const data = taskNode.getData<TaskData>()
      taskNode.replaceData({ ...data, name: '查询天气并整理' })
    })
    validateNow()
    expect(issues.value).toEqual([])
    const taskData = projectRawGraph(graph).nodes.find((node) => node.nodeType === 'task')
      ?.data as TaskData
    expect(taskData.name).toBe('查询天气并整理')

    // 4. 清空循环退出条件 → E3
    mutate(graph, () => {
      const data = taskNode.getData<TaskData>()
      taskNode.replaceData({ ...data, loop: { exitConditions: [] } })
    })
    await flush()
    validateNow()
    const errorRules = issues.value
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.ruleId)
    expect(errorRules).toContain('E3')

    // 5. 补回退出条件 → 恢复零问题
    mutate(graph, () => {
      const data = taskNode.getData<TaskData>()
      taskNode.replaceData({
        ...data,
        loop: {
          exitConditions: [
            { type: 'goal_achieved' },
            { type: 'max_iterations', params: { max: 5 } },
          ],
        },
      })
    })
    await flush()
    validateNow()
    expect(issues.value).toEqual([])

    // 6. 导出 → 回导到新图 → 再导出等价
    const text = exportFlowJson(graph, { name: 'E2E 任务流' })
    const target = makeTestGraph().graph
    const result = importFlowText(target, text)
    expect(result.ok).toBe(true)
    await flush()
    expect(exportFlowJson(target, { name: 'E2E 任务流' })).toEqual(text)

    disposeValidation()
    setGraphRuntime(null)
    graph.dispose()
    target.dispose()
  })
})
