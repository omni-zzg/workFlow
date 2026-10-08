import type { Graph } from '@antv/x6'

/**
 * 统一 cell 态标注机制（design D10）：
 * v1 消费者是校验（问题角标/高亮定位）；v2 回放的高亮/当前节点/已走路径将复用同一接口。
 * 实现方式：在 cellView 容器元素上切换 CSS 类，样式集中在 global.css。
 */
export type CellState = 'error' | 'warning'

const STATE_CLASS: Record<CellState, string> = {
  error: 'flow-state--error',
  warning: 'flow-state--warning',
}

const FLASH_CLASS = 'flow-state--flash'
const FLASH_DURATION_MS = 1600

export class CellStateController {
  private readonly applied = new Map<string, CellState>()
  private readonly flashTimers = new Map<string, number>()

  constructor(private readonly graph: Graph) {}

  /** 全量应用状态（未出现的 cell 自动清除；可安全重复调用，兼容视图重建） */
  applyStates(next: ReadonlyMap<string, CellState>): void {
    for (const [cellId, state] of this.applied) {
      this.toggle(cellId, STATE_CLASS[state], false)
    }
    this.applied.clear()

    for (const [cellId, state] of next) {
      this.toggle(cellId, STATE_CLASS[state], true)
      this.applied.set(cellId, state)
    }
  }

  /** 定位闪烁（问题面板点击定位使用） */
  flash(cellId: string): void {
    const existing = this.flashTimers.get(cellId)
    if (existing !== undefined) window.clearTimeout(existing)

    this.toggle(cellId, FLASH_CLASS, true)
    const timer = window.setTimeout(() => {
      this.toggle(cellId, FLASH_CLASS, false)
      this.flashTimers.delete(cellId)
    }, FLASH_DURATION_MS)
    this.flashTimers.set(cellId, timer)
  }

  clearAll(): void {
    for (const [cellId, state] of this.applied) {
      this.toggle(cellId, STATE_CLASS[state], false)
    }
    this.applied.clear()

    for (const [cellId, timer] of this.flashTimers) {
      window.clearTimeout(timer)
      this.toggle(cellId, FLASH_CLASS, false)
    }
    this.flashTimers.clear()
  }

  private toggle(cellId: string, className: string, on: boolean): void {
    const view = this.graph.findViewByCell(cellId)
    view?.container?.classList.toggle(className, on)
  }
}
