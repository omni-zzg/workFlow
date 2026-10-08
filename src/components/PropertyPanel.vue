<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Cell, Edge, Node } from '@antv/x6'

import { mutate, requireNodeType } from '@/graph'
import { CONDITION_TYPE_LABELS, EDGE_KIND_LABELS, NODE_TYPE_LABELS } from '@/schema'
import type { ConditionType, EdgeKind, ExitCondition, NodeData, NodeDataMap } from '@/schema'
import { useGraphRuntime } from '@/stores/graphStore'
import { useSelection } from '@/stores/selection'

/**
 * 属性面板（spec: flow-property-editing）：
 * - 面板按选中对象切换表单；未选中或多选时为空态
 * - 内容为人工填写的自由文本；修改经 mutate 包装即时生效并纳入撤销
 */

const runtime = useGraphRuntime()
const selection = useSelection()

/** cell.data 非响应式：以版本号驱动重算（change:data 事件） */
const dataVersion = ref(0)
/** 面板自身写入期间跳过本地行状态回灌（避免打断正在编辑的参数行） */
let internalWrite = false

const cell = computed<Cell | null>(() => {
  const rt = runtime.value
  const snap = selection.value
  if (!rt || !snap) return null
  return (rt.graph.getCellById(snap.cellId) as Cell | undefined) ?? null
})

const cellKindLabel = computed(() => {
  const current = cell.value
  if (!current) return ''
  if (current.isNode()) {
    try {
      return `节点 · ${NODE_TYPE_LABELS[requireNodeType(current as Node)]}`
    } catch {
      return '节点'
    }
  }
  return `连线 · ${EDGE_KIND_LABELS[edgeData.value?.kind ?? 'sequence']}`
})

const nodeType = computed(() => {
  const current = cell.value
  if (!current || !current.isNode()) return null
  try {
    return requireNodeType(current as Node)
  } catch {
    return null
  }
})

const nodeData = computed<NodeData | null>(() => {
  void dataVersion.value
  const current = cell.value
  if (!current || !current.isNode()) return null
  return (current as Node).getData<NodeData>() ?? null
})

const edgeData = computed(() => {
  void dataVersion.value
  const current = cell.value
  if (!current || current.isNode()) return null
  const data = (current as Edge).getData<{ kind?: EdgeKind; condition?: ExitCondition | null }>()
  return { kind: data?.kind ?? 'sequence', condition: data?.condition ?? null }
})

// ---- 各类型的字段读取 ----

function startData(): NodeDataMap['start'] | null {
  return nodeType.value === 'start' ? ((nodeData.value as NodeDataMap['start'] | null) ?? null) : null
}
function thoughtData(): NodeDataMap['thought'] | null {
  return nodeType.value === 'thought'
    ? ((nodeData.value as NodeDataMap['thought'] | null) ?? null)
    : null
}
function actionData(): NodeDataMap['action'] | null {
  return nodeType.value === 'action'
    ? ((nodeData.value as NodeDataMap['action'] | null) ?? null)
    : null
}
function observationData(): NodeDataMap['observation'] | null {
  return nodeType.value === 'observation'
    ? ((nodeData.value as NodeDataMap['observation'] | null) ?? null)
    : null
}
function decisionData(): NodeDataMap['decision'] | null {
  return nodeType.value === 'decision'
    ? ((nodeData.value as NodeDataMap['decision'] | null) ?? null)
    : null
}
function finalData(): NodeDataMap['final'] | null {
  return nodeType.value === 'final' ? ((nodeData.value as NodeDataMap['final'] | null) ?? null) : null
}

// ---- 写回（统一 mutate 包装，纳入撤销） ----

function writeNodeData(patch: Record<string, unknown>): void {
  const rt = runtime.value
  const current = cell.value
  if (!rt || !current || !current.isNode()) return
  const prev = current.getData<Record<string, unknown>>() ?? {}
  internalWrite = true
  try {
    mutate(rt.graph, () => {
      current.replaceData({ ...prev, ...patch })
    })
  } finally {
    internalWrite = false
  }
}

function writeEdge(next: { kind: EdgeKind; condition: ExitCondition | null }): void {
  const rt = runtime.value
  const current = cell.value
  if (!rt || !current || current.isNode()) return
  internalWrite = true
  try {
    mutate(rt.graph, () => {
      current.replaceData(next)
    })
  } finally {
    internalWrite = false
  }
}

function setGoal(value: string): void {
  writeNodeData({ goal: value })
}
function setThoughtContent(value: string): void {
  writeNodeData({ content: value })
}
function setObservationContent(value: string): void {
  writeNodeData({ content: value })
}
function setCriteria(value: string): void {
  writeNodeData({ criteria: value })
}
function setAnswer(value: string): void {
  writeNodeData({ answer: value })
}
function setToolName(value: string): void {
  const tool = actionData()?.tool ?? { name: '', params: {} }
  writeNodeData({ tool: { ...tool, name: value } })
}

// ---- 工具参数：键值对行编辑 ----

