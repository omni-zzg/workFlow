<script setup lang="ts">
import { getTeleport } from '@antv/x6-vue-shape'

import FlowCanvas from '@/components/FlowCanvas.vue'

// Vue 3 模式：节点组件经 Teleport 挂载到根应用（见 @antv/x6-vue-shape teleport 机制）
const TeleportHost = getTeleport()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">Agent Flow Editor</header>
    <main class="app-body">
      <FlowCanvas />
    </main>
    <component :is="TeleportHost" />
  </div>
</template>
