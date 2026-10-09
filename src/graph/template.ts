import type { Graph } from '@antv/x6'

import type { FlowMeta, RawEdge, RawNode } from '@/schema'

import { insertRawGraph } from './project'

/**
 * 任务流骨架模板（spec: flow-canvas-editing）：开始 → 任务1 → 任务2 → 结束，
 * 两个任务均预填示例步骤、循环退出条件、前提条件与异常处理，三条均为普通连线；
 * 占位文案为引导性内容，插入即通过全部校验。
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
      id: id('tpl-task-1'),
      nodeType: 'task',
      x: 328,
      y: 150,
      data: {
        name: '任务1',
        goal: '完成示例任务并拿到可用产出',
        input: '上一环节的产出（或用户输入）',
        steps: [
          {
            id: id('tpl-step-1-1'),
            thought: '需要先获取完成任务所需的数据',
            actions: [{ name: 'get_data', params: {} }],
            observation: '返回所需数据',
          },
          {
            id: id('tpl-step-1-2'),
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
      id: id('tpl-task-2'),
      nodeType: 'task',
      x: 328,
      y: 390,
      data: {
        name: '任务2',
        goal: '基于上一任务的产出完成后续处理',
        input: '任务1的输出',
        steps: [
          {
            id: id('tpl-step-2-1'),
            thought: '整理上一步产出，明确处理方式',
            actions: [{ name: 'process_data', params: {} }],
            observation: '得到处理结果',
          },
          {
            id: id('tpl-step-2-2'),
            thought: '确认结果满足最终要求',
            actions: [{ name: 'check_result', params: {} }],
            observation: '结果符合要求则进入结束',
          },
        ],
        loop: {
          exitConditions: [
            { type: 'goal_achieved' },
            { type: 'max_iterations', params: { max: 3 } },
          ],
        },
        precondition: '确认最终产出可以交付',
        onFailure: {
          reflection: '分析失败原因：输入不完整？处理参数？',
          replan: '修正输入或调整处理策略后重试',
          maxRetries: 3,
        },
      },
    },
    {
      id: id('tpl-final'),
      nodeType: 'final',
      x: 360,
      y: 640,
      data: { answer: '填写最终产出' },
    },
  ]

  const edges: RawEdge[] = [
    {
      id: id('tpl-e1'),
      source: id('tpl-start'),
      target: id('tpl-task-1'),
      kind: 'normal',
    },
    {
      id: id('tpl-e2'),
      source: id('tpl-task-1'),
      target: id('tpl-task-2'),
      kind: 'normal',
    },
    {
      id: id('tpl-e3'),
      source: id('tpl-task-2'),
      target: id('tpl-final'),
      kind: 'normal',
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
