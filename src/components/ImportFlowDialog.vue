<script setup lang="ts">
import { ref } from 'vue'

import { importFlowText } from '@/graph'
import { DEFAULT_META } from '@/schema'
import { useDocument } from '@/stores/document'
import { detachCurrentDocument } from '@/stores/documents'
import { requireGraphRuntime } from '@/stores/graphStore'
import { validateNow } from '@/stores/validation'

/**
 * 导入对话框（spec: flow-json-storage）：
 * 支持选择文件或粘贴 JSON；结构非法时列出错误且画布不动，成功后整体替换。
 */

const emit = defineEmits<{ close: [] }>()

const { setMeta, markClean } = useDocument()

const text = ref('')
const errors = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  text.value = await file.text()
  errors.value = []
  input.value = ''
}

function doImport(): void {
  const { graph } = requireGraphRuntime()
  const result = importFlowText(graph, text.value)
  if (!result.ok) {
    errors.value = result.errors
    return
  }
  setMeta({ ...(result.schema.meta ?? DEFAULT_META) })
  // 导入内容不对应任何已存文档（保存时新建记录）
  detachCurrentDocument()
  markClean()
  validateNow()
  emit('close')
}
</script>

<template>
  <div class="import-dialog__backdrop" @click.self="emit('close')">
    <div class="import-dialog">
      <div class="import-dialog__head">导入流程图 JSON</div>

      <div class="import-dialog__row">
        <button type="button" class="import-dialog__btn" @click="fileInput?.click()">
          选择文件…
        </button>
        <input
          ref="fileInput"
          class="import-dialog__file"
          type="file"
          accept=".json,application/json"
          @change="onFileChange"
        />
      </div>

      <textarea
        v-model="text"
        class="import-dialog__textarea"
        rows="10"
        placeholder="或将流程图 JSON 粘贴到此处"
      ></textarea>

      <ul v-if="errors.length > 0" class="import-dialog__errors">
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>

      <div class="import-dialog__foot">
        <button type="button" class="import-dialog__btn" @click="emit('close')">取消</button>
        <button
          type="button"
          class="import-dialog__btn import-dialog__btn--primary"
          :disabled="text.trim() === ''"
          @click="doImport"
        >
          导入
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 35%);
}

.import-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 520px;
  max-width: calc(100vw - 48px);
  padding: 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(15 23 42 / 20%);
}

.import-dialog__head {
  font-size: 14px;
  font-weight: 600;
}

.import-dialog__row {
  display: flex;
  gap: 8px;
}

.import-dialog__file {
  display: none;
}

.import-dialog__textarea {
  width: 100%;
  padding: 8px;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  resize: vertical;
}

.import-dialog__errors {
  max-height: 140px;
  margin: 0;
  padding: 8px 12px 8px 28px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--color-error);
  background: rgb(239 68 68 / 6%);
  border-radius: 6px;
}

.import-dialog__foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.import-dialog__btn {
  padding: 6px 14px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.import-dialog__btn--primary {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.import-dialog__btn--primary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
