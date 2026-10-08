import { describe, expect, it } from 'vitest'

import type { ExitCondition, FlowEdge, FlowNode, FlowSchema, TaskData } from '../schema'

import { RULES } from './types'
import type { Issue, RuleId } from './types'
import { validate } from './validate'

/** 节点构造器 */
const startNode = (id = 's', goal = '全局目标'): FlowNode => ({
  id,
  type: 'start',
  position: { x: 0, y: 0 },
  data: { goal },
})

const finalNode = (id = 'f', answer = '最终产出'): FlowNode => ({
  id,
  type: 'final',
  position: { x: 0, y: 0 },
  data: { answer },
})

function taskNode(id = 't', overrides: Partial<TaskData> = {}): FlowNode {
  const data: TaskData = {
    name: '任务名',
    goal: '任务目标',
    input: '输入描述',
    steps: [
      { id: `${id}-s1`, thought: '思考', actions: [{ name: 'tool', params: {} }], observation: '观察' },
    ],
    loop: { exitConditions: [{ type: 'goal_achieved' }] },
    precondition: '前提条件',
    onFailure: { reflection: '反思', replan: '重规划', maxRetries: 3 },
    ...overrides,
  }
  return { id, type: 'task', position: { x: 0, y: 0 }, data }
}

/** 边构造器 */
const success = (id: string, source: string, target: string, condition: ExitCondition | null): FlowEdge => ({
  id,
  source,
  target,
  kind: 'success',
  data: { condition },
})
const failure = (id: string, source: string, target: string, condition: ExitCondition | null = null): FlowEdge => ({
  id,
  source,
  target,
  kind: 'failure',
  data: { condition },
})

const mkSchema = (nodeList: FlowNode[], edgeList: FlowEdge[]): FlowSchema => ({
  version: 1,
  meta: { name: '测试任务流' },
  nodes: nodeList,
  edges: edgeList,
})

/** 基线：完整合法的任务流（应当零问题） */
function baseline(): FlowSchema {
  return mkSchema(
    [startNode('s', '完成出行建议'), taskNode('t'), finalNode('f')],
    [
      success('e1', 's', 't', null),
      success('e2', 't', 'f', { type: 'goal_achieved' }),
      failure('e3', 't', 'f', { type: 'max_iterations', params: { max: 3 } }),
    ],
  )
}

const ruleIds = (issues: Issue[]): RuleId[] => issues.map((issue) => issue.ruleId)

function issuesOf(schema: FlowSchema, rule: RuleId): Issue[] {
  return validate(schema).filter((issue) => issue.ruleId === rule)
}

describe('校验基础', () => {
  it('规则注册表：15 条规则、id 唯一', () => {
    expect(RULES).toHaveLength(15)
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(15)
  })

  it('空画布不产生任何问题', () => {
    expect(validate(mkSchema([], []))).toEqual([])
  })

  it('完整任务流零问题（全规则正例）', () => {
    expect(validate(baseline())).toEqual([])
  })
})

describe('逐节点：ReAct 必备要素', () => {
  it('E1 任务名或目标为空时定位到该任务', () => {
    const schema = baseline()
    ;(schema.nodes[1] as { data: TaskData }).data = { ...(schema.nodes[1] as { data: TaskData }).data, name: '  ' }
    const issues = issuesOf(schema, 'E1')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['t'])
    expect(issues[0]!.message).toContain('缺少名称或目标')
  })

  it('E2 步骤序列为空时报 error（且不再报 W1）', () => {
    const schema = baseline()
    ;(schema.nodes[1] as { data: TaskData }).data = { ...(schema.nodes[1] as { data: TaskData }).data, steps: [] }
    expect(ruleIds(validate(schema))).toContain('E2')
    expect(ruleIds(validate(schema))).not.toContain('W1')
  })

  it('W1 步骤缺项（无行动 / 无观察）时报 warning', () => {
    const schema = baseline()
    const data = (schema.nodes[1] as { data: TaskData }).data
    ;(schema.nodes[1] as { data: TaskData }).data = {
      ...data,
      steps: [
        { id: 't-s1', thought: '想', actions: [], observation: '看' },
        { id: 't-s2', thought: '想', actions: [{ name: 'tool', params: {} }], observation: '' },
      ],
    }
    const issues = issuesOf(schema, 'W1')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.severity).toBe('warning')
  })

  it('E3 循环退出条件为空时报 error', () => {
    const schema = baseline()
    const data = (schema.nodes[1] as { data: TaskData }).data
    ;(schema.nodes[1] as { data: TaskData }).data = { ...data, loop: { exitConditions: [] } }
    const issues = issuesOf(schema, 'E3')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['t'])
  })

  it('W2 仅有异常退出时提示补充可控退出条件', () => {
    const schema = baseline()
    const data = (schema.nodes[1] as { data: TaskData }).data
    ;(schema.nodes[1] as { data: TaskData }).data = {
      ...data,
      loop: { exitConditions: [{ type: 'error' }] },
    }
    const issues = issuesOf(schema, 'W2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('可控退出')
  })

  it('E4 有成功出边但前提条件为空时报 error', () => {
    const schema = baseline()
    const data = (schema.nodes[1] as { data: TaskData }).data
    ;(schema.nodes[1] as { data: TaskData }).data = { ...data, precondition: '' }
    const issues = issuesOf(schema, 'E4')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['t'])
  })

  it('E4 正例：无成功出边的任务不要求前提条件', () => {
    const schema = mkSchema(
      [startNode('s'), taskNode('t'), finalNode('f')],
      [success('e1', 's', 't', null), failure('e2', 't', 'f', null)],
    )
    ;(schema.nodes[1] as { data: TaskData }).data = { ...(schema.nodes[1] as { data: TaskData }).data, precondition: '' }
    expect(ruleIds(validate(schema))).not.toContain('E4')
  })

  it('W3 反思或重规划为空时报 warning', () => {
    const schema = baseline()
    const data = (schema.nodes[1] as { data: TaskData }).data
    ;(schema.nodes[1] as { data: TaskData }).data = {
      ...data,
      onFailure: { reflection: '', replan: '重规划', maxRetries: 3 },
    }
    const issues = issuesOf(schema, 'W3')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('反思或重规划')
  })

  it('W4 只有成功出边、没有失败出口时报 warning', () => {
    const schema = baseline()
    schema.edges = schema.edges.filter((edge) => edge.id !== 'e3')
    expect(ruleIds(validate(schema))).toContain('W4')
  })
})

