import type { Node } from '@antv/x6'

import { createStepId } from '@/schema'
import type { NodeData, NodeType } from '@/schema'

import { NODE_SIZE_BY_TYPE, SHAPE_BY_NODE_TYPE } from './shapes'

/** 各类型的初始（空）数据：内容由人工在属性面板填写 */
export function emptyDataFor(type: NodeType): NodeData {
  switch (type) {
    case 'start':
      return { goal: '' }
    case 'task':
      return {
        name: '',
        goal: '',
        input: '',
        // 新任务自带一个空步骤，引导填写第一组「思考-行动-观察」
        steps: [{ id: createStepId(), thought: '', actions: [], observation: '' }],
        loop: { exitConditions: [] },
        precondition: '',
        onFailure: { reflection: '', replan: '', maxRetries: 3 },
      }
    case 'final':
      return { answer: '' }
  }
}

/** 新建节点的 X6 元数据（调色板创建与拖拽共用） */
export function createEmptyNodeMetadata(type: NodeType): Node.Metadata {
  const size = NODE_SIZE_BY_TYPE[type]
  return {
    shape: SHAPE_BY_NODE_TYPE[type],
    width: size.width,
    height: size.height,
    data: emptyDataFor(type),
  }
}
