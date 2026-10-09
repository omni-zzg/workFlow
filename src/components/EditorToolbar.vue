<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Graph } from '@antv/x6'

import { downloadTextFile, exportFlowJson, flowFileName, resetGraph } from '@/graph'
import { DEFAULT_META } from '@/schema'
import { useDocument } from '@/stores/document'
import { detachCurrentDocument, saveCurrentDocument } from '@/stores/documents'
import { requireGraphRuntime, useGraphRuntime } from '@/stores/graphStore'
import { useValidation, validateNow } from '@/stores/validation'

import DocumentDialog from './DocumentDialog.vue'
import ImportFlowDialog from './ImportFlowDialog.vue'

const canUndo = ref(false)
const canRedo = ref(false)
const showImport = ref(false)
const showDocuments = ref(false)
let cleanup: (() => void) | null = null

const { meta, dirty, setMeta, markClean } = useDocument()
const { errorCount } = useValidation()

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

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  cleanup?.()
})

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

/** 新建：清空画布与撤销栈（与当前文档解除关联） */
function newFlow(): void {
  if (dirty.value && !window.confirm('存在未保存的修改，确定新建？')) return
  resetGraph(requireGraphRuntime().graph)
  setMeta({ ...DEFAULT_META })
  detachCurrentDocument()
  markClean()
  validateNow()
}

/** 保存到本地文档（spec: flow-document-management） */
function saveFlow(): void {
  if (!useGraphRuntime().value) return
  saveCurrentDocument(requireGraphRuntime().graph, meta.value)
  markClean()
}

/** Ctrl/Cmd+S 保存（阻止浏览器默认的"保存网页"） */
function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    saveFlow()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))

/** 导出：存在 error 级问题时先确认（spec: flow-json-storage） */
function exportFlow(): void {
  const { graph } = requireGraphRuntime()
  if (errorCount.value > 0 && !window.confirm(`存在 ${errorCount.value} 个问题，仍要导出？`)) {
    return
  }
  downloadTextFile(flowFileName(meta.value), exportFlowJson(graph, meta.value))
  markClean()
}
</script>

<template>
  <div class="editor-toolbar">
    <button type="button" class="editor-toolbar__btn" @click="newFlow">新建</button>
    <button type="button" class="editor-toolbar__btn" @click="showDocuments = true">打开</button>
    <button type="button" class="editor-toolbar__btn" @click="saveFlow">保存</button>
    <button type="button" class="editor-toolbar__btn" @click="showImport = true">导入</button>
    <button type="button" class="editor-toolbar__btn" @click="exportFlow">导出</button>
    <button type="button" class="editor-toolbar__btn" @click="validateNow()">校验</button>
    <span class="editor-toolbar__divider"></span>
    <button type="button" class="editor-toolbar__btn" :disabled="!canUndo" @click="undo">
      撤销
    </button>
    <button type="button" class="editor-toolbar__btn" :disabled="!canRedo" @click="redo">
      重做
    </button>
    <span class="editor-toolbar__divider"></span>
    <button type="button" class="editor-toolbar__btn" @click="fitView">适应画布</button>

    <ImportFlowDialog v-if="showImport" @close="showImport = false" />
    <DocumentDialog v-if="showDocuments" @close="showDocuments = false" />
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