describe('边与顶层任务流', () => {
  it('E5 非 start 出边的 success 边缺条件时报 error 并定位到边', () => {
    const schema = baseline()
    schema.edges = schema.edges.map((edge) =>
      edge.id === 'e2' ? success('e2', 't', 'f', null) : edge,
    )
    const issues = issuesOf(schema, 'E5')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['e2'])
  })

  it('E5 正例：start 出边豁免（条件为 null 不报）', () => {
    expect(ruleIds(validate(baseline()))).not.toContain('E5')
  })

  it('E6 缺少开始节点时报 error', () => {
    const schema = mkSchema([taskNode('t')], [])
    expect(ruleIds(validate(schema))).toContain('E6')
  })

  it('E6 开始节点目标为空时报 error 并定位', () => {
    const schema = baseline()
    ;(schema.nodes[0] as { data: { goal: string } }).data = { goal: '  ' }
    const issues = issuesOf(schema, 'E6')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['s'])
  })

  it('E7 无 final 或不可达时报 error', () => {
    const noFinal = mkSchema([startNode('s'), taskNode('t')], [success('e1', 's', 't', null)])
    expect(ruleIds(validate(noFinal))).toContain('E7')

    // 移除 t 的全部出边（success 与 failure）→ final 不可达
    const schema = baseline()
    schema.edges = schema.edges.filter((edge) => edge.id === 'e1')
    expect(ruleIds(validate(schema))).toContain('E7')
  })

  it('E7 正例：经 failure 边到达 final 也算终止路径', () => {
    const schema = baseline()
    schema.edges = schema.edges.filter((edge) => edge.id !== 'e2') // 仅剩 failure 边 t→f
    expect(ruleIds(validate(schema))).not.toContain('E7')
  })

  it('E8 失败回退环没有成功出口时报 error 并定位环内节点', () => {
    const schema = mkSchema(
      [startNode('s'), taskNode('t1'), taskNode('t2'), finalNode('f')],
      [
        success('e1', 's', 't1', null),
        failure('e2', 't1', 't2'),
        failure('e3', 't2', 't1'),
      ],
    )
    const issues = issuesOf(schema, 'E8')
    expect(issues).toHaveLength(1)
    expect([...issues[0]!.cellIds].sort()).toEqual(['t1', 't2'])
    // 同时因无法到达 final 触发 E7（预期内的叠加）
    expect(ruleIds(validate(schema))).toContain('E7')
  })

  it('E8 正例：为失败回退环补成功出口后 error 消失', () => {
    const schema = mkSchema(
      [startNode('s'), taskNode('t1'), taskNode('t2'), finalNode('f')],
      [
        success('e1', 's', 't1', null),
        failure('e2', 't1', 't2'),
        failure('e3', 't2', 't1'),
        success('e4', 't2', 'f', { type: 'goal_achieved' }),
      ],
    )
    expect(ruleIds(validate(schema))).not.toContain('E8')
  })

  it('W5 孤立节点报 warning 并定位', () => {
    const schema = baseline()
    schema.nodes.push(taskNode('lonely'))
    const issues = issuesOf(schema, 'W5')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.cellIds).toEqual(['lonely'])
  })

  it('W6 非 final 节点没有出边时报 warning（流程中断）', () => {
    const schema = baseline()
    schema.edges = schema.edges.filter((edge) => edge.source !== 't')
    const issues = issuesOf(schema, 'W6').filter((issue) => issue.cellIds.includes('t'))
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('流程在此中断')
  })

  it('W7 多个开始节点时报 warning', () => {
    const schema = baseline()
    schema.nodes.push(startNode('s2'))
    const issues = issuesOf(schema, 'W7')
    expect(issues).toHaveLength(1)
    expect([...issues[0]!.cellIds].sort()).toEqual(['s', 's2'])
  })
})
