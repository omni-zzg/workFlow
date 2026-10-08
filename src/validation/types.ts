/** 校验问题模型与规则注册表（规则语义见 openspec/specs/flow-validation） */

export type Severity = 'error' | 'warning'

export type RuleId =
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'W1'
  | 'W2'
  | 'W3'
  | 'W4'
  | 'W5'
  | 'W6'
  | 'W7'
  | 'W8'

export interface Issue {
  severity: Severity
  ruleId: RuleId
  message: string
  /** 相关节点/边 id，供问题面板定位与画布态标注 */
  cellIds: string[]
}

export interface RuleMeta {
  id: RuleId
  severity: Severity
  title: string
}

/** 规则注册表：error = 结构非法；warning = 规范性建议 */
export const RULES: readonly RuleMeta[] = [
  { id: 'E1', severity: 'error', title: '目标与入口检查' },
  { id: 'E2', severity: 'error', title: '死循环检测' },
  { id: 'E3', severity: 'error', title: '终止路径检查' },
  { id: 'E4', severity: 'error', title: '退出条件完整性' },
  { id: 'W1', severity: 'warning', title: 'ReAct 三要素检查' },
  { id: 'W2', severity: 'warning', title: '循环控制点检查' },
  { id: 'W3', severity: 'warning', title: '可控退出检查' },
  { id: 'W4', severity: 'warning', title: '不可达节点检查' },
  { id: 'W5', severity: 'warning', title: '死路节点检查' },
  { id: 'W6', severity: 'warning', title: '标注一致性检查' },
  { id: 'W7', severity: 'warning', title: '退出边源头检查' },
  { id: 'W8', severity: 'warning', title: '入口唯一性检查' },
]

export const RULE_TITLES: Record<RuleId, string> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule.title]),
) as Record<RuleId, string>
