<script setup lang="ts">
import { Dnd } from '@antv/x6-plugin-dnd'

import {
  NODE_SIZE_BY_TYPE,
  NODE_TYPES,
  createEmptyNodeMetadata,
  insertReactTemplate,
  mutate,
} from '@/graph'
import type { TemplateDirection } from '@/graph'
import { NODE_TYPE_LABELS } from '@/schema'
import type { NodeType } from '@/schema'
import { requireGraphRuntime } from '@/stores/graphStore'

let dnd: Dnd | null = null

function ensureDnd(): Dnd {
  if (!dnd) {
    dnd = new Dnd({ target: requireGraphRuntime().graph, scaled: true })
  }
  return dnd
}

/** 拖拽创建：拖到画布内落点创建；拖回调色板等待止区则自动取消 */
function onDragStart(type: NodeType, event: MouseEvent): void {
  const { graph } = requireGraphRuntime()
  const node = graph.createNode(createEmptyNodeMetadata(type))
  ensureDnd().start(node, event)
}

/** 一键插入 ReAct 骨架（竖向 / 横向） */
function insertTemplate(direction: TemplateDirection): void {
  insertReactTemplate(requireGraphRuntime().graph, direction)
}

/** 点击创建：落在画布中心（轻微错位避免完全重叠） */
function createAtCenter(type: NodeType): void {
  const { graph } = requireGraphRuntime()
  const rect = graph.container.getBoundingClientRect()
  const center = graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2)
  const size = NODE_SIZE_BY_TYPE[type]
  const offset = (graph.getNodes().length % 5) * 24
  mutate(graph, () => {
    graph.addNode({
      ...createEmptyNodeMetadata(type),
      x: Math.round(center.x - size.width / 2 + offset),
      y: Math.round(center.y - size.height / 2 + offset),
    })
  })
}
</script>

<template>
  <div class="node-palette">
    <div class="node-palette__title">节点</div>
    <button
      v-for="type in NODE_TYPES"
      :key="type"
      type="button"
      class="node-palette__item"
      @mousedown="onDragStart(type, $event)"
      @click="createAtCenter(type)"
    >
      <span class="node-palette__swatch" :class="`node-palette__swatch--${type}`"></span>
      <span class="node-palette__label">{{ NODE_TYPE_LABELS[type] }}</span>
    </button>
    <p class="node-palette__hint">拖拽到画布，或点击创建</p>
    <button type="button" class="node-palette__template" @click="insertTemplate('vertical')">
      插入竖向模板
    </button>
    <button type="button" class="node-palette__template" @click="insertTemplate('horizontal')">
      插入横向模板
    </button>
  </div>
</template>

<style scoped>
.node-palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.node-palette__title {
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.node-palette__item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--color-text);
  cursor: grab;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.node-palette__item:hover {
  border-color: var(--color-primary);
}

.node-palette__swatch {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 1.5px solid #cbd5e1;
  border-radius: 5px;
}

.node-palette__swatch--start {
  background: #ecfdf5;
  border-color: #34d399;
  border-radius: 999px;
}

.node-palette__swatch--task {
  background: #fff;
  border-color: #94a3b8;
  border-radius: 4px;
}

.node-palette__swatch--final {
  background: #ecfdf5;
  border-color: #059669;
  border-width: 3px;
  border-radius: 999px;
}

.node-palette__hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.node-palette__template {
  margin-top: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  background: rgb(51 112 255 / 6%);
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
}

.node-palette__template:hover {
  background: rgb(51 112 255 / 12%);
}
</style>
