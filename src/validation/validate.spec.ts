import { describe, expect, it } from 'vitest'

import type { ExitCondition, FlowEdge, FlowNode, FlowSchema } from '../schema'

import { RULES } from './types'
import type { Issue, RuleId } from './types'
import { validate } from './validate'

const pos = { x: 0, y: 0 }

/** 节点构造器 */
const n = {
  start: (id: string, goal = '完成目标'): FlowNode => ({
    id,
    type: 'start',
    position: pos,
    data: { goal },
  }),
  thought: (id: string, content = '思考内容'): FlowNode => ({
    id,
    type: 'thought',
    position: pos,
    data: { content },
  }),
  action: (id: string, name = 'tool', params: Record<string, unknown> = {}): FlowNode => ({
    id,
    type: 'action',
    position: pos,
    data: { tool: { name, params } },
  }),
  observation: (id: string, content = '观察结果'): FlowNode => ({
    id,
    type: 'observation',
    position: pos,
    data: { content },
  }),
  decision: (id: string, criteria = '判断依据'): FlowNode => ({
    id,
    type: 'decision',
    position: pos,
    data: { criteria },
  }),
  final: (id: string, answer = '最终答案'): FlowNode => ({
    id,
    type: 'final',
    position: pos,
    data: { answer },
  }),
}

/** 边构造器 */
const seq = (id: string, source: string, target: string): FlowEdge => ({
  id,
  source,
  target,
  kind: 'sequence',
})
const loop = (id: string, source: string, target: string): FlowEdge => ({
  id,
  source,
  target,
  kind: 'loop',
})
const exit = (
  id: string,
  source: string,
  target: string,
  condition: ExitCondition | null,
): FlowEdge => ({ id, source, target, kind: 'exit', data: { condition } })

const mkSchema = (nodeList: FlowNode[], edgeList: FlowEdge[]): FlowSchema => ({
  version: 1,
  meta: { name: '测试流程' },
  nodes: nodeList,
  edges: edgeList,
})

/** 基线：完整合法的 ReAct 流程（应当零问题） */
function baseline(): FlowSchema {
  return mkSchema(
    [n.start('s'), n.thought('t'), n.action('a'), n.observation('o'), n.decision('d'), n.final('f')],
    [
      seq('e1', 's', 't'),
      seq('e2', 't', 'a'),
      seq('e3', 'a', 'o'),
      seq('e4', 'o', 'd'),
      loop('e5', 'd', 't'),
      exit('e6', 'd', 'f', { type: 'goal_achieved' }),
    ],
  )
}

const ruleIds = (issues: Issue[]): RuleId[] => issues.map((issue) => issue.ruleId)

function issuesOfRule(schema: FlowSchema, rule: RuleId): Issue[] {
  return validate(schema).filter((issue) => issue.ruleId === rule)
}

describe('校验基础', () => {
  it('规则注册表：12 条规则、id 唯一', () => {
    expect(RULES).toHaveLength(12)
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(12)
  })

  it('空画布不产生任何问题', () => {
    expect(validate(mkSchema([], []))).toEqual([])
  })

  it('完整 ReAct 流程零问题（全规则正例）', () => {
    expect(validate(baseline())).toEqual([])
  })
})

