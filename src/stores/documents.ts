import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { Graph } from '@antv/x6'

import { graphToSchema, parseFlowSchema } from '@/schema'
import type { FlowMeta, FlowSchema } from '@/schema'
import { loadSchema, projectRawGraph } from '@/graph'

/**
 * 本地文档管理（spec: flow-document-management）：
 * 保存/查看/新建/重命名/删除多份流程图，持久化于浏览器 localStorage。
 * 图数据仍以 X6 Graph 为编辑期唯一真源；本 store 只保存已存文档副本与当前文档 id。
 */

export interface DocumentSummary {
  id: string
  name: string
  updatedAt: number
}

interface StoredDocument extends DocumentSummary {
  schema: FlowSchema
}

interface StoredState {
  version: 1
  currentId: string | null
  docs: StoredDocument[]
}

const STORAGE_KEY = 'agent-flow-editor/documents'
const DEFAULT_DOC_NAME = '未命名任务流'

const docs = ref<StoredDocument[]>([])
const currentId = ref<string | null>(null)

function readState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, currentId: null, docs: [] }
    const parsed = JSON.parse(raw) as StoredState
    if (!parsed || !Array.isArray(parsed.docs)) {
      return { version: 1, currentId: null, docs: [] }
    }
    return {
      version: 1,
      currentId: typeof parsed.currentId === 'string' ? parsed.currentId : null,
      docs: parsed.docs,
    }
  } catch {
    return { version: 1, currentId: null, docs: [] }
  }
}

function persist(): void {
  const state: StoredState = { version: 1, currentId: currentId.value, docs: docs.value }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储空间不足等异常不阻断编辑；下次保存重试
  }
}

/** 从本地存储重新加载（模块初始化与测试复位用） */
export function reloadDocuments(): void {
  const state = readState()
  docs.value = state.docs
  currentId.value = state.currentId
}

reloadDocuments()

const summaries = computed<DocumentSummary[]>(() =>
  [...docs.value]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt })),
)

const currentDocument = computed<DocumentSummary | null>(() => {
  const id = currentId.value
  if (!id) return null
  const doc = docs.value.find((item) => item.id === id)
  return doc ? { id: doc.id, name: doc.name, updatedAt: doc.updatedAt } : null
})

export function useDocuments(): {
  documents: ComputedRef<DocumentSummary[]>
  currentId: Ref<string | null>
  currentDocument: ComputedRef<DocumentSummary | null>
} {
  return { documents: summaries, currentId, currentDocument }
}

function createDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 保存当前画布到本地文档（无当前文档则新建），返回文档 id */
export function saveCurrentDocument(graph: Graph, meta: FlowMeta): string {
  const schema = graphToSchema(projectRawGraph(graph, meta))
  const name = meta.name?.trim() || DEFAULT_DOC_NAME
  const now = Date.now()

  const existing = currentId.value
    ? docs.value.find((doc) => doc.id === currentId.value)
    : undefined

  if (existing) {
    existing.name = name
    existing.updatedAt = now
    existing.schema = schema
    persist()
    return existing.id
  }

  const doc: StoredDocument = { id: createDocumentId(), name, updatedAt: now, schema }
  docs.value = [...docs.value, doc]
  currentId.value = doc.id
  persist()
  return doc.id
}

export type OpenDocumentResult = { ok: true; schema: FlowSchema } | { ok: false; errors: string[] }

/** 打开已保存文档：整体替换画布（校验失败时画布不动） */
export function openDocument(graph: Graph, id: string): OpenDocumentResult {
  const doc = docs.value.find((item) => item.id === id)
  if (!doc) {
    return { ok: false, errors: ['文档不存在（可能已被删除）'] }
  }
  const parsed = parseFlowSchema(doc.schema)
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors }
  }
  loadSchema(graph, parsed.schema)
  currentId.value = id
  persist()
  return { ok: true, schema: parsed.schema }
}

/** 重命名文档（名称去空白后不得为空） */
export function renameDocument(id: string, name: string): boolean {
  const doc = docs.value.find((item) => item.id === id)
  const trimmed = name.trim()
  if (!doc || trimmed === '') return false
  doc.name = trimmed
  persist()
  return true
}

/** 删除文档；若删除的是当前文档则解除关联（画布内容保留） */
export function deleteDocument(id: string): void {
  docs.value = docs.value.filter((item) => item.id !== id)
  if (currentId.value === id) {
    currentId.value = null
  }
  persist()
}

/** 解除与当前文档的关联（新建/导入后：画布内容已不对应任何已存文档） */
export function detachCurrentDocument(): void {
  if (currentId.value === null) return
  currentId.value = null
  persist()
}
