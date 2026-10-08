import { shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import type { Graph } from '@antv/x6'

import { CellStateController } from '@/graph'

/**
 * 图运行时单例（design D1/D6）：
 * X6 Graph 是编辑期唯一真源；store 只持有引用与派生视图，不保存第二份图数据。
 */
export interface GraphRuntime {
  graph: Graph
  cellStates: CellStateController
}

let runtime: GraphRuntime | null = null
const runtimeRef = shallowRef<GraphRuntime | null>(null)

export function setGraphRuntime(next: GraphRuntime | null): void {
  runtime = next
  runtimeRef.value = next
}

/** 响应式引用（组件模板/计算属性使用） */
export function useGraphRuntime(): ShallowRef<GraphRuntime | null> {
  return runtimeRef
}

/** 非组件上下文取运行时；未初始化时抛错（调用方应先检查 useGraphRuntime） */
export function requireGraphRuntime(): GraphRuntime {
  if (!runtime) throw new Error('图尚未初始化')
  return runtime
}
