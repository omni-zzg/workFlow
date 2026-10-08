import { describe, expect, it } from 'vitest'

import { DEFAULT_META, graphToSchema, schemaToCells } from './convert'
import type { FlowSchema } from './types'

/** 覆盖样本：两个任务、多步骤、多退出条件、custom 条件、failure 边、null 条件 */
const sample: FlowSchema = {
  version: 1,
  meta: { name: '双任务流', description: '覆盖多步骤与 failure 边' },
  nodes: [
    { id: 's1', type: 'start', position: { x: 0, y: 0 }, data: { goal: '为用户生成出行建议' } },
    {
      id: 't1',
      type: 'task',
      position: { x: 0, y: 120 },
      data: {
        name: '查询天气',
        goal: '获取目标城市实时天气',
        input: '用户问题中的城市（默认北京）',
        steps: [
          {
            id: 't1-s1',
            thought: '需要调用天气工具',
            actions: [{ name: 'get_weather', params: { city: '北京', strict: true } }],
            observation: '返回温度与天气状况',
          },
          {
            id: 't1-s2',
            thought: '校验字段完整性',
            actions: [{ name: 'validate', params: {} }],
            observation: '字段齐全进入判断',
          },
        ],
        loop: {
          exitConditions: [
            { type: 'goal_achieved' },
            { type: 'max_iterations', params: { max: 5 } },
            { type: 'custom', text: '重试两次仍失败则转人工' },
          ],
        },
        precondition: '拿到有效天气数据',
        onFailure: {
          reflection: '分析失败原因：网络？城市名？',
          replan: '修正城市名或改用备用数据源',
          maxRetries: 3,
        },
      },
    },
    {
      id: 't2',
      type: 'task',
      position: { x: 380, y: 120 },
      data: {
        name: '生成建议',
        goal: '基于天气生成出行建议',
        input: 't1 的天气数据',
        steps: [
          { id: 't2-s1', thought: '结合天气生成建议', actions: [], observation: '建议文本' },
        ],
        loop: { exitConditions: [{ type: 'goal_achieved' }] },
        precondition: '建议已生成',
        onFailure: { reflection: '', replan: '', maxRetries: 0 },
      },
    },
    { id: 'f1', type: 'final', position: { x: 0, y: 480 }, data: { answer: '最终建议' } },
  ],
  edges: [
    { id: 'e1', source: 's1', target: 't1', kind: 'success', data: { condition: null } },
    {
      id: 'e2',
      source: 't1',
      target: 't2',
      kind: 'success',
      data: { condition: { type: 'goal_achieved' } },
    },
    {
      id: 'e3',
      source: 't2',
      target: 't1',
      kind: 'failure',
      data: { condition: { type: 'max_iterations', params: { max: 2 } } },
    },
    {
      id: 'e4',
      source: 't2',
      target: 'f1',
      kind: 'success',
      data: { condition: { type: 'custom', text: '建议已确认' } },
    },
  ],
}

describe('convert：持久化格式 <-> 中间形态', () => {
  it('schema → cells → schema 语义等价（多步骤 + failure 边 + custom 条件）', () => {
    const cells = schemaToCells(sample)
    const back = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: sample.meta })
    expect(back).toEqual(sample)
  })

  it('cells → schema → cells 等价', () => {
    const cells = schemaToCells(sample)
    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: sample.meta })
    expect(schemaToCells(schema)).toEqual(cells)
  })

  it('任务步骤与动作参数完整保留', () => {
    const cells = schemaToCells(sample)
    const task = cells.nodes.find((node) => node.id === 't1')
    expect(task).toBeDefined()
    const data = task!.data as {
      steps: { thought: string; actions: { name: string; params: Record<string, unknown> }[] }[]
    }
    expect(data.steps).toHaveLength(2)
    expect(data.steps[0]!.thought).toBe('需要调用天气工具')
    expect(data.steps[0]!.actions[0]).toEqual({
      name: 'get_weather',
      params: { city: '北京', strict: true },
    })
  })

  it('草稿态：条件为 null 时保持 null（start 出边与 failure 边）', () => {
    const cells = schemaToCells(sample)
    const byId = new Map(cells.edges.map((edge) => [edge.id, edge]))
    expect(byId.get('e1')?.condition).toBeNull()
    const draft = structuredClone(sample)
    draft.edges.push({ id: 'e5', source: 't1', target: 'f1', kind: 'failure', data: { condition: null } })
    const back2 = graphToSchema({
      nodes: schemaToCells(draft).nodes,
      edges: schemaToCells(draft).edges,
      meta: draft.meta,
    })
    const edge = back2.edges.find((item) => item.id === 'e5')
    expect(edge).toEqual({
      id: 'e5',
      source: 't1',
      target: 'f1',
      kind: 'failure',
      data: { condition: null },
    })
  })

  it('未提供 meta 时使用默认元信息', () => {
    const cells = schemaToCells(sample)
    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges })
    expect(schema.meta).toEqual(DEFAULT_META)
  })
})
