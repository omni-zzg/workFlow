import { z } from 'zod'

import type { FlowSchema } from './types'

/**
 * 导入校验（design D5）：zod 定义与 TS 类型同源。
 * - 未识别的额外字段被忽略（为字段级扩展留余地）
 * - 未知类型 / 缺失必需字段 / 不支持的版本 → 返回带路径的可读错误，拒绝导入
 */

const positionZod = z.object({ x: z.number(), y: z.number() })

const conditionZod = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goal_achieved') }),
  z.object({ type: z.literal('max_iterations'), params: z.object({ max: z.number() }) }),
  z.object({ type: z.literal('timeout'), params: z.object({ seconds: z.number() }) }),
  z.object({ type: z.literal('budget'), params: z.object({ tokens: z.number() }) }),
  z.object({ type: z.literal('error') }),
  z.object({ type: z.literal('human_interrupt') }),
  z.object({ type: z.literal('custom'), text: z.string() }),
])

const actionZod = z.object({
  name: z.string(),
  params: z.record(z.string(), z.unknown()),
})

const stepZod = z.object({
  id: z.string().min(1),
  thought: z.string(),
  actions: z.array(actionZod),
  observation: z.string(),
})

const taskDataZod = z.object({
  name: z.string(),
  goal: z.string(),
  input: z.string(),
  steps: z.array(stepZod),
  loop: z.object({ exitConditions: z.array(conditionZod) }),
  precondition: z.string(),
  onFailure: z.object({
    reflection: z.string(),
    replan: z.string(),
    maxRetries: z.number(),
  }),
})

const nodeSizeZod = z.object({ width: z.number(), height: z.number() }).optional()

const nodeZod = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('start'),
    position: positionZod,
    size: nodeSizeZod,
    data: z.object({ goal: z.string() }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('task'),
    position: positionZod,
    size: nodeSizeZod,
    data: taskDataZod,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('final'),
    position: positionZod,
    size: nodeSizeZod,
    data: z.object({ answer: z.string() }),
  }),
])

const edgeBase = {
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
}

const edgeZod = z.discriminatedUnion('kind', [
  z.object({ ...edgeBase, kind: z.literal('normal') }),
  z.object({ ...edgeBase, kind: z.literal('exception') }),
])

export const flowSchemaZod = z.object({
  version: z.literal(1),
  meta: z.object({ name: z.string(), description: z.string().optional() }),
  nodes: z.array(nodeZod),
  edges: z.array(edgeZod),
})

export type ParseFlowSchemaResult =
  | { ok: true; schema: FlowSchema }
  | { ok: false; errors: string[] }

const NODE_TYPES: readonly string[] = ['start', 'task', 'final']
const EDGE_KINDS: readonly string[] = ['normal', 'exception']
const CONDITION_TYPES: readonly string[] = [
  'goal_achieved',
  'max_iterations',
  'timeout',
  'budget',
  'error',
  'human_interrupt',
  'custom',
]

/** 对未知类型做前置扫描，产出比 zod 泛化错误更精确的说明 */
function collectUnknownTypeErrors(input: unknown): string[] {
  const errors: string[] = []
  if (!input || typeof input !== 'object') return errors
  const obj = input as Record<string, unknown>

  const nodes = Array.isArray(obj.nodes) ? obj.nodes : []
  nodes.forEach((node, index) => {
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const type = record.type
      if (typeof type === 'string' && !NODE_TYPES.includes(type)) {
        errors.push(`nodes.${index}.type：未知的节点类型 "${type}"`)
      }
      // 任务节点的循环退出条件同样前置扫描，给出比 zod 泛化错误更精确的说明
      if (type === 'task' && record.data && typeof record.data === 'object') {
        const loop = (record.data as Record<string, unknown>).loop
        if (loop && typeof loop === 'object') {
          const exitConditions = (loop as Record<string, unknown>).exitConditions
          if (Array.isArray(exitConditions)) {
            exitConditions.forEach((condition, conditionIndex) => {
              if (condition && typeof condition === 'object') {
                const conditionType = (condition as Record<string, unknown>).type
                if (typeof conditionType === 'string' && !CONDITION_TYPES.includes(conditionType)) {
                  errors.push(
                    `nodes.${index}.data.loop.exitConditions.${conditionIndex}：未知的条件类型 "${conditionType}"`,
                  )
                }
              }
            })
          }
        }
      }
    }
  })

  const edges = Array.isArray(obj.edges) ? obj.edges : []
  edges.forEach((edge, index) => {
    if (edge && typeof edge === 'object') {
      const record = edge as Record<string, unknown>
      const kind = record.kind
      if (typeof kind === 'string' && !EDGE_KINDS.includes(kind)) {
        errors.push(`edges.${index}.kind：未知的连线类型 "${kind}"`)
      }
    }
  })

  return errors
}

interface ZodLikeIssue {
  path: PropertyKey[]
  code: string
  message: string
}

const CODE_LABELS: Record<string, string> = {
  invalid_type: '类型不正确或缺少必需字段',
  invalid_value: '值不在允许范围内',
  invalid_union: '不匹配任何允许的结构',
  invalid_format: '格式不正确',
  too_small: '值过短或过小',
}

function formatIssue(issue: ZodLikeIssue): string {
  const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '(根)'
  const label = CODE_LABELS[issue.code] ?? issue.message
  return `${path}：${label}`
}

export function parseFlowSchema(input: unknown): ParseFlowSchemaResult {
  // 版本先行检查：给出明确原因（spec：拒绝不支持的版本并说明）
  if (input && typeof input === 'object' && 'version' in input) {
    const version = (input as Record<string, unknown>).version
    if (version !== 1) {
      return { ok: false, errors: [`不支持的版本 ${String(version)}（当前支持的版本为 1）`] }
    }
  }

  const unknownTypeErrors = collectUnknownTypeErrors(input)
  if (unknownTypeErrors.length > 0) {
    return { ok: false, errors: unknownTypeErrors }
  }

  const result = flowSchemaZod.safeParse(input)
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(formatIssue) }
  }
  // zod 已做运行时校验，此处断言为契约类型
  return { ok: true, schema: result.data as FlowSchema }
}

export function parseFlowSchemaText(text: string): ParseFlowSchemaResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`],
    }
  }
  return parseFlowSchema(json)
}
