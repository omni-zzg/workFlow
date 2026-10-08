import { describe, expect, it } from 'vitest'

import { DEFAULT_META, graphToSchema, schemaToCells } from './convert'
import type { FlowSchema } from './types'

/** 覆盖样本：两个循环、多条 exit 边、custom 条件、带参数条件、六类节点 */
const sample: FlowSchema = {
  version: 1,
  meta: { name: '检索-回答双循环', description: '覆盖多循环与 custom 条件' },
  nodes: [
    { id: 's1', type: 'start', position: { x: 100, y: 40 }, data: { goal: '回答问题并确保引用可靠' } },
    { id: 't1', type: 'thought', position: { x: 100, y: 140 }, data: { content: '先检索资料' } },
    {
      id: 'a1',
      type: 'action',
      position: { x: 100, y: 240 },
      data: { tool: { name: 'search', params: { q: 'ReAct', topK: 5, strict: true } } },
    },
    { id: 'o1', type: 'observation', position: { x: 100, y: 340 }, data: { content: '返回 3 篇文档' } },
    { id: 'd1', type: 'decision', position: { x: 100, y: 440 }, data: { criteria: '资料是否足够' } },
    { id: 't2', type: 'thought', position: { x: 100, y: 540 }, data: { content: '校对引用' } },
    { id: 'd2', type: 'decision', position: { x: 100, y: 640 }, data: {} },
    { id: 'f1', type: 'final', position: { x: 380, y: 640 }, data: { answer: '最终答案' } },
  ],
  edges: [
    { id: 'e1', source: 's1', target: 't1', kind: 'sequence' },
    { id: 'e2', source: 't1', target: 'a1', kind: 'sequence' },
    { id: 'e3', source: 'a1', target: 'o1', kind: 'sequence' },
    { id: 'e4', source: 'o1', target: 'd1', kind: 'sequence' },
    { id: 'e5', source: 'd1', target: 't1', kind: 'loop' },
    {
      id: 'e6',
      source: 'd1',
      target: 't2',
      kind: 'exit',
      data: { condition: { type: 'goal_achieved' } },
    },
    { id: 'e7', source: 'd2', target: 't2', kind: 'loop' },
    { id: 'e8', source: 't2', target: 'd2', kind: 'sequence' },
    {
      id: 'e9',
      source: 'd2',
      target: 'f1',
      kind: 'exit',
      data: { condition: { type: 'max_iterations', params: { max: 8 } } },
    },
    {
      id: 'e10',
      source: 'd2',
      target: 'f1',
      kind: 'exit',
      data: { condition: { type: 'custom', text: '连续两次观察到 404' } },
    },
  ],
}

describe('convert：持久化格式 <-> 中间形态', () => {
  it('schema → cells → schema 语义等价（多循环 + custom 条件）', () => {
    const cells = schemaToCells(sample)
    const back = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: sample.meta })
    expect(back).toEqual(sample)
  })

  it('cells → schema → cells 等价', () => {
    const cells = schemaToCells(sample)
    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: sample.meta })
    expect(schemaToCells(schema)).toEqual(cells)
  })

  it('草稿态：exit 边条件为 null 时保持 null', () => {
    const draft = structuredClone(sample)
    draft.edges.push({
      id: 'e11',
      source: 'd2',
      target: 'f1',
      kind: 'exit',
      data: { condition: null },
    })
    const cells = schemaToCells(draft)
    const back = graphToSchema({ nodes: cells.nodes, edges: cells.edges, meta: draft.meta })
    const edge = back.edges.find((item) => item.id === 'e11')
    expect(edge).toEqual({ id: 'e11', source: 'd2', target: 'f1', kind: 'exit', data: { condition: null } })
  })

  it('非 exit 边的 condition 归一化为 null', () => {
    const cells = schemaToCells(sample)
    for (const edge of cells.edges) {
      if (edge.kind !== 'exit') expect(edge.condition).toBeNull()
    }
  })

  it('未提供 meta 时使用默认元信息', () => {
    const cells = schemaToCells(sample)
    const schema = graphToSchema({ nodes: cells.nodes, edges: cells.edges })
    expect(schema.meta).toEqual(DEFAULT_META)
  })
})
