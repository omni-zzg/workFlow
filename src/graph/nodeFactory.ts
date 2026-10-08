import type { Node } from '@antv/x6'

import type { NodeData, NodeType } from '@/schema'

import { NODE_SIZE_BY_TYPE, SHAPE_BY_NODE_TYPE } from './shapes'

/** 各类型的初始（空）数据：内容由人工在属性面板填写 */
export function emptyDataFor(type: NodeType): NodeData {
  switch (type) {
    case 'start':
      return { goal: '' }
    case 'thought':
      return { content: '' }
    case 'action':
      return { tool: { name: '', params: {} } }
    case 'observation':
      return { content: '' }
    case 'decision':
      return {}
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
