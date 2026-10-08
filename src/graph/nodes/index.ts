import { register } from '@antv/x6-vue-shape'
import type { Component } from 'vue'

import type { NodeType } from '@/schema'

import { NODE_SIZE_BY_TYPE, NODE_TYPES, SHAPE_BY_NODE_TYPE } from '../shapes'
import FinalNode from './FinalNode.vue'
import StartNode from './StartNode.vue'
import TaskNode from './TaskNode.vue'

const COMPONENTS: Record<NodeType, Component> = {
  start: StartNode,
  task: TaskNode,
  final: FinalNode,
}

let registered = false

/** 注册三类节点（幂等）。需在创建图实例前调用；组件经 teleport 挂到根应用 */
export function registerFlowNodes(): void {
  if (registered) return
  registered = true
  for (const type of NODE_TYPES) {
    const size = NODE_SIZE_BY_TYPE[type]
    register({
      shape: SHAPE_BY_NODE_TYPE[type],
      width: size.width,
      height: size.height,
      component: COMPONENTS[type],
    })
  }
}
