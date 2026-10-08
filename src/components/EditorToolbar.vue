<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Graph } from '@antv/x6'

import { requireGraphRuntime, useGraphRuntime } from '@/stores/graphStore'

const canUndo = ref(false)
const canRedo = ref(false)
let cleanup: (() => void) | null = null

// 图实例在画布组件挂载后就绪（可能晚于工具栏），故跟随运行时引用
watch(
  useGraphRuntime(),
  (runtime) => {
    cleanup?.()
    cleanup = null
    if (!runtime) {
      canUndo.value = false
      canRedo.value = false
      return
    }
    const graph: Graph = runtime.graph
    const sync = (): void => {
      canUndo.value = graph.canUndo()
      canRedo.value = graph.canRedo()
    }
    graph.on('history:change', sync)
    sync()
    cleanup = () => {
      graph.off('history:change', sync)
      canUndo.value = false
      canRedo.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => cleanup?.())

function undo(): void {
  requireGraphRuntime().graph.undo()
}

function redo(): void {
  requireGraphRuntime().graph.redo()
}

/** 适应画布 */
function fitView(): void {
  requireGraphRuntime().graph.zoomToFit({ padding: 48, maxScale: 1 })
}
</script>

<template>
  <div class="editor-toolbar">
    <button type="button" class="editor-toolbar__btn" :disabled="!canUndo" @click="undo">
      撤销
    </button>
    <button type="button" class="editor-toolbar__btn" :disabled="!canRedo" @click="redo">
      重做
    </button>
    <span class="editor-toolbar__divider"></span>
    <button type="button" class="editor-toolbar__btn" @click="fitView">适应画布</button>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
}

.editor-toolbar__divider {
  width: 1px;
  height: 18px;
  background: var(--color-border);
}

.editor-toolbar__btn {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.editor-toolbar__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.editor-toolbar__btn:disabled {
  color: #b0b6bf;
  cursor: not-allowed;
}
</style>
