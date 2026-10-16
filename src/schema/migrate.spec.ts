import { describe, expect, it } from 'vitest'

import { migrateFlowSchema } from './migrate'

function makeV1Flow(): Record<string, unknown> {
  return {
    version: 1,
    meta: { name: '示例' },
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 }, data: { goal: '目标' } },
      {
        id: 't1',
        type: 'task',
        position: { x: 0, y: 100 },
        data: {
          name: '查询天气',
          goal: '拿到天气数据',
          input: '城市名',
          steps: [
            {
              id: 't1-s1',
              thought: '需要调用天气工具',
              actions: [
                { name: 'get_weather', params: { city: '北京', strict: true } },
                { name: 'validate_fields', params: {} },
              ],
              observation: '返回温度与天气状况',
            },
          ],
          loop: { exitConditions: [{ type: 'goal_achieved' }] },
          precondition: '数据有效',
          onFailure: { reflection: '分析原因', replan: '换数据源', maxRetries: 3 },
        },
      },
      {
        id: 't2',
        type: 'task',
        position: { x: 0, y: 200 },
        data: {
          name: '整理',
          goal: '出结论',
          input: '',
          steps: [{ id: 't2-s1', thought: '', actions: [], observation: '' }],
          loop: { exitConditions: [] },
          precondition: '',
          onFailure: { reflection: '', replan: '', maxRetries: 3 },
        },
      },
      { id: 'f', type: 'final', position: { x: 0, y: 300 }, data: { answer: '答案' } },
    ],
    edges: [{ id: 'e1', source: 's', target: 't1', kind: 'normal' }],
  }
}

describe('migrate：v1 → v2 迁移', () => {
  it('全量映射：name → tool，purpose/expectedResult 补空，参数原样保留', () => {
    const v1 = makeV1Flow()
    const migrated = migrateFlowSchema(v1) as Record<string, unknown>
    expect(migrated.version).toBe(2)

    const nodes = migrated.nodes as Record<string, unknown>[]
    const steps = (nodes[1]!.data as Record<string, unknown>).steps as Record<string, unknown>[]
    expect(steps[0]!.actions).toStrictEqual([
      { tool: 'get_weather', purpose: '', expectedResult: '', params: { city: '北京', strict: true } },
      { tool: 'validate_fields', purpose: '', expectedResult: '', params: {} },
    ])
    // 空 actions 的步骤原样，无迁移痕迹
    const steps2 = (nodes[2]!.data as Record<string, unknown>).steps as Record<string, unknown>[]
    expect(steps2[0]!.actions).toStrictEqual([])
    // 非任务节点、meta、edges 原样
    expect(nodes[0]!.type).toBe('start')
    expect(migrated.meta).toBe(v1.meta)
    expect(migrated.edges).toBe(v1.edges)
  })

  it('迁移输出的行动键序为 tool → purpose → expectedResult → params（字节等价契约）', () => {
    const migrated = migrateFlowSchema(makeV1Flow()) as Record<string, unknown>
    const nodes = migrated.nodes as Record<string, unknown>[]
    const steps = (nodes[1]!.data as Record<string, unknown>).steps as Record<string, unknown>[]
    const action = (steps[0]!.actions as Record<string, unknown>[])[0]!
    expect(Object.keys(action)).toEqual(['tool', 'purpose', 'expectedResult', 'params'])
  })

  it('非 v1 输入恒等返回（v2 / 无版本 / null / 数组 / 字符串），且幂等', () => {
    const v2 = { version: 2, meta: { name: 'x' }, nodes: [], edges: [] }
    expect(migrateFlowSchema(v2)).toBe(v2)
    expect(migrateFlowSchema({ meta: {}, nodes: [], edges: [] })).not.toHaveProperty('version')
    expect(migrateFlowSchema(null)).toBeNull()
    expect(migrateFlowSchema('text')).toBe('text')
    const arr: unknown[] = []
    expect(migrateFlowSchema(arr)).toBe(arr)

    const once = migrateFlowSchema(makeV1Flow())
    expect(migrateFlowSchema(once)).toBe(once)
  })

  it('畸形形状防御：不抛错，畸形元素原样交给 zod 报路径', () => {
    const weird = {
      version: 1,
      meta: {},
      edges: [],
      nodes: [
        { id: 'a', type: 'task', position: { x: 0, y: 0 }, data: { steps: 'oops' } },
        {
          id: 'b',
          type: 'task',
          position: { x: 0, y: 0 },
          data: {
            steps: [
              null,
              { id: 's1', actions: 'nope' },
              { id: 's2', actions: [null, 42, { name: undefined, params: {} }] },
            ],
          },
        },
      ],
    }
    expect(() => migrateFlowSchema(weird)).not.toThrow()
    const out = migrateFlowSchema(weird) as Record<string, unknown>
    expect(out.version).toBe(2)
    const nodes = out.nodes as Record<string, unknown>[]
    expect((nodes[0]!.data as Record<string, unknown>).steps).toBe('oops')
    const steps = (nodes[1]!.data as Record<string, unknown>).steps as unknown[]
    expect(steps[0]).toBeNull()
    expect((steps[1] as Record<string, unknown>).actions).toBe('nope')
    const actions = (steps[2] as Record<string, unknown>).actions as unknown[]
    expect(actions[0]).toBeNull()
    expect(actions[1]).toBe(42)
    const last = actions[2] as Record<string, unknown>
    expect(Object.keys(last)).toEqual(['tool', 'purpose', 'expectedResult', 'params'])
    expect(last.tool).toBeUndefined()
  })
})
