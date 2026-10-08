import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'
import type { Node } from '@antv/x6'

/**
 * 订阅节点数据的变更（teleport 模式下组件经由 props 拿到 node/graph，
 * 响应式需显式订阅 change:data；撤销/重做同样触发该事件）。
 */
export function useNodeData<T>(node: Node): Ref<T> {
  const data = ref(node.getData<T>()) as Ref<T>
  const update = (): void => {
    data.value = node.getData<T>()
  }
  node.on('change:data', update)
  onBeforeUnmount(() => {
    node.off('change:data', update)
  })
  return data
}
