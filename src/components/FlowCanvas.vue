<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Graph } from '@antv/x6'

import { CellStateController, createGraph, insertReactTemplate } from '@/graph'
import { initDocumentTracking, useDocument } from '@/stores/document'
import { requireGraphRuntime, setGraphRuntime } from '@/stores/graphStore'
import { initSelectionTracking } from '@/stores/selection'
import { initValidation } from '@/stores/validation'

const containerRef = ref<HTMLDivElement | null>(null)
const toast = ref<string | null>(null)
const { nodeCount } = useDocument()

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

function insertTemplate(): void {
  insertReactTemplate(requireGraphRuntime().graph)
}

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  const instance = createGraph(container, { onConnectionRejected: showToast })
  graph = instance
  setGraphRuntime({ graph: instance, cellStates: new CellStateController(instance) })
  disposers = [
    initSelectionTracking(instance),
    initDocumentTracking(instance),
    initValidation(instance),
  ]
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
    <div v-if="nodeCount === 0" class="flow-canvas__empty">
      <p class="flow-canvas__empty-text">从左侧拖入节点开始绘制，或</p>
      <button type="button" class="flow-canvas__empty-btn" @click="insertTemplate">
        插入 ReAct 模板
      </button>
    </div>
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

.flow-canvas__empty {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.flow-canvas__empty-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.flow-canvas__empty-btn {
  padding: 6px 16px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  pointer-events: auto;
}

.flow-canvas__empty-btn:hover {
  opacity: 0.9;
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
