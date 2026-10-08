<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Graph } from '@antv/x6'

import { CellStateController, createGraph } from '@/graph'
import { initDocumentTracking } from '@/stores/document'
import { setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking } from '@/stores/selection'

const containerRef = ref<HTMLDivElement | null>(null)
const toast = ref<string | null>(null)

let graph: Graph | null = null
let disposers: Array<() => void> = []
let toastTimer: number | undefined

function showToast(message: string): void {
  toast.value = message
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2000)
}

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  const instance = createGraph(container, { onConnectionRejected: showToast })
  graph = instance
  setGraphRuntime({ graph: instance, cellStates: new CellStateController(instance) })
  disposers = [initSelectionTracking(instance), initDocumentTracking(instance)]
})

onBeforeUnmount(() => {
  disposers.forEach((dispose) => dispose())
  disposers = []
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  setGraphRuntime(null)
  graph?.dispose()
  graph = null
})
</script>

<template>
  <div class="flow-canvas">
    <div ref="containerRef" class="flow-canvas__container"></div>
    <transition name="flow-fade">
      <div v-if="toast" class="flow-canvas__toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.flow-canvas {
  position: relative;
  width: 100%;
  height: 100%;
}

.flow-canvas__container {
  width: 100%;
  height: 100%;
}

.flow-canvas__toast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  font-size: 12px;
  color: #fff;
  background: rgb(31 35 41 / 86%);
  border-radius: 6px;
  pointer-events: none;
}

.flow-fade-enter-active,
.flow-fade-leave-active {
  transition: opacity 0.2s ease;
}

.flow-fade-enter-from,
.flow-fade-leave-to {
  opacity: 0;
}
</style>
