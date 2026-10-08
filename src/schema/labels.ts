import type { ConditionType, EdgeKind, ExitCondition, NodeType } from './types'

/** 文案在此集中定义，供画布、属性面板、问题面板复用 */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  start: '开始',
  thought: '思考',
  action: '行动',
  observation: '观察',
  decision: '判断',
  final: '结束',
}

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  sequence: '顺序',
  loop: '循环',
  exit: '退出',
}

export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  goal_achieved: '目标达成',
  max_iterations: '最大迭代',
  timeout: '超时',
  budget: '预算耗尽',
  error: '异常终止',
  human_interrupt: '人工中断',
  custom: '自定义',
}

/** 退出条件摘要（边标签与判断节点徽标共用） */
export function conditionSummary(condition: ExitCondition | null): string {
  if (!condition) return '未定义'
  switch (condition.type) {
    case 'goal_achieved':
      return '目标达成'
    case 'max_iterations':
      return `max=${condition.params.max}`
    case 'timeout':
      return `超时 ${condition.params.seconds}s`
    case 'budget':
      return `预算 ${condition.params.tokens} tokens`
    case 'error':
      return '异常终止'
    case 'human_interrupt':
      return '人工中断'
    case 'custom':
      return condition.text.trim() || '自定义'
  }
}

/** 可控退出（用于校验 W3：目标达成 / 最大迭代 / 超时 / 预算） */
export const CONTROLLABLE_EXIT_TYPES: ReadonlySet<ConditionType> = new Set([
  'goal_achieved',
  'max_iterations',
  'timeout',
  'budget',
])
