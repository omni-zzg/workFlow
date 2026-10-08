import type { Graph } from '@antv/x6'

import type { FlowMeta, RawEdge, RawNode } from '@/schema'

import { insertRawGraph } from './project'

/**
 * 任务流骨架模板（spec: flow-canvas-editing）：
 * start -> task（预填示例步骤、循环退出条件、前提条件与异常处理）-> final，
 * 并含一条 task 指向 final 的 failure 边（超限退出示例）；占位文案为引导性内容，插入即通过全部校验。
 */
export interface TaskFlowTemplateCells {
  nodes: RawNode[]
  edges: RawEdge[]
  meta: FlowMeta
}

export function buildReactTemplateCells(idSuffix = ''): TaskFlowTemplateCells {
  const id = (base: string): string => `${base}${idSuffix}`

  const nodes: RawNode[] = [
    {
      id: id('tpl-start'),
      nodeType: 'start',
      x: 360,
      y: 40,
      data: { goal: '填写全局目标' },
    },
    {
      id: id('tpl-task'),
      nodeType: 'task',
      x: 328,
      y: 150,
      data: {
        name: '任务示例',
        goal: '完成示例任务并拿到可用产出',
        input: '上一环节的产出（或用户输入）',
        steps: [
          {
            id: id('tpl-step-1'),
            thought: '需要先获取完成任务所需的数据',
            actions: [{ name: 'get_data', params: {} }],
            observation: '返回所需数据',
          },
          {
            id: id('tpl-step-2'),
            thought: '校验数据是否完整可用',
            actions: [{ name: 'validate_data', params: {} }],
            observation: '数据完整则进入完成判断',
          },
        ],
        loop: {
          exitConditions: [
            { type: 'goal_achieved' },
            { type: 'max_iterations', params: { max: 5 } },
          ],
        },
        precondition: '确认产出满足进入下一环节的条件',
        onFailure: {
          reflection: '分析失败原因：数据源？参数？',
          replan: '调整策略或改用备用方案后重试',
          maxRetries: 3,
        },
      },
    },
    {
      id: id('tpl-final'),
      nodeType: 'final',
      x: 360,
      y: 420,
      data: { answer: '填写最终产出' },
    },
  ]

  const edges: RawEdge[] = [
    {
      id: id('tpl-e1'),
      source: id('tpl-start'),
      target: id('tpl-task'),
      kind: 'success',
      condition: null,
    },
    {
      id: id('tpl-e2'),
      source: id('tpl-task'),
      target: id('tpl-final'),
      kind: 'success',
      condition: { type: 'goal_achieved' },
    },
    {
      id: id('tpl-e3'),
      source: id('tpl-task'),
      target: id('tpl-final'),
      kind: 'failure',
      condition: { type: 'max_iterations', params: { max: 5 } },
    },
  ]

  return {
    nodes,
    edges,
    meta: { name: 'ReAct 任务流', description: '一键插入的任务流骨架' },
  }
}

/** 插入模板到现有画布（id 加唯一后缀避免冲突），纳入撤销 */
export function insertReactTemplate(graph: Graph): void {
  const suffix = `-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const { nodes, edges } = buildReactTemplateCells(suffix)
  insertRawGraph(graph, { nodes, edges })
}
