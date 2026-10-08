import { buildIndex, canReach, findCycles, isAncestor, reachableFrom } from '../analysis'
import { CONTROLLABLE_EXIT_TYPES } from '../schema'
import type { ExitEdge, FlowSchema, NodeType } from '../schema'

import type { Issue } from './types'

type ConfirmedExit = ExitEdge & {
  data: { condition: NonNullable<ExitEdge['data']['condition']> }
}

function hasCondition(edge: ExitEdge): edge is ConfirmedExit {
  return edge.data.condition !== null
}

/**
 * ReAct 校验（规则语义见 openspec/specs/flow-validation）：
 * - error：结构非法（缺目标、死循环、无终止路径、退出条件缺失）
 * - warning：规范性建议（三要素、判断点、可控退出、连通性、标注一致性）
 *
 * 纯函数：只读 schema，不修改数据；空画布不产生任何问题。
 */
export function validate(schema: FlowSchema): Issue[] {
  if (schema.nodes.length === 0) return []

  const issues: Issue[] = []
  const index = buildIndex(schema.nodes, schema.edges)
  const nodesById = new Map(schema.nodes.map((node) => [node.id, node]))
  const typeOf = (id: string): NodeType | undefined => nodesById.get(id)?.type

  const starts = schema.nodes.filter((node) => node.type === 'start')
  const finals = schema.nodes.filter((node) => node.type === 'final')
  const startIds = starts.map((start) => start.id)
  const finalIds = finals.map((final) => final.id)

  // E1 目标与入口 / W8 入口唯一性
  if (starts.length === 0) {
    issues.push({ severity: 'error', ruleId: 'E1', message: '缺少开始节点与目标声明', cellIds: [] })
  } else {
    for (const start of starts) {
      if (start.data.goal.trim() === '') {
        issues.push({
          severity: 'error',
          ruleId: 'E1',
          message: '开始节点的目标（goal）为空',
          cellIds: [start.id],
        })
      }
    }
    if (starts.length > 1) {
      issues.push({
        severity: 'warning',
        ruleId: 'W8',
        message: `存在 ${starts.length} 个开始节点（入口歧义）`,
        cellIds: startIds,
      })
    }
  }

  // 循环分析：E2 死循环 / W2 循环控制点 / W3 可控退出 / W6 回边标注（按循环）
  const cycles = findCycles(index)
  for (const cycle of cycles) {
    const members = new Set(cycle)

    const leavingExits = schema.edges.filter(
      (edge): edge is ExitEdge =>
        edge.kind === 'exit' && members.has(edge.source) && !members.has(edge.target),
    )
    const effectiveExits = leavingExits.filter(hasCondition)

    if (effectiveExits.length === 0) {
      issues.push({
        severity: 'error',
        ruleId: 'E2',
        message: '死循环风险：该循环没有带退出条件的出口',
        cellIds: cycle,
      })
    } else if (!effectiveExits.some((edge) => CONTROLLABLE_EXIT_TYPES.has(edge.data.condition.type))) {
      issues.push({
        severity: 'warning',
        ruleId: 'W3',
        message: '该循环仅有异常/人工退出，建议补充目标达成、最大迭代等可控退出条件',
        cellIds: cycle,
      })
    }

    if (!cycle.some((id) => typeOf(id) === 'decision')) {
      issues.push({
        severity: 'warning',
        ruleId: 'W2',
        message: '循环缺少判断节点（decision）',
        cellIds: cycle,
      })
    }

    const hasLoopMark = schema.edges.some(
      (edge) => edge.kind === 'loop' && members.has(edge.source) && members.has(edge.target),
    )
    if (!hasLoopMark) {
      issues.push({
        severity: 'warning',
        ruleId: 'W6',
        message: '该循环未标记回边（loop）',
        cellIds: cycle,
      })
    }
  }

  // E4 退出条件完整性 / W7 退出边源头
  for (const edge of schema.edges) {
    if (edge.kind !== 'exit') continue
    if (edge.data.condition === null) {
      issues.push({
        severity: 'error',
        ruleId: 'E4',
        message: '退出边缺少退出条件',
        cellIds: [edge.id],
      })
    }
    if (typeOf(edge.source) !== 'decision') {
      issues.push({
        severity: 'warning',
        ruleId: 'W7',
        message: '退出边建议由判断节点（decision）发出',
        cellIds: [edge.id],
      })
    }
  }

  // W6（边级）：标记 loop 但未构成有向环
  for (const edge of schema.edges) {
    if (edge.kind !== 'loop') continue
    if (!isAncestor(index, edge.target, edge.source)) {
      issues.push({
        severity: 'warning',
        ruleId: 'W6',
        message: '该边标记为回边（loop）但未构成循环',
        cellIds: [edge.id],
      })
    }
  }

  // E3 终止路径
  if (starts.length > 0 && (finals.length === 0 || !canReach(index, startIds, finalIds))) {
    issues.push({
      severity: 'error',
      ruleId: 'E3',
      message: '没有从开始节点到结束节点（final）的路径',
      cellIds: startIds,
    })
  }

  // W1 ReAct 三要素（存在完整的 thought -> action -> observation 顺序链）
  const actions = schema.nodes.filter((node) => node.type === 'action')
  const hasChain = actions.some(
    (action) =>
      schema.edges.some(
        (edge) =>
          edge.kind === 'sequence' && edge.target === action.id && typeOf(edge.source) === 'thought',
      ) &&
      schema.edges.some(
        (edge) =>
          edge.kind === 'sequence' &&
          edge.source === action.id &&
          typeOf(edge.target) === 'observation',
      ),
  )
  if (!hasChain) {
    issues.push({
      severity: 'warning',
      ruleId: 'W1',
      message: '缺少思考-行动-观察（Thought-Action-Observation）链',
      cellIds: [],
    })
  }

  // W4 不可达节点（无 start 时由 E1 覆盖，跳过避免噪声）
  if (starts.length > 0) {
    const reachable = reachableFrom(index, startIds)
    for (const node of schema.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          severity: 'warning',
          ruleId: 'W4',
          message: '节点从开始节点不可达',
          cellIds: [node.id],
        })
      }
    }
  }

  // W5 死路节点（无 final 时由 E3 覆盖，跳过）
  if (finals.length > 0) {
    for (const node of schema.nodes) {
      if (node.type === 'final') continue
      if (!canReach(index, [node.id], finalIds)) {
        issues.push({
          severity: 'warning',
          ruleId: 'W5',
          message: '节点无法到达结束节点（final）',
          cellIds: [node.id],
        })
      }
    }
  }

  return issues
}