describe('error 级规则', () => {
  describe('E1 目标与入口', () => {
    it('缺少开始节点时报 error', () => {
      const issues = issuesOfRule(mkSchema([n.thought('t')], []), 'E1')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.severity).toBe('error')
      expect(issues[0]!.message).toContain('缺少开始节点')
    })

    it('goal 为空（含纯空白）时报 error 并定位到该节点', () => {
      const issues = issuesOfRule(mkSchema([n.start('s', '   ')], []), 'E1')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['s'])
    })

    it('正例：合法开始节点不报 E1', () => {
      expect(issuesOfRule(baseline(), 'E1')).toEqual([])
    })
  })

  describe('E2 死循环检测', () => {
    it('循环没有带条件的出口时报 error 并定位到循环内节点', () => {
      const schema = baseline()
      schema.edges = schema.edges.filter((edge) => edge.id !== 'e6')
      const issues = issuesOfRule(schema, 'E2')
      expect(issues).toHaveLength(1)
      expect([...issues[0]!.cellIds].sort()).toEqual(['a', 'd', 'o', 't'])
    })

    it('出口条件为 null 时报 E2（同时 E4 报该边）', () => {
      const schema = baseline()
      schema.edges = schema.edges.map((edge) =>
        edge.id === 'e6' ? exit('e6', 'd', 'f', null) : edge,
      )
      const ids = ruleIds(validate(schema))
      expect(ids).toContain('E2')
      expect(ids).toContain('E4')
    })

    it('正例：有带条件出口时不报 E2', () => {
      expect(issuesOfRule(baseline(), 'E2')).toEqual([])
    })
  })

  describe('E3 终止路径', () => {
    it('没有 final 节点时报 error', () => {
      const schema = baseline()
      schema.nodes = schema.nodes.filter((node) => node.id !== 'f')
      schema.edges = schema.edges.filter((edge) => edge.id !== 'e6')
      expect(ruleIds(validate(schema))).toContain('E3')
    })

    it('final 不可达时报 error', () => {
      const schema = baseline()
      schema.edges = schema.edges.filter((edge) => edge.id !== 'e6')
      expect(ruleIds(validate(schema))).toContain('E3')
    })

    it('正例：start 可达 final 时不报 E3', () => {
      expect(issuesOfRule(baseline(), 'E3')).toEqual([])
    })
  })

  describe('E4 退出条件完整性', () => {
    it('退出边无条件时报 error 并定位到该边', () => {
      const schema = baseline()
      schema.edges = schema.edges.map((edge) =>
        edge.id === 'e6' ? exit('e6', 'd', 'f', null) : edge,
      )
      const issues = issuesOfRule(schema, 'E4')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['e6'])
    })

    it('正例：条件齐全时不报 E4', () => {
      expect(issuesOfRule(baseline(), 'E4')).toEqual([])
    })
  })
})

