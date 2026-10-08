import { describe, expect, it } from 'vitest'

import { parseFlowSchema, parseFlowSchemaText } from './parse'

function makeValidFlow(): Record<string, unknown> {
  return {
    version: 1,
    meta: { name: '示例' },
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { goal: '目标' } },
      {
        id: 't',
        type: 'task',
        position: { x: 0, y: 100 },
        data: {
          name: '查询天气',
          goal: '拿到天气数据',
          input: '城市名',
          steps: [{ id: 't-s1', thought: '需要调用工具', actions: [], observation: '返回数据' }],
          loop: { exitConditions: [{ type: 'goal_achieved' }] },
          precondition: '数据有效',
          onFailure: { reflection: '分析原因', replan: '换数据源', maxRetries: 3 },
        },
      },
      { id: 'f', type: 'final', position: { x: 0, y: 200 }, data: { answer: '答案' } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 't', kind: 'success', data: { condition: null } },
      {
        id: 'e2',
        source: 't',
        target: 'f',
        kind: 'success',
        data: { condition: { type: 'goal_achieved' } },
      },
      { id: 'e3', source: 't', target: 'f', kind: 'failure', data: { condition: null } },
    ],
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('parse：导入校验（任务流模型）', () => {
  it('合法输入解析成功（含节点内 ReAct 结构与 null 条件）', () => {
    const result = parseFlowSchema(makeValidFlow())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.schema.nodes).toHaveLength(3)
      const task = result.schema.nodes.find((node) => node.type === 'task')
      expect(task?.data.name).toBe('查询天气')
      if (task) expect(task.data.steps).toHaveLength(1)
      expect(result.schema.edges.map((edge) => edge.kind)).toEqual(['success', 'success', 'failure'])
    }
  })

  it('JSON 语法错误：报解析失败', () => {
    const result = parseFlowSchemaText('{ "version": 1, ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('JSON 解析失败')
  })

  it('缺少必需字段：错误带字段路径', () => {
    const flow = clone(makeValidFlow())
    delete ((flow.nodes as Record<string, unknown>[])[1]!.data as Record<string, unknown>).onFailure
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join('；')).toContain('nodes.1.data')
  })

  it('旧模型节点类型（thought）按未知类型拒绝并给位置', () => {
    const flow = clone(makeValidFlow())
    ;(flow.nodes as Record<string, unknown>[])[0]!.type = 'thought'
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toBe('nodes.0.type：未知的节点类型 "thought"')
    }
  })

  it('未知连线类型：报出类型与位置', () => {
    const flow = clone(makeValidFlow())
    ;(flow.edges as Record<string, unknown>[])[0]!.kind = 'loop'
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toBe('edges.0.kind：未知的连线类型 "loop"')
    }
  })

  it('未知条件类型（边）：报出类型与位置', () => {
    const flow = clone(makeValidFlow())
    const edge = (flow.edges as Record<string, unknown>[])[1]!
    ;(edge.data as Record<string, unknown>).condition = { type: 'never' }
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toBe('edges.1.data.condition.type：未知的条件类型 "never"')
    }
  })

  it('未知条件类型（任务的循环退出条件）：报出类型与位置', () => {
    const flow = clone(makeValidFlow())
    const taskData = (flow.nodes as Record<string, unknown>[])[1]!.data as Record<string, unknown>
    ;(taskData.loop as Record<string, unknown>).exitConditions = [{ type: 'forever' }]
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toBe(
        'nodes.1.data.loop.exitConditions.0：未知的条件类型 "forever"',
      )
    }
  })

  it('不支持的版本：说明当前支持版本', () => {
    const flow = clone(makeValidFlow())
    flow.version = 99
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('不支持的版本 99')
  })

  it('未识别的额外字段被忽略（为字段扩展留余地）', () => {
    const flow = clone(makeValidFlow())
    flow.futureField = { anything: true }
    ;((flow.nodes as Record<string, unknown>[])[0]!).color = 'red'
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(true)
    if (result.ok) expect('futureField' in result.schema).toBe(false)
  })
})
