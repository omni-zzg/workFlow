import { describe, expect, it } from 'vitest'

import { buildIndex, canReach, findCycles, isAncestor, reachableFrom } from './graph'
import type { EdgeLike } from './graph'

function makeIndex(nodeIds: string[], edges: [string, string][]) {
  const edgeList: EdgeLike[] = edges.map(([source, target]) => ({ source, target }))
  return buildIndex(
    nodeIds.map((id) => ({ id })),
    edgeList,
  )
}

/** 稳定化循环结果：分量内排序 + 分量间排序，便于断言 */
function normalizeCycles(cycles: string[][]): string[][] {
  return cycles
    .map((component) => [...component].sort())
    .sort((a, b) => a.join(',').localeCompare(b.join(',')))
}

describe('findCycles：Tarjan 循环识别', () => {
  it('无环（DAG）返回空', () => {
    const index = makeIndex(
      ['s', 't', 'a', 'o', 'd', 'f'],
      [
        ['s', 't'],
        ['t', 'a'],
        ['a', 'o'],
        ['o', 'd'],
        ['d', 'f'],
      ],
    )
    expect(findCycles(index)).toEqual([])
  })

  it('单循环：识别回边构成的环', () => {
    const index = makeIndex(
      ['s', 't', 'a', 'o', 'd', 'f'],
      [
        ['s', 't'],
        ['t', 'a'],
        ['a', 'o'],
        ['o', 'd'],
        ['d', 't'],
        ['d', 'f'],
      ],
    )
    expect(normalizeCycles(findCycles(index))).toEqual([['a', 'd', 'o', 't']])
  })

  it('多循环：两个不相交的环分别识别', () => {
    const index = makeIndex(
      ['t1', 'a1', 'd1', 't2', 'a2', 'd2'],
      [
        ['t1', 'a1'],
        ['a1', 'd1'],
        ['d1', 't1'],
        ['t2', 'a2'],
        ['a2', 'd2'],
        ['d2', 't2'],
      ],
    )
    expect(normalizeCycles(findCycles(index))).toEqual([
      ['a1', 'd1', 't1'],
      ['a2', 'd2', 't2'],
    ])
  })

  it('嵌套/共享节点的环：按最大 SCC 合并为一个循环（已记录的语义边界）', () => {
    const index = makeIndex(
      ['t', 'a', 'd', 'x'],
      [
        ['t', 'a'],
        ['a', 'd'],
        ['d', 't'],
        ['d', 'x'],
        ['x', 'a'],
      ],
    )
    expect(normalizeCycles(findCycles(index))).toEqual([['a', 'd', 't', 'x']])
  })

  it('自环：单节点自连也被识别为循环', () => {
    const index = makeIndex(['x', 'y'], [['x', 'x'], ['x', 'y']])
    expect(findCycles(index)).toEqual([['x']])
  })

  it('边引用未知节点时不崩溃（自动登记端点）', () => {
    const index = makeIndex(['a'], [['a', 'ghost']])
    expect(findCycles(index)).toEqual([])
    expect(index.successors.get('a')).toEqual(['ghost'])
  })
})

describe('reachableFrom / canReach：可达性', () => {
  const index = makeIndex(
    ['s', 'a', 'b', 'lonely', 'dead', 'f'],
    [
      ['s', 'a'],
      ['a', 'b'],
      ['b', 'f'],
      ['dead', 'dead2'],
    ],
  )

  it('从 start 可达链上的节点，含起点自身', () => {
    const reachable = reachableFrom(index, ['s'])
    expect([...reachable].sort()).toEqual(['a', 'b', 'f', 's'])
  })

  it('孤立节点不可达', () => {
    expect(reachableFrom(index, ['s']).has('lonely')).toBe(false)
  })

  it('死路节点无法到达 final', () => {
    expect(canReach(index, ['dead'], ['f'])).toBe(false)
  })

  it('可达 final 返回 true', () => {
    expect(canReach(index, ['s'], ['f'])).toBe(true)
  })

  it('空起点或空终点返回 false', () => {
    expect(canReach(index, [], ['f'])).toBe(false)
    expect(canReach(index, ['s'], [])).toBe(false)
  })
})

describe('isAncestor：祖先判断（回边识别基础）', () => {
  const index = makeIndex(
    ['t', 'a', 'd'],
    [
      ['t', 'a'],
      ['a', 'd'],
    ],
  )

  it('沿有向边可达即为祖先', () => {
    expect(isAncestor(index, 't', 'd')).toBe(true)
    expect(isAncestor(index, 'a', 'd')).toBe(true)
  })

  it('反方向不是祖先（d→t 连线将构成环）', () => {
    expect(isAncestor(index, 'd', 't')).toBe(false)
    expect(isAncestor(index, 'd', 'a')).toBe(false)
  })

  it('自身不是自己的祖先', () => {
    expect(isAncestor(index, 't', 't')).toBe(false)
  })
})
