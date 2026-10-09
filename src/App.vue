<script setup lang="ts">
import { computed } from 'vue'
import { getTeleport } from '@antv/x6-vue-shape'

import EditorToolbar from '@/components/EditorToolbar.vue'
import FlowCanvas from '@/components/FlowCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import ProblemsPanel from '@/components/ProblemsPanel.vue'
import PropertyPanel from '@/components/PropertyPanel.vue'
import { useDocument } from '@/stores/document'
import { useDocuments } from '@/stores/documents'

// Vue 3 模式：节点组件经 Teleport 挂载到根应用（见 @antv/x6-vue-shape teleport 机制）
const TeleportHost = getTeleport()

const { meta, dirty } = useDocument()
const { currentDocument } = useDocuments()

/** 头部当前文档标签：已保存文档名（或元信息名）+ 未保存标记 */
const docLabel = computed(
  () => `${currentDocument.value?.name ?? meta.value.name ?? '未命名任务流'}${dirty.value ? ' · 未保存' : ''}`,
)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__title">Agent Flow Editor</span>
      <span class="app-header__doc">{{ docLabel }}</span>
      <EditorToolbar />
    </header>
    <main class="app-body">
      <aside class="app-palette"><NodePalette /></aside>
      <section class="app-canvas-column">
        <div class="app-canvas"><FlowCanvas /></div>
        <ProblemsPanel />
      </section>
      <aside class="app-panel"><PropertyPanel /></aside>
    </main>
    <component :is="TeleportHost" />
  </div>
</template>