const paramRows = ref<Array<{ key: string; value: string }>>([])

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function syncParamRows(): void {
  const params = actionData()?.tool?.params ?? {}
  paramRows.value = Object.entries(params).map(([key, value]) => ({
    key,
    value: valueToString(value),
  }))
}

function commitParamRows(): void {
  const params: Record<string, unknown> = {}
  for (const row of paramRows.value) {
    const key = row.key.trim()
    if (key) params[key] = row.value
  }
  const tool = actionData()?.tool ?? { name: '', params: {} }
  writeNodeData({ tool: { ...tool, params } })
}

function addParamRow(): void {
  paramRows.value.push({ key: '', value: '' })
}

function removeParamRow(index: number): void {
  paramRows.value.splice(index, 1)
  commitParamRows()
}

// ---- 边：kind 与类型化退出条件编辑 ----

const CONDITION_TYPES: readonly ConditionType[] = [
  'goal_achieved',
  'max_iterations',
  'timeout',
  'budget',
  'error',
  'human_interrupt',
  'custom',
]

function defaultConditionFor(type: ConditionType): ExitCondition {
  switch (type) {
    case 'goal_achieved':
      return { type: 'goal_achieved' }
    case 'max_iterations':
      return { type: 'max_iterations', params: { max: 5 } }
    case 'timeout':
      return { type: 'timeout', params: { seconds: 30 } }
    case 'budget':
      return { type: 'budget', params: { tokens: 100000 } }
    case 'error':
      return { type: 'error' }
    case 'human_interrupt':
      return { type: 'human_interrupt' }
    case 'custom':
      return { type: 'custom', text: '' }
  }
}

function setEdgeKind(kind: EdgeKind): void {
  const data = edgeData.value
  if (!data || data.kind === kind) return
  writeEdge({ kind, condition: kind === 'exit' ? data.condition : null })
}

function setConditionType(type: ConditionType | ''): void {
  if (!type) {
    writeEdge({ kind: 'exit', condition: null })
    return
  }
  writeEdge({ kind: 'exit', condition: defaultConditionFor(type) })
}

function setConditionParam(key: 'max' | 'seconds' | 'tokens', raw: string): void {
  const condition = edgeData.value?.condition
  if (!condition) return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  if (condition.type === 'max_iterations' && key === 'max') {
    writeEdge({ kind: 'exit', condition: { type: 'max_iterations', params: { max: value } } })
  } else if (condition.type === 'timeout' && key === 'seconds') {
    writeEdge({ kind: 'exit', condition: { type: 'timeout', params: { seconds: value } } })
  } else if (condition.type === 'budget' && key === 'tokens') {
    writeEdge({ kind: 'exit', condition: { type: 'budget', params: { tokens: value } } })
  }
}

function setCustomText(text: string): void {
  const condition = edgeData.value?.condition
  if (condition?.type !== 'custom') return
  writeEdge({ kind: 'exit', condition: { type: 'custom', text } })
}

// ---- 订阅：cell 数据变更（含外部撤销/重做） ----

