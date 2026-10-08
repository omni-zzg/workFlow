import type { Graph } from '@antv/x6'

import type { FlowMeta, RawEdge, RawNode } from '@/schema'

import { insertRawGraph } from './project'

/**
 * ReAct 骨架模板（spec: flow-canvas-editing）：
 * start -> thought -> action -> observation -> decision -> final，
 * 含 loop 回边与一条 goal_achieved 退出边；占位文案为引导性内容，插入即通过全部校验。
 */
export interface ReactTemplateCells {
  nodes: RawNode[]
  edges: RawEdge[]
  meta: FlowMeta
}

export function buildReactTemplateCells(idSuffix = ''): ReactTemplateCells {
  const id = (base: string): string => `${base}${idSuffix}`

  const nodes: RawNode[] = [
    { id: id('tpl-start'), nodeType: 'start', x: 360, y: 40, data: { goal: '填写任务目标' } },
    {
      id: id('tpl-thought'),
      nodeType: 'thought',
      x: 360,
      y: 150,
      data: { content: '填写推理内容：现在该做什么' },
    },
    {
      id: id('tpl-action'),
      nodeType: 'action',
      x: 360,
      y: 280,
      data: { tool: { name: 'tool_name', params: {} } },
    },
    {
      id: id('tpl-observation'),
      nodeType: 'observation',
      x: 360,
      y: 410,
      data: { content: '填写工具返回结果' },
    },
    {
      id: id('tpl-decision'),
      nodeType: 'decision',
      x: 360,
      y: 540,
      data: { criteria: '目标是否达成？' },
    },
    { id: id('tpl-final'), nodeType: 'final', x: 720, y: 540, data: { answer: '填写最终答案' } },
  ]

  const edges: RawEdge[] = [
    {
      id: id('tpl-e1'),
      source: id('tpl-start'),
      target: id('tpl-thought'),
      kind: 'sequence',
      condition: null,
    },
    {
      id: id('tpl-e2'),
      source: id('tpl-thought'),
      target: id('tpl-action'),
      kind: 'sequence',
      condition: null,
    },
    {
      id: id('tpl-e3'),
      source: id('tpl-action'),
      target: id('tpl-observation'),
      kind: 'sequence',
      condition: null,
    },
    {
      id: id('tpl-e4'),
      source: id('tpl-observation'),
      target: id('tpl-decision'),
      kind: 'sequence',
      condition: null,
    },
    {
      id: id('tpl-e5'),
      source: id('tpl-decision'),
      target: id('tpl-thought'),
      kind: 'loop',
      condition: null,
    },
    {
      id: id('tpl-e6'),
      source: id('tpl-decision'),
      target: id('tpl-final'),
      kind: 'exit',
      condition: { type: 'goal_achieved' },
    },
  ]

  return { nodes, edges, meta: { name: 'ReAct 流程', description: '一键插入的 ReAct 骨架' } }
}

/** 插入模板到现有画布（id 加唯一后缀避免冲突），纳入撤销 */
export function insertReactTemplate(graph: Graph): void {
  const suffix = `-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const { nodes, edges } = buildReactTemplateCells(suffix)
  insertRawGraph(graph, { nodes, edges })
}