describe('warning 级规则', () => {
  describe('W1 ReAct 三要素', () => {
    it('无 action/observation 时提示缺少链路', () => {
      const schema = mkSchema(
        [n.start('s'), n.thought('t'), n.final('f')],
        [seq('e1', 's', 't'), exit('e2', 't', 'f', { type: 'goal_achieved' })],
      )
      const issues = issuesOfRule(schema, 'W1')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.severity).toBe('warning')
    })

    it('action 未接入 observation（链不完整）时提示', () => {
      const schema = mkSchema(
        [n.start('s'), n.thought('t'), n.action('a'), n.final('f')],
        [
          seq('e1', 's', 't'),
          seq('e2', 't', 'a'),
          exit('e3', 'a', 'f', { type: 'goal_achieved' }),
        ],
      )
      expect(ruleIds(validate(schema))).toContain('W1')
    })

    it('正例：完整链不报 W1', () => {
      expect(issuesOfRule(baseline(), 'W1')).toEqual([])
    })
  })

  describe('W2 循环控制点', () => {
    it('循环内无 decision 时提示并定位循环', () => {
      const schema = mkSchema(
        [n.start('s'), n.thought('t'), n.action('a'), n.observation('o'), n.final('f')],
        [
          seq('e1', 's', 't'),
          seq('e2', 't', 'a'),
          seq('e3', 'a', 'o'),
          loop('e4', 'o', 't'),
          exit('e5', 'o', 'f', { type: 'goal_achieved' }),
        ],
      )
      const issues = issuesOfRule(schema, 'W2')
      expect(issues).toHaveLength(1)
      expect([...issues[0]!.cellIds].sort()).toEqual(['a', 'o', 't'])
    })

    it('正例：循环含 decision 不报 W2', () => {
      expect(issuesOfRule(baseline(), 'W2')).toEqual([])
    })
  })

  describe('W3 可控退出', () => {
    it('循环仅有异常退出时提示', () => {
      const schema = baseline()
      schema.edges = schema.edges.map((edge) =>
        edge.id === 'e6' ? exit('e6', 'd', 'f', { type: 'error' }) : edge,
      )
      const issues = issuesOfRule(schema, 'W3')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.message).toContain('可控退出')
    })

    it('正例：含目标达成不报 W3', () => {
      expect(issuesOfRule(baseline(), 'W3')).toEqual([])
    })
  })

  describe('W4 不可达节点', () => {
    it('孤立节点报 warning 并定位', () => {
      const schema = baseline()
      schema.nodes.push(n.action('x'))
      const issues = issuesOfRule(schema, 'W4')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['x'])
    })

    it('无 start 时跳过 W4（由 E1 覆盖）', () => {
      const ids = ruleIds(validate(mkSchema([n.thought('t')], [])))
      expect(ids).toContain('E1')
      expect(ids).not.toContain('W4')
    })

    it('正例：全可达不报 W4', () => {
      expect(issuesOfRule(baseline(), 'W4')).toEqual([])
    })
  })

  describe('W5 死路节点', () => {
    it('无法到达 final 的节点报 warning 并定位', () => {
      const schema = baseline()
      schema.nodes.push(n.action('y'))
      schema.edges.push(seq('e7', 'o', 'y'))
      const issues = issuesOfRule(schema, 'W5')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['y'])
      // y 从 start 可达，不应触发 W4
      expect(issuesOfRule(schema, 'W4')).toEqual([])
    })

    it('无 final 时跳过 W5（由 E3 覆盖）', () => {
      const schema = baseline()
      schema.nodes = schema.nodes.filter((node) => node.id !== 'f')
      schema.edges = schema.edges.filter((edge) => edge.id !== 'e6')
      expect(ruleIds(validate(schema))).not.toContain('W5')
    })

    it('正例：全部可到 final 不报 W5', () => {
      expect(issuesOfRule(baseline(), 'W5')).toEqual([])
    })
  })

  describe('W6 标注一致性', () => {
    it('非环边标记 loop 时报 warning 并定位到边', () => {
      const schema = baseline()
      schema.nodes.push(n.action('x'))
      schema.edges.push(loop('e7', 'd', 'x'))
      const issues = issuesOfRule(schema, 'W6')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['e7'])
    })

    it('成环但未标记 loop 时报 warning 并定位循环', () => {
      const schema = mkSchema(
        [n.start('s'), n.thought('t'), n.decision('d'), n.final('f')],
        [
          seq('e1', 's', 't'),
          seq('e2', 't', 'd'),
          seq('e3', 'd', 't'),
          exit('e4', 'd', 'f', { type: 'goal_achieved' }),
        ],
      )
      const issues = issuesOfRule(schema, 'W6')
      expect(issues).toHaveLength(1)
      expect([...issues[0]!.cellIds].sort()).toEqual(['d', 't'])
    })

    it('正例：标注一致不报 W6', () => {
      expect(issuesOfRule(baseline(), 'W6')).toEqual([])
    })
  })

  describe('W7 退出边源头', () => {
    it('exit 边不来自 decision 时提示并定位到边', () => {
      const schema = mkSchema(
        [n.start('s'), n.thought('t'), n.action('a'), n.observation('o'), n.final('f')],
        [
          seq('e1', 's', 't'),
          seq('e2', 't', 'a'),
          seq('e3', 'a', 'o'),
          exit('e4', 'o', 'f', { type: 'goal_achieved' }),
        ],
      )
      const issues = issuesOfRule(schema, 'W7')
      expect(issues).toHaveLength(1)
      expect(issues[0]!.cellIds).toEqual(['e4'])
    })

    it('正例：exit 来自 decision 不报 W7', () => {
      expect(issuesOfRule(baseline(), 'W7')).toEqual([])
    })
  })

  describe('W8 入口唯一性', () => {
    it('多个开始节点时报 warning', () => {
      const schema = mkSchema(
        [n.start('s1'), n.start('s2'), n.thought('t'), n.final('f')],
        [
          seq('e1', 's1', 't'),
          seq('e2', 's2', 't'),
          exit('e3', 't', 'f', { type: 'goal_achieved' }),
        ],
      )
      const issues = issuesOfRule(schema, 'W8')
      expect(issues).toHaveLength(1)
      expect([...issues[0]!.cellIds].sort()).toEqual(['s1', 's2'])
    })

    it('正例：单入口不报 W8', () => {
      expect(issuesOfRule(baseline(), 'W8')).toEqual([])
    })
  })
})