watch(
  cell,
  (current) => {
    const bump = (): void => {
      dataVersion.value += 1
      if (!internalWrite) syncParamRows()
    }
    current?.on('change:data', bump)
    syncParamRows()
    return () => {
      current?.off('change:data', bump)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="property-panel">
    <div v-if="!cell" class="property-panel__empty">选中一个节点或连线以编辑属性</div>

    <template v-else>
      <div class="property-panel__head">{{ cellKindLabel }}</div>

      <!-- start -->
      <label v-if="nodeType === 'start'" class="property-panel__field">
        <span class="property-panel__label">
          任务目标<span class="property-panel__required">必填</span>
        </span>
        <textarea
          class="property-panel__textarea"
          rows="2"
          placeholder="本流程要达成的目标"
          :value="startData()?.goal ?? ''"
          @input="setGoal(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- thought -->
      <label v-else-if="nodeType === 'thought'" class="property-panel__field">
        <span class="property-panel__label">推理内容</span>
        <textarea
          class="property-panel__textarea"
          rows="4"
          placeholder="Agent 此刻的推理：现在该做什么"
          :value="thoughtData()?.content ?? ''"
          @input="setThoughtContent(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- action -->
      <template v-else-if="nodeType === 'action'">
        <label class="property-panel__field">
          <span class="property-panel__label">
            工具名<span class="property-panel__required">必填</span>
          </span>
          <input
            class="property-panel__input"
            type="text"
            placeholder="如 get_weather"
            :value="actionData()?.tool?.name ?? ''"
            @input="setToolName(($event.target as HTMLInputElement).value)"
          />
        </label>
        <div class="property-panel__field">
          <span class="property-panel__label">工具参数</span>
          <div v-for="(row, index) in paramRows" :key="index" class="property-panel__param-row">
            <input
              class="property-panel__input property-panel__input--key"
              type="text"
              placeholder="参数名"
              :value="row.key"
              @input="
                row.key = ($event.target as HTMLInputElement).value;
                commitParamRows()
              "
            />
            <input
              class="property-panel__input"
              type="text"
              placeholder="值（自由填写）"
              :value="row.value"
              @input="
                row.value = ($event.target as HTMLInputElement).value;
                commitParamRows()
              "
            />
            <button
              type="button"
              class="property-panel__icon-btn"
              title="删除该参数"
              @click="removeParamRow(index)"
            >
              ×
            </button>
          </div>
          <button type="button" class="property-panel__add-btn" @click="addParamRow">
            + 添加参数
          </button>
        </div>
      </template>

      <!-- observation -->
      <label v-else-if="nodeType === 'observation'" class="property-panel__field">
        <span class="property-panel__label">观察结果</span>
        <textarea
          class="property-panel__textarea"
          rows="3"
          placeholder="工具返回的结果"
          :value="observationData()?.content ?? ''"
          @input="setObservationContent(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- decision -->
      <label v-else-if="nodeType === 'decision'" class="property-panel__field">
        <span class="property-panel__label">判断依据（可选）</span>
        <textarea
          class="property-panel__textarea"
          rows="2"
          placeholder="如：资料是否足够"
          :value="decisionData()?.criteria ?? ''"
          @input="setCriteria(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <span class="property-panel__hint">退出条件在连线上设置：选中 exit 出边后编辑条件</span>
      </label>

      <!-- final -->
      <label v-else-if="nodeType === 'final'" class="property-panel__field">
        <span class="property-panel__label">最终答案</span>
        <textarea
          class="property-panel__textarea"
          rows="3"
          placeholder="流程结束时的输出"
          :value="finalData()?.answer ?? ''"
          @input="setAnswer(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- edge -->
      <template v-else-if="edgeData">
        <label class="property-panel__field">
          <span class="property-panel__label">连线类型</span>
          <select
            class="property-panel__select"
            :value="edgeData.kind"
            @change="setEdgeKind(($event.target as HTMLSelectElement).value as EdgeKind)"
          >
            <option v-for="(label, kind) in EDGE_KIND_LABELS" :key="kind" :value="kind">
              {{ label }}
            </option>
          </select>
        </label>

        <template v-if="edgeData.kind === 'exit'">
          <label class="property-panel__field">
            <span class="property-panel__label">
              退出条件<span class="property-panel__required">必填</span>
            </span>
            <select
              class="property-panel__select"
              :value="edgeData.condition?.type ?? ''"
              @change="
                setConditionType(($event.target as HTMLSelectElement).value as ConditionType | '')
              "
            >
              <option value="" disabled>请选择条件类型</option>
              <option v-for="type in CONDITION_TYPES" :key="type" :value="type">
                {{ CONDITION_TYPE_LABELS[type] }}
              </option>
            </select>
          </label>

          <label
            v-if="edgeData.condition?.type === 'max_iterations'"
            class="property-panel__field"
          >
            <span class="property-panel__label">最大迭代次数</span>
            <input
              class="property-panel__input"
              type="number"
              min="1"
              :value="edgeData.condition.params.max"
              @input="setConditionParam('max', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label v-else-if="edgeData.condition?.type === 'timeout'" class="property-panel__field">
            <span class="property-panel__label">超时时间（秒）</span>
            <input
              class="property-panel__input"
              type="number"
              min="1"
              :value="edgeData.condition.params.seconds"
              @input="setConditionParam('seconds', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label v-else-if="edgeData.condition?.type === 'budget'" class="property-panel__field">
            <span class="property-panel__label">预算（tokens）</span>
            <input
              class="property-panel__input"
              type="number"
              min="1"
              :value="edgeData.condition.params.tokens"
              @input="setConditionParam('tokens', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label v-else-if="edgeData.condition?.type === 'custom'" class="property-panel__field">
            <span class="property-panel__label">自定义条件</span>
            <textarea
              class="property-panel__textarea"
              rows="2"
              placeholder="用文字描述退出条件"
              :value="edgeData.condition.text"
              @input="setCustomText(($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </label>

          <p v-if="!edgeData.condition" class="property-panel__hint property-panel__hint--warn">
            该退出边尚未设置条件，将被校验标记为问题（E4）
          </p>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.property-panel__empty {
  padding: 24px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}

.property-panel__head {
  padding-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.property-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-panel__label {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--color-text);
}

.property-panel__required {
  padding: 0 4px;
  font-size: 10px;
  color: var(--color-error);
  background: rgb(239 68 68 / 8%);
  border-radius: 3px;
}

.property-panel__input,
.property-panel__textarea,
.property-panel__select {
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.property-panel__textarea {
  resize: vertical;
}

.property-panel__input:focus,
.property-panel__textarea:focus,
.property-panel__select:focus {
  border-color: var(--color-primary);
  outline: none;
}

.property-panel__param-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.property-panel__input--key {
  width: 38%;
  flex-shrink: 0;
}

.property-panel__icon-btn {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 5px;
}

.property-panel__icon-btn:hover {
  color: var(--color-error);
  border-color: var(--color-error);
}

.property-panel__add-btn {
  align-self: flex-start;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  background: none;
  border: 1px dashed var(--color-primary);
  border-radius: 6px;
}

.property-panel__hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.property-panel__hint--warn {
  color: var(--color-warning);
}
</style>
