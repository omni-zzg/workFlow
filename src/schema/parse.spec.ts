import { describe, expect, it } from 'vitest'

import { parseFlowSchema, parseFlowSchemaText } from './parse'

function makeValidFlow(): Record<string, unknown> {
  return {
    version: 1,
    meta: { name: '示例' },
    nodes: [
      { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { goal: '目标' } },
      { id: 'n2', type: 'final', position: { x: 0, y: 100 }, data: { answer: '答案' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        kind: 'exit',
        data: { condition: { type: 'goal_achieved' } },
      },
    ],
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('parse：导入校验', () => {
  it('合法输入解析成功', () => {
    const result = parseFlowSchema(makeValidFlow())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.schema.nodes).toHaveLength(2)
      expect(result.schema.edges[0]?.kind).toBe('exit')
    }
  })

  it('JSON 语法错误：报解析失败', () => {
    const result = parseFlowSchemaText('{ "version": 1, ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toContain('JSON 解析失败')
    }
  })

  it('缺少必需字段：错误带字段路径', () => {
    const flow = makeValidFlow()
    delete (flow.nodes as Record<string, unknown>[])[0]!.data
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('；')).toContain('nodes.0')
    }
  })

  it('未知节点类型：报出类型与位置', () => {
    const flow = clone(makeValidFlow())
    ;(flow.nodes as Record<string, unknown>[])[0]!.type = 'retry'
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual(['nodes.0.type：未知的节点类型 "retry"'])
    }
  })

  it('未知退出条件类型：报出类型与位置', () => {
    const flow = clone(makeValidFlow())
    const edge = (flow.edges as Record<string, unknown>[])[0]!
    ;(edge.data as Record<string, unknown>).condition = { type: 'never' }
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([
        'edges.0.data.condition.type：未知的退出条件类型 "never"',
      ])
    }
  })

  it('不支持的版本：说明当前支持版本', () => {
    const flow = clone(makeValidFlow())
    flow.version = 99
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toContain('不支持的版本 99')
    }
  })

  it('exit 边条件为 null 的结构合法（草稿态，由校验规则标记）', () => {
    const flow = clone(makeValidFlow())
    const edge = (flow.edges as Record<string, unknown>[])[0]!
    ;(edge.data as Record<string, unknown>).condition = null
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(true)
  })

  it('未识别的额外字段被忽略（为字段扩展留余地）', () => {
    const flow = clone(makeValidFlow())
    flow.futureField = { anything: true }
    ;((flow.nodes as Record<string, unknown>[])[0]!).color = 'red'
    const result = parseFlowSchema(flow)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('futureField' in result.schema).toBe(false)
    }
  })
})
