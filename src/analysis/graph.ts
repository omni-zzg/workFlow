/**
 * 纯图算法（零 X6/Vue 依赖）：
 * - Tarjan 强连通分量（SCC）循环识别
 * - 可达性 / 祖先判断 / 后继查询
 *
 * 校验器（validation/）使用可达性；SCC 与祖先判断为 v2 回放保留（design D2）。
 */

export interface NodeLike {
  id: string
}

export interface EdgeLike {
  source: string
  target: string
}

export interface GraphIndex {
  ids: string[]
  successors: Map<string, string[]>
  predecessors: Map<string, string[]>
}

/** 构建邻接索引。边引用了未知节点时自动登记该端点，保证算法不崩溃 */
export function buildIndex(nodes: readonly NodeLike[], edges: readonly EdgeLike[]): GraphIndex {
  const ids: string[] = []
  const seen = new Set<string>()
  const register = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  const successors = new Map<string, string[]>()
  const predecessors = new Map<string, string[]>()

  for (const node of nodes) register(node.id)

  for (const edge of edges) {
    register(edge.source)
    register(edge.target)
    const out = successors.get(edge.source) ?? []
    out.push(edge.target)
    successors.set(edge.source, out)
    const incoming = predecessors.get(edge.target) ?? []
    incoming.push(edge.source)
    predecessors.set(edge.target, incoming)
  }

  return { ids, successors, predecessors }
}

/** 后继查询 */
export function successorsOf(index: GraphIndex, id: string): string[] {
  return index.successors.get(id) ?? []
}

/**
 * Tarjan SCC：返回所有"构成循环"的强连通分量（节点 id 列表）。
 * 仅保留大小 > 1 的分量，以及带自环的单节点分量。
 */
export function findCycles(index: GraphIndex): string[][] {
  let counter = 0
  const order = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []

  const strongConnect = (id: string): void => {
    order.set(id, counter)
    lowlink.set(id, counter)
    counter += 1
    stack.push(id)
    onStack.add(id)

    for (const next of successorsOf(index, id)) {
      if (!order.has(next)) {
        strongConnect(next)
        lowlink.set(id, Math.min(lowlink.get(id)!, lowlink.get(next)!))
      } else if (onStack.has(next)) {
        lowlink.set(id, Math.min(lowlink.get(id)!, order.get(next)!))
      }
    }

    if (lowlink.get(id) === order.get(id)) {
      const component: string[] = []
      let member: string
      do {
        member = stack.pop()!
        onStack.delete(member)
        component.push(member)
      } while (member !== id)

      if (component.length > 1) {
        cycles.push(component)
      } else {
        const only = component[0]!
        if (successorsOf(index, only).includes(only)) cycles.push(component)
      }
    }
  }

  for (const id of index.ids) {
    if (!order.has(id)) strongConnect(id)
  }
  return cycles
}

/** 从若干起点可达的全部节点（包含起点自身） */
export function reachableFrom(index: GraphIndex, starts: readonly string[]): Set<string> {
  const visited = new Set<string>()
  const queue = [...starts]
  for (const id of queue) visited.add(id)
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of successorsOf(index, current)) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return visited
}

/** 是否存在从任一 from 到任一 target 的路径（允许零长度） */
export function canReach(
  index: GraphIndex,
  fromIds: readonly string[],
  targetIds: readonly string[],
): boolean {
  if (fromIds.length === 0 || targetIds.length === 0) return false
  const reachable = reachableFrom(index, fromIds)
  return targetIds.some((id) => reachable.has(id))
}

/**
 * ancestor 是否为 descendant 的祖先（沿有向边可达，且两者不同）。
 * 用于：新连线 source→target 构成环 ⟺ isAncestor(target, source)；
 * 判断某边 u→v 是否在环上 ⟺ isAncestor(v, u)。
 */
export function isAncestor(index: GraphIndex, ancestorId: string, descendantId: string): boolean {
  if (ancestorId === descendantId) return false
  return reachableFrom(index, [ancestorId]).has(descendantId)
}
