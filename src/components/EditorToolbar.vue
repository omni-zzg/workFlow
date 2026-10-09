<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Graph } from '@antv/x6'

import {
  alignHorizontalCenter,
  alignVerticalCenter,
  distributeHorizontally,
  distributeVertically,
  downloadTextFile,
  exportFlowImage,
  exportFlowJson,
  flowFileName,
  resetGraph,
} from '@/graph'
import type { ImageExportFormat } from '@/graph'
import { DEFAULT_META } from '@/schema'
import { useDocument } from '@/stores/document'
import { detachCurrentDocument, saveCurrentDocument } from '@/stores/documents'
import { requireGraphRuntime, useGraphRuntime } from '@/stores/graphStore'
import { useValidation, validateNow } from '@/stores/validation'

import DocumentDialog from './DocumentDialog.vue'
import ImportFlowDialog from './ImportFlowDialog.vue'

const canUndo = ref(false)
const canRedo = ref(false)
const selectedNodeCount = ref(0)
const showImport = ref(false)
const showDocuments = ref(false)
const showExport = ref(false)
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
      selectedNodeCount.value = 0
      return
    }
    const graph: Graph = runtime.graph
    const sync = (): void => {
      canUndo.value = graph.canUndo()
      canRedo.value = graph.canRedo()
    }
    const syncSelection = (): void => {
      selectedNodeCount.value = graph
        .getSelectedCells()
        .filter((cell) => cell.isNode()).length
    }
    graph.on('history:change', sync)
    graph.on('selection:changed', syncSelection)
    sync()
    syncSelection()
    cleanup = () => {
      graph.off('history:change', sync)
      graph.off('selection:changed', syncSelection)
      canUndo.value = false
      canRedo.value = false
      selectedNodeCount.value = 0
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocumentClick)
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

/** 对齐与对称分布（spec: flow-canvas-editing「节点对齐与对称分布」） */
function alignNodes(action: 'h-center' | 'v-center' | 'h-distribute' | 'v-distribute'): void {
  const { graph } = requireGraphRuntime()
  const actions = {
    'h-center': alignHorizontalCenter,
    'v-center': alignVerticalCenter,
    'h-distribute': distributeHorizontally,
    'v-distribute': distributeVertically,
  }
  actions[action](graph)
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

/** 导出 JSON：存在 error 级问题时先确认（spec: flow-json-storage） */
function exportFlow(): void {
  showExport.value = false
  const { graph } = requireGraphRuntime()
  if (errorCount.value > 0 && !window.confirm(`存在 ${errorCount.value} 个问题，仍要导出？`)) {
    return
  }
  downloadTextFile(flowFileName(meta.value), exportFlowJson(graph, meta.value))
  markClean()
}

/** 导出图片/网页（spec: flow-canvas-editing「导出为图片与网页」） */
function exportImage(format: ImageExportFormat): void {
  showExport.value = false
  const { graph } = requireGraphRuntime()
  if (graph.getNodes().length === 0) {
    window.alert('画布为空，没有可导出的内容')
    return
  }
  void exportFlowImage(graph, meta.value, format).catch(() => {
    window.alert('导出图片失败，请重试')
  })
}

// 导出菜单：点击其他位置自动收起
function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Element | null
  if (target?.closest('.editor-toolbar__export')) return
  showExport.value = false
}

watch(showExport, (open) => {
  if (open) {
    document.addEventListener('click', onDocumentClick)
  } else {
    document.removeEventListener('click', onDocumentClick)
  }
})
</script>

<template>
  <div class="editor-toolbar">
    <button type="button" class="editor-toolbar__btn" @click="newFlow">新建</button>
    <button type="button" class="editor-toolbar__btn" @click="showDocuments = true">打开</button>
    <button type="button" class="editor-toolbar__btn" @click="saveFlow">保存</button>
    <button type="button" class="editor-toolbar__btn" @click="showImport = true">导入</button>
    <div class="editor-toolbar__export">
      <button type="button" class="editor-toolbar__btn" @click="showExport = !showExport">
        导出 ▾
      </button>
      <div v-if="showExport" class="editor-toolbar__menu">
        <button type="button" class="editor-toolbar__menu-item" @click="exportFlow">
          JSON 文件
        </button>
        <button type="button" class="editor-toolbar__menu-item" @click="exportImage('png')">
          PNG 图片
        </button>
        <button type="button" class="editor-toolbar__menu-item" @click="exportImage('svg')">
          SVG 矢量图
        </button>
        <button type="button" class="editor-toolbar__menu-item" @click="exportImage('html')">
          HTML 网页
        </button>
      </div>
    </div>
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
    <button
      type="button"
      class="editor-toolbar__btn"
      :title="
        selectedNodeCount < 2
          ? '水平居中：需选中至少 2 个节点（Shift 或 Ctrl+点击加选，Shift 拖拽空白处框选）'
          : '水平居中：选中节点对齐到同一水平中线'
      "
      :disabled="selectedNodeCount < 2"
      @click="alignNodes('h-center')"
    >
      横居中
    </button>
    <button
      type="button"
      class="editor-toolbar__btn"
      :title="
        selectedNodeCount < 2
          ? '垂直居中：需选中至少 2 个节点（Shift 或 Ctrl+点击加选，Shift 拖拽空白处框选）'
          : '垂直居中：选中节点对齐到同一垂直中线'
      "
      :disabled="selectedNodeCount < 2"
      @click="alignNodes('v-center')"
    >
      纵居中
    </button>
    <button
      type="button"
      class="editor-toolbar__btn"
      :title="
        selectedNodeCount < 3
          ? '水平等距分布：需选中至少 3 个节点（Shift 或 Ctrl+点击加选，Shift 拖拽空白处框选）'
          : '水平对称分布：先对齐到一条水平中线，再横向等距（首尾不动、间隙均分），左右对称'
      "
      :disabled="selectedNodeCount < 3"
      @click="alignNodes('h-distribute')"
    >
      横等距
    </button>
    <button
      type="button"
      class="editor-toolbar__btn"
      :title="
        selectedNodeCount < 3
          ? '垂直等距分布：需选中至少 3 个节点（Shift 或 Ctrl+点击加选，Shift 拖拽空白处框选）'
          : '垂直对称分布：先对齐到一条垂直中线，再纵向等距（首尾不动、间隙均分），上下对称'
      "
      :disabled="selectedNodeCount < 3"
      @click="alignNodes('v-distribute')"
    >
      纵等距
    </button>

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

.editor-toolbar__export {
  position: relative;
}

.editor-toolbar__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 50;
  display: flex;
  min-width: 128px;
  flex-direction: column;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 14%);
}

.editor-toolbar__menu-item {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 5px;
}

.editor-toolbar__menu-item:hover {
  background: rgb(51 112 255 / 8%);
}
</style>
