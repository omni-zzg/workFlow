<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { getTeleport } from '@antv/x6-vue-shape'

import EditorToolbar from '@/components/EditorToolbar.vue'
import FlowCanvas from '@/components/FlowCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import ProblemsPanel from '@/components/ProblemsPanel.vue'
import PropertyPanel from '@/components/PropertyPanel.vue'
import { useDocument } from '@/stores/document'
import { renameDocument, useDocuments } from '@/stores/documents'

// Vue 3 模式：节点组件经 Teleport 挂载到根应用（见 @antv/x6-vue-shape teleport 机制）
const TeleportHost = getTeleport()

const { meta, dirty, setMeta } = useDocument()
const { currentId, currentDocument } = useDocuments()

/** 头部当前文档标签：已保存文档名（或元信息名）+ 未保存标记 */
const docLabel = computed(
  () => `${currentDocument.value?.name ?? meta.value.name ?? '未命名任务流'}${dirty.value ? ' · 未保存' : ''}`,
)

// 头部名称内联重命名：点击进入编辑态，回车/失焦保存，Esc 取消
const editing = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

async function startEditName(): Promise<void> {
  nameDraft.value = currentDocument.value?.name ?? meta.value.name ?? '未命名任务流'
  editing.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function commitName(): void {
  if (!editing.value) return
  editing.value = false
  const name = nameDraft.value.trim()
  if (name === '') return
  if (currentId.value) {
    renameDocument(currentId.value, name)
  }
  // 同步流程元信息（未保存流程以该名称在保存时建档）
  setMeta({ ...meta.value, name })
}

function cancelName(): void {
  editing.value = false
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__title">Agent Flow Editor</span>
      <input
        v-if="editing"
        ref="nameInput"
        v-model="nameDraft"
        class="app-header__name-input"
        type="text"
        @keydown.enter="commitName"
        @keydown.esc="cancelName"
        @blur="commitName"
      />
      <span v-else class="app-header__doc" title="点击重命名" @click="startEditName">
        {{ docLabel }}
      </span>
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
