/**
 * 持久化格式版本迁移（纯函数，不依赖 X6/Vue）。
 *
 * 目前仅处理 v1 → v2：行动由 {name, params} 升级为
 * {tool, purpose, expectedResult, params}（name → tool，purpose / expectedResult 补空字符串）。
 * 防御式：只映射认知范围内的形状，无法识别的部分原样返回，交由 parse 的 zod 校验报带路径的错误。
 */

/**
 * 已知旧版本持久化 JSON → 当前版本（2）形状。
 * 对非 v1 输入（v2 / 缺失版本 / 非对象）恒等返回（幂等）。
 */
export function migrateFlowSchema(input: unknown): unknown {
  if (!isRecord(input)) return input
  if (input.version !== 1) return input
  const nodes = Array.isArray(input.nodes) ? input.nodes.map(migrateNode) : input.nodes
  return { ...input, version: 2, nodes }
}

function migrateNode(node: unknown): unknown {
  if (!isRecord(node) || node.type !== 'task' || !isRecord(node.data)) return node
  const steps = node.data.steps
  if (!Array.isArray(steps)) return node
  return { ...node, data: { ...node.data, steps: steps.map(migrateStep) } }
}

function migrateStep(step: unknown): unknown {
  if (!isRecord(step) || !Array.isArray(step.actions)) return step
  return { ...step, actions: step.actions.map(migrateAction) }
}

function migrateAction(action: unknown): unknown {
  if (!isRecord(action)) return action
  return { tool: action.name, purpose: '', expectedResult: '', params: action.params }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
