<script setup lang="ts">
import { ref } from 'vue'

import { resetGraph } from '@/graph'
import { DEFAULT_META } from '@/schema'
import { useDocument } from '@/stores/document'
import {
  deleteDocument,
  detachCurrentDocument,
  openDocument,
  renameDocument,
  useDocuments,
} from '@/stores/documents'
import { requireGraphRuntime } from '@/stores/graphStore'
import { validateNow } from '@/stores/validation'

/**
 * 文档管理对话框（spec: flow-document-management）：
 * 查看已保存的流程图（名称/更新时间），支持打开、新建空白、重命名、删除。
 * 切换/新建前若存在未保存修改会先确认。
 */

const emit = defineEmits<{ close: [] }>()

const { documents, currentId } = useDocuments()
const { meta, dirty, setMeta, markClean } = useDocument()

const errors = ref<string[]>([])
const editingId = ref<string | null>(null)
const editingName = ref('')

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function confirmDiscard(): boolean {
  return !dirty.value || window.confirm('当前流程有未保存的修改，继续将丢弃这些修改。')
}

function open(id: string): void {
  if (id === currentId.value) return
  if (!confirmDiscard()) return
  const result = openDocument(requireGraphRuntime().graph, id)
  if (!result.ok) {
    errors.value = result.errors
    return
  }
  errors.value = []
  setMeta({ ...(result.schema.meta ?? DEFAULT_META) })
  markClean()
  validateNow()
  emit('close')
}

function createNew(): void {
  if (!confirmDiscard()) return
  resetGraph(requireGraphRuntime().graph)
  setMeta({ ...DEFAULT_META })
  detachCurrentDocument()
  markClean()
  validateNow()
  emit('close')
}

function startRename(id: string, name: string): void {
  editingId.value = id
  editingName.value = name
}

function confirmRename(): void {
  const id = editingId.value
  if (!id) return
  if (!renameDocument(id, editingName.value)) return
  // 重命名当前文档时同步流程元信息（后续保存沿用新名称）
  if (id === currentId.value) {
    setMeta({ ...meta.value, name: editingName.value.trim() })
  }
  editingId.value = null
}

function remove(id: string, name: string): void {
  const isCurrent = id === currentId.value
  const message = isCurrent
    ? `删除「${name}」？画布内容将保留，但不再关联该文档。`
    : `删除「${name}」？此操作不可恢复。`
  if (!window.confirm(message)) return
  deleteDocument(id)
}
</script>

<template>
  <div class="doc-dialog__backdrop" @click.self="emit('close')">
    <div class="doc-dialog">
      <div class="doc-dialog__head">我的流程图</div>

      <div class="doc-dialog__toolbar">
        <button type="button" class="doc-dialog__btn doc-dialog__btn--primary" @click="createNew">
          新建空白流程
        </button>
        <span class="doc-dialog__count">共 {{ documents.length }} 份</span>
      </div>

      <p v-if="documents.length === 0" class="doc-dialog__empty">
        暂无保存的流程图——编辑画布后点击工具栏「保存」即可。
      </p>

      <ul v-else class="doc-dialog__list">
        <li
          v-for="doc in documents"
          :key="doc.id"
          class="doc-dialog__item"
          :class="{ 'doc-dialog__item--current': doc.id === currentId }"
        >
          <template v-if="editingId === doc.id">
            <input
              v-model="editingName"
              class="doc-dialog__input"
              type="text"
              @keydown.enter="confirmRename"
            />
            <button type="button" class="doc-dialog__btn" @click="confirmRename">确定</button>
            <button type="button" class="doc-dialog__btn" @click="editingId = null">取消</button>
          </template>
          <template v-else>
            <div class="doc-dialog__info">
              <span class="doc-dialog__name">
                {{ doc.name }}
                <span v-if="doc.id === currentId" class="doc-dialog__badge">当前</span>
              </span>
              <span class="doc-dialog__time">{{ formatTime(doc.updatedAt) }}</span>
            </div>
            <button
              type="button"
              class="doc-dialog__btn"
              :disabled="doc.id === currentId"
              @click="open(doc.id)"
            >
              打开
            </button>
            <button type="button" class="doc-dialog__btn" @click="startRename(doc.id, doc.name)">
              重命名
            </button>
            <button type="button" class="doc-dialog__btn" @click="remove(doc.id, doc.name)">
              删除
            </button>
          </template>
        </li>
      </ul>

      <ul v-if="errors.length > 0" class="doc-dialog__errors">
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>

      <div class="doc-dialog__foot">
        <button type="button" class="doc-dialog__btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 35%);
}

.doc-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 560px;
  max-width: calc(100vw - 48px);
  padding: 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 20%);
}

.doc-dialog__head {
  font-size: 14px;
  font-weight: 600;
}

.doc-dialog__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.doc-dialog__count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.doc-dialog__empty {
  margin: 0;
  padding: 20px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}

.doc-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.doc-dialog__item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.doc-dialog__item--current {
  background: rgb(51 112 255 / 5%);
  border-color: rgb(51 112 255 / 45%);
}

.doc-dialog__info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.doc-dialog__name {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.doc-dialog__badge {
  padding: 0 5px;
  font-size: 10px;
  font-weight: 400;
  color: var(--color-primary);
  background: rgb(51 112 255 / 10%);
  border-radius: 3px;
}

.doc-dialog__time {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.doc-dialog__input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 13px;
  border: 1px solid var(--color-primary);
  border-radius: 6px;
}

.doc-dialog__errors {
  max-height: 120px;
  margin: 0;
  padding: 8px 12px 8px 28px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--color-error);
  background: rgb(239 68 68 / 6%);
  border-radius: 6px;
}

.doc-dialog__foot {
  display: flex;
  justify-content: flex-end;
}

.doc-dialog__btn {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.doc-dialog__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.doc-dialog__btn:disabled {
  color: #b0b6bf;
  cursor: not-allowed;
}

.doc-dialog__btn--primary {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
