import { computed, ref } from 'vue'
import type { Cell, Graph } from '@antv/x6'

import { projectRawGraph } from '@/graph'
import { graphToSchema } from '@/schema'
import { validate } from '@/validation'
import type { Issue } from '@/validation'

import { requireGraphRuntime, useGraphRuntime } from './graphStore'

/**
 * 校验集成（spec: flow-validation）：
 * 图变化 → 防抖全量重算（纯函数 validate）→ 问题列表 + 画布态标注；
 * 点击问题定位（选中 + 闪烁高亮 + 必要时调整视口）。
 */

const issues = ref<Issue[]>([])
const errorCount = computed(() => issues.value.filter((issue) => issue.severity === 'error').length)
const warningCount = computed(
  () => issues.value.filter((issue) => issue.severity === 'warning').length,
)

const DEBOUNCE_MS = 200
const VIEW_MARGIN = 40

let timer: number | undefined

export function useValidation(): {
  issues: typeof issues
  errorCount: typeof errorCount
  warningCount: typeof warningCount
} {
  return { issues, errorCount, warningCount }
}

/** 立即全量校验（手动触发与防抖回调共用） */
export function validateNow(): void {
  const runtime = useGraphRuntime().value
  if (!runtime) {
    issues.value = []
    return
  }
  const result = validate(graphToSchema(projectRawGraph(runtime.graph)))
  issues.value = sortIssues(result)
  runtime.cellStates.applyStates(statesFromIssues(result))
}

export function scheduleValidation(): void {
  if (timer !== undefined) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = undefined
    validateNow()
  }, DEBOUNCE_MS)
}

export function initValidation(graph: Graph): () => void {
  const handler = (): void => scheduleValidation()

  graph.on('node:added', handler)
  graph.on('node:removed', handler)
  graph.on('node:change:data', handler)
  graph.on('edge:added', handler)
  graph.on('edge:removed', handler)
  graph.on('edge:change:data', handler)

  validateNow()

  return () => {
    graph.off('node:added', handler)
    graph.off('node:removed', handler)
    graph.off('node:change:data', handler)
    graph.off('edge:added', handler)
    graph.off('edge:removed', handler)
    graph.off('edge:change:data', handler)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
    issues.value = []
  }
}

/** 点击问题定位：选中 + 闪烁；不可见时居中 */
export function locateCell(cellId: string): void {
  const { graph, cellStates } = requireGraphRuntime()
  const cell = graph.getCellById(cellId) as Cell | undefined
  if (!cell) return
  graph.resetSelection(cell)
  cellStates.flash(cellId)
  if (!isCellInView(graph, cell)) {
    graph.centerCell(cell)
  }
}

function sortIssues(list: Issue[]): Issue[] {
  const order = { error: 0, warning: 1 }
  return [...list].sort((a, b) => order[a.severity] - order[b.severity])
}

/** 问题 -> 每 cell 的状态（error 优先于 warning） */
function statesFromIssues(list: Issue[]): Map<string, 'error' | 'warning'> {
  const states = new Map<string, 'error' | 'warning'>()
  for (const issue of list) {
    for (const cellId of issue.cellIds) {
      if (issue.severity === 'error' || !states.has(cellId)) {
        states.set(cellId, issue.severity)
      }
    }
  }
  return states
}

function isCellInView(graph: Graph, cell: Cell): boolean {
  const bbox = cell.getBBox()
  const m = graph.matrix()
  const transform = (x: number, y: number): { x: number; y: number } => ({
    x: x * m.a + y * m.c + m.e,
    y: x * m.b + y * m.d + m.f,
  })
  const topLeft = transform(bbox.x, bbox.y)
  const bottomRight = transform(bbox.x + bbox.width, bbox.y + bbox.height)
  const width = graph.container.clientWidth || graph.container.getBoundingClientRect().width
  const height = graph.container.clientHeight || graph.container.getBoundingClientRect().height
  if (width === 0 || height === 0) return true // 容器尚未布局，不做视口调整
  return (
    topLeft.x >= -VIEW_MARGIN &&
    topLeft.y >= -VIEW_MARGIN &&
    bottomRight.x <= width + VIEW_MARGIN &&
    bottomRight.y <= height + VIEW_MARGIN
  )
}
