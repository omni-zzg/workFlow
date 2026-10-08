import { buildIndex, canReach, findCycles, reachableFrom } from '../analysis'
import { CONTROLLABLE_EXIT_TYPES } from '../schema'
import type { FlowSchema } from '../schema'

import type { Issue } from './types'

/**
 * 任务流校验（规则语义见 openspec/specs/flow-validation）：
 * - 逐节点：每个任务必须是一个完整的 ReAct 单元（标识/步骤/循环退出条件/前提条件/异常处理）
 * - 顶层：开始、终止路径、失败回退环必须有成功出口、连通性
 *
 * 纯函数：只读 schema，不修改数据；空画布不产生任何问题。
 */
export function validate(schema: FlowSchema): Issue[] {
  if (schema.nodes.length === 0) return []

  const issues: Issue[] = []
  const index = buildIndex(schema.nodes, schema.edges)
  const nodesById = new Map(schema.nodes.map((node) => [node.id, node]))

  const tasks = schema.nodes.filter((node) => node.type === 'task')
  const starts = schema.nodes.filter((node) => node.type === 'start')
  const finals = schema.nodes.filter((node) => node.type === 'final')
  const startIds = starts.map((start) => start.id)
  const finalIds = finals.map((final) => final.id)

  const outgoing = (id: string) => schema.edges.filter((edge) => edge.source === id)
  const hasSuccessOut = (id: string): boolean =>
    outgoing(id).some((edge) => edge.kind === 'success')
  const hasFailureOut = (id: string): boolean =>
    outgoing(id).some((edge) => edge.kind === 'failure')

  // ---- 逐任务：ReAct 必备要素 ----
  for (const task of tasks) {
    const data = task.data

    // E1 任务标识
    if (data.name.trim() === '' || data.goal.trim() === '') {
      issues.push({
        severity: 'error',
        ruleId: 'E1',
        message: '任务缺少名称或目标',
        cellIds: [task.id],
      })
    }

    // E2 步骤序列 / W1 步骤完整性
    if (data.steps.length === 0) {
      issues.push({
        severity: 'error',
        ruleId: 'E2',
        message: '任务没有步骤：至少需要一组思考-行动-观察',
        cellIds: [task.id],
      })
    } else {
      const hasIncompleteStep = data.steps.some(
        (step) =>
          step.thought.trim() === '' ||
          step.observation.trim() === '' ||
          step.actions.length === 0,
      )
      if (hasIncompleteStep) {
        issues.push({
          severity: 'warning',
          ruleId: 'W1',
          message: '步骤不完整：思考/行动/观察存在缺项',
          cellIds: [task.id],
        })
      }
    }

    // E3 循环退出条件 / W2 可控退出
    const conditions = data.loop.exitConditions
    if (conditions.length === 0) {
      issues.push({
        severity: 'error',
        ruleId: 'E3',
        message: '任务缺少循环退出条件',
        cellIds: [task.id],
      })
    } else if (!conditions.some((condition) => CONTROLLABLE_EXIT_TYPES.has(condition.type))) {
      issues.push({
        severity: 'warning',
        ruleId: 'W2',
        message: '循环仅有异常/人工退出，建议补充可控退出条件',
        cellIds: [task.id],
      })
    }

    // E4 前提条件（有 success 出边才要求）
    if (hasSuccessOut(task.id) && data.precondition.trim() === '') {
      issues.push({
        severity: 'error',
        ruleId: 'E4',
        message: '任务有成功出边但缺少前提条件',
        cellIds: [task.id],
      })
    }

    // W3 异常处理
    if (data.onFailure.reflection.trim() === '' || data.onFailure.replan.trim() === '') {
      issues.push({
        severity: 'warning',
        ruleId: 'W3',
        message: '任务缺少失败反思或重规划',
        cellIds: [task.id],
      })
    }

    // W4 失败出口
    if (hasSuccessOut(task.id) && !hasFailureOut(task.id)) {
      issues.push({
        severity: 'warning',
        ruleId: 'W4',
        message: '任务未声明失败出口',
        cellIds: [task.id],
      })
    }
  }

  // ---- E5 成功边条件（start 出边豁免） ----
  for (const edge of schema.edges) {
    if (edge.kind !== 'success') continue
    if (nodesById.get(edge.source)?.type === 'start') continue
    if (edge.data.condition === null) {
      issues.push({
        severity: 'error',
        ruleId: 'E5',
        message: 'success 边缺少前提条件（开始节点的出边除外）',
        cellIds: [edge.id],
      })
    }
  }

  // ---- E6 开始 / W7 入口唯一 ----
  if (starts.length === 0) {
    issues.push({
      severity: 'error',
      ruleId: 'E6',
      message: '缺少开始节点与全局目标',
      cellIds: [],
    })
  } else {
    for (const start of starts) {
      if (start.data.goal.trim() === '') {
        issues.push({
          severity: 'error',
          ruleId: 'E6',
          message: '开始节点缺少全局目标',
          cellIds: [start.id],
        })
      }
    }
    if (starts.length > 1) {
      issues.push({
        severity: 'warning',
        ruleId: 'W7',
        message: '存在多个开始节点',
        cellIds: startIds,
      })
    }
  }

  // ---- E7 终止路径 ----
  if (starts.length > 0 && (finals.length === 0 || !canReach(index, startIds, finalIds))) {
    issues.push({
      severity: 'error',
      ruleId: 'E7',
      message: '没有从开始到结束的路径',
      cellIds: startIds,
    })
  }

  // ---- E8 失败回退环：必须有一条离开环的成功出口（带条件，才算"能正常退出"） ----
  for (const cycle of findCycles(index)) {
    const members = new Set(cycle)
    const hasSuccessExit = schema.edges.some(
      (edge) =>
        members.has(edge.source) &&
        !members.has(edge.target) &&
        edge.kind === 'success' &&
        edge.data.condition !== null,
    )
    if (!hasSuccessExit) {
      issues.push({
        severity: 'error',
        ruleId: 'E8',
        message: '死循环风险：失败回退形成的环没有成功出口',
        cellIds: cycle,
      })
    }
  }

  // ---- W5 不可达节点 ----
  if (starts.length > 0) {
    const reachable = reachableFrom(index, startIds)
    for (const node of schema.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          severity: 'warning',
          ruleId: 'W5',
          message: '节点从开始节点不可达',
          cellIds: [node.id],
        })
      }
    }
  }

  // ---- W6 流程中断（非 final 节点没有出边） ----
  for (const node of schema.nodes) {
    if (node.type === 'final') continue
    if (outgoing(node.id).length === 0) {
      issues.push({
        severity: 'warning',
        ruleId: 'W6',
        message: '任务没有出边，流程在此中断',
        cellIds: [node.id],
      })
    }
  }

  return issues
}
