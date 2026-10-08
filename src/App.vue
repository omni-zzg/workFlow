<script setup lang="ts">
import { getTeleport } from '@antv/x6-vue-shape'

import EditorToolbar from '@/components/EditorToolbar.vue'
import FlowCanvas from '@/components/FlowCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import PropertyPanel from '@/components/PropertyPanel.vue'

// Vue 3 模式：节点组件经 Teleport 挂载到根应用（见 @antv/x6-vue-shape teleport 机制）
const TeleportHost = getTeleport()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__title">Agent Flow Editor</span>
      <EditorToolbar />
    </header>
    <main class="app-body">
      <aside class="app-palette"><NodePalette /></aside>
      <section class="app-canvas"><FlowCanvas /></section>
      <aside class="app-panel"><PropertyPanel /></aside>
    </main>
    <component :is="TeleportHost" />
  </div>
</template>
