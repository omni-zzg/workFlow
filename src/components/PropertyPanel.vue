<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Cell, Edge, Node } from '@antv/x6'

import { mutate, readEdgeCondition, readEdgeKind, requireNodeType } from '@/graph'
import { createStepId, EDGE_KIND_LABELS, NODE_TYPE_LABELS } from '@/schema'
import type { EdgeKind, ExitCondition, NodeData, NodeDataMap, ReactStep } from '@/schema'
import { useGraphRuntime } from '@/stores/graphStore'
import { useSelection } from '@/stores/selection'

import ConditionEditor from './ConditionEditor.vue'

/**
 * 属性面板（spec: flow-property-editing）：
 * - 选中任务节点：编辑 ReAct 单元——基础字段 / 步骤序列 / 循环退出条件 / 前提条件 / 异常处理
 * - 选中连线：编辑 kind 与类型化条件
 * - 内容为人工填写的自由文本；修改经 mutate 包装即时生效并纳入撤销
 */

const runtime = useGraphRuntime()
const selection = useSelection()

/** cell.data 非响应式：以版本号驱动重算（change:data 事件） */
const dataVersion = ref(0)
/** 面板自身写入期间跳过草稿回灌（避免打断正在编辑的步骤/参数行） */
let internalWrite = false

const cell = computed<Cell | null>(() => {
  const rt = runtime.value
  const snap = selection.value
  if (!rt || !snap) return null
  return (rt.graph.getCellById(snap.cellId) as Cell | undefined) ?? null
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
  return {
    kind: readEdgeKind(current as Edge),
    condition: readEdgeCondition(current as Edge),
  }
})

const cellKindLabel = computed(() => {
  const current = cell.value
  if (!current) return ''
  if (current.isNode()) {
    return nodeType.value ? `节点 · ${NODE_TYPE_LABELS[nodeType.value]}` : '节点'
  }
  return `连线 · ${EDGE_KIND_LABELS[edgeData.value?.kind ?? 'success']}`
})

// ---- 基础读取 ----

function startData(): NodeDataMap['start'] | null {
  return nodeType.value === 'start' ? ((nodeData.value as NodeDataMap['start'] | null) ?? null) : null
}
function finalData(): NodeDataMap['final'] | null {
  return nodeType.value === 'final' ? ((nodeData.value as NodeDataMap['final'] | null) ?? null) : null
}
function taskData(): NodeDataMap['task'] | null {
  return nodeType.value === 'task' ? ((nodeData.value as NodeDataMap['task'] | null) ?? null) : null
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

function setStartGoal(value: string): void {
  writeNodeData({ goal: value })
}
function setFinalAnswer(value: string): void {
  writeNodeData({ answer: value })
}

// ---- 任务基础字段 ----

function setTaskField(field: 'name' | 'goal' | 'input' | 'precondition', value: string): void {
  writeNodeData({ [field]: value })
}

function setFailureField(field: 'reflection' | 'replan', value: string): void {
  const onFailure = taskData()?.onFailure ?? { reflection: '', replan: '', maxRetries: 3 }
  writeNodeData({ onFailure: { ...onFailure, [field]: value } })
}

function setMaxRetries(raw: string): void {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return
  const onFailure = taskData()?.onFailure ?? { reflection: '', replan: '', maxRetries: 3 }
  writeNodeData({ onFailure: { ...onFailure, maxRetries: value } })
}

// ---- 循环退出条件（直接写数据即可：控件为选择/数字，无输入焦点问题） ----

function exitConditions(): ExitCondition[] {
  return taskData()?.loop.exitConditions ?? []
}

function addExitCondition(): void {
  writeNodeData({ loop: { exitConditions: [...exitConditions(), { type: 'goal_achieved' }] } })
}

function updateExitCondition(index: number, condition: ExitCondition | null): void {
  if (!condition) return
  const next = exitConditions().slice()
  next[index] = condition
  writeNodeData({ loop: { exitConditions: next } })
}

function removeExitCondition(index: number): void {
  const next = exitConditions().slice()
  next.splice(index, 1)
  writeNodeData({ loop: { exitConditions: next } })
}

// ---- 步骤序列：本地草稿（保持输入行身份），提交时序列化回数据 ----

interface ActionDraft {
  name: string
  paramRows: Array<{ key: string; value: string }>
}
interface StepDraft {
  id: string
  thought: string
  actions: ActionDraft[]
  observation: string
}

const stepDrafts = ref<StepDraft[]>([])

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function syncStepDrafts(): void {
  const steps: ReactStep[] = taskData()?.steps ?? []
  stepDrafts.value = steps.map((step) => ({
    id: step.id,
    thought: step.thought,
    observation: step.observation,
    actions: step.actions.map((action) => ({
      name: action.name,
      paramRows: Object.entries(action.params).map(([key, value]) => ({
        key,
        value: valueToString(value),
      })),
    })),
  }))
}

function commitStepDrafts(): void {
  const steps: ReactStep[] = stepDrafts.value.map((draft) => ({
    id: draft.id,
    thought: draft.thought,
    observation: draft.observation,
    actions: draft.actions.map((action) => {
      const params: Record<string, unknown> = {}
      for (const row of action.paramRows) {
        const key = row.key.trim()
        if (key) params[key] = row.value
      }
      return { name: action.name, params }
    }),
  }))
  writeNodeData({ steps })
}

function addStep(): void {
  stepDrafts.value.push({ id: createStepId(), thought: '', actions: [], observation: '' })
  commitStepDrafts()
}

function removeStep(index: number): void {
  stepDrafts.value.splice(index, 1)
  commitStepDrafts()
}

function moveStep(index: number, delta: -1 | 1): void {
  const target = index + delta
  if (target < 0 || target >= stepDrafts.value.length) return
  const [moved] = stepDrafts.value.splice(index, 1)
  stepDrafts.value.splice(target, 0, moved!)
  commitStepDrafts()
}

function addAction(stepIndex: number): void {
  stepDrafts.value[stepIndex]?.actions.push({ name: '', paramRows: [] })
  commitStepDrafts()
}

function removeAction(stepIndex: number, actionIndex: number): void {
  stepDrafts.value[stepIndex]?.actions.splice(actionIndex, 1)
  commitStepDrafts()
}

function addParamRow(stepIndex: number, actionIndex: number): void {
  stepDrafts.value[stepIndex]?.actions[actionIndex]?.paramRows.push({ key: '', value: '' })
}

function removeParamRow(stepIndex: number, actionIndex: number, rowIndex: number): void {
  stepDrafts.value[stepIndex]?.actions[actionIndex]?.paramRows.splice(rowIndex, 1)
  commitStepDrafts()
}

// ---- 连线编辑 ----

function setEdgeKind(kind: EdgeKind): void {
  const data = edgeData.value
  if (!data || data.kind === kind) return
  writeEdge({ kind, condition: data.condition })
}

function setEdgeCondition(condition: ExitCondition | null): void {
  const data = edgeData.value
  if (!data) return
  writeEdge({ kind: data.kind, condition })
}

const edgeSourceIsStart = computed(() => {
  void dataVersion.value
  const current = cell.value
  const rt = runtime.value
  if (!current || current.isNode() || !rt) return false
  const source = rt.graph.getCellById((current as Edge).getSourceCellId())
  return source?.isNode() === true && (source as Node).shape === 'flow-start'
})

// ---- 订阅：cell 数据变更（含外部撤销/重做） ----

watch(
  cell,
  (current) => {
    const bump = (): void => {
      dataVersion.value += 1
      if (!internalWrite) syncStepDrafts()
    }
    current?.on('change:data', bump)
    syncStepDrafts()
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
          全局目标<span class="property-panel__required">必填</span>
        </span>
        <textarea
          class="property-panel__textarea"
          rows="2"
          placeholder="整个任务流要达成什么"
          :value="startData()?.goal ?? ''"
          @input="setStartGoal(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- final -->
      <label v-else-if="nodeType === 'final'" class="property-panel__field">
        <span class="property-panel__label">最终产出</span>
        <textarea
          class="property-panel__textarea"
          rows="3"
          placeholder="流程结束时的输出"
          :value="finalData()?.answer ?? ''"
          @input="setFinalAnswer(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>

      <!-- task：ReAct 单元 -->
      <template v-else-if="nodeType === 'task'">
        <label class="property-panel__field">
          <span class="property-panel__label">
            任务名<span class="property-panel__required">必填</span>
          </span>
          <input
            class="property-panel__input"
            type="text"
            placeholder="如：查询天气"
            :value="taskData()?.name ?? ''"
            @input="setTaskField('name', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="property-panel__field">
          <span class="property-panel__label">
            任务目标<span class="property-panel__required">必填</span>
          </span>
          <textarea
            class="property-panel__textarea"
            rows="2"
            placeholder="本任务要达成什么"
            :value="taskData()?.goal ?? ''"
            @input="setTaskField('goal', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>

        <label class="property-panel__field">
          <span class="property-panel__label">输入</span>
          <textarea
            class="property-panel__textarea"
            rows="2"
            placeholder="从哪来 / 是什么（如：上一环节的产出）"
            :value="taskData()?.input ?? ''"
            @input="setTaskField('input', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>

        <div class="property-panel__section">ReAct 步骤（循环体）</div>

        <div v-for="(step, stepIndex) in stepDrafts" :key="step.id" class="property-panel__step">
          <div class="property-panel__step-head">
            <span>步骤 {{ stepIndex + 1 }}</span>
            <span class="property-panel__step-actions">
              <button type="button" title="上移" @click="moveStep(stepIndex, -1)">↑</button>
              <button type="button" title="下移" @click="moveStep(stepIndex, 1)">↓</button>
              <button type="button" title="删除步骤" @click="removeStep(stepIndex)">×</button>
            </span>
          </div>

          <label class="property-panel__field">
            <span class="property-panel__label">思考</span>
            <textarea
              class="property-panel__textarea"
              rows="2"
              placeholder="这一步判断/推理什么"
              :value="step.thought"
              @input="
                step.thought = ($event.target as HTMLTextAreaElement).value;
                commitStepDrafts()
              "
            ></textarea>
          </label>

          <div class="property-panel__field">
            <span class="property-panel__label">行动</span>
            <div
              v-for="(action, actionIndex) in step.actions"
              :key="actionIndex"
              class="property-panel__action"
            >
              <div class="property-panel__action-head">
                <input
                  class="property-panel__input"
                  type="text"
                  placeholder="动作 / 工具名"
                  :value="action.name"
                  @input="
                    action.name = ($event.target as HTMLInputElement).value;
                    commitStepDrafts()
                  "
                />
                <button type="button" title="删除动作" @click="removeAction(stepIndex, actionIndex)">
                  ×
                </button>
              </div>
              <div
                v-for="(row, rowIndex) in action.paramRows"
                :key="rowIndex"
                class="property-panel__param-row"
              >
                <input
                  class="property-panel__input property-panel__input--key"
                  type="text"
                  placeholder="参数名"
                  :value="row.key"
                  @input="
                    row.key = ($event.target as HTMLInputElement).value;
                    commitStepDrafts()
                  "
                />
                <input
                  class="property-panel__input"
                  type="text"
                  placeholder="值（自由填写）"
                  :value="row.value"
                  @input="
                    row.value = ($event.target as HTMLInputElement).value;
                    commitStepDrafts()
                  "
                />
                <button
                  type="button"
                  title="删除参数"
                  @click="removeParamRow(stepIndex, actionIndex, rowIndex)"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                class="property-panel__add-btn"
                @click="addParamRow(stepIndex, actionIndex)"
              >
                + 参数
              </button>
            </div>
            <button type="button" class="property-panel__add-btn" @click="addAction(stepIndex)">
              + 添加动作
            </button>
          </div>

          <label class="property-panel__field">
            <span class="property-panel__label">观察</span>
            <textarea
              class="property-panel__textarea"
              rows="2"
              placeholder="预期返回 / 结果"
              :value="step.observation"
              @input="
                step.observation = ($event.target as HTMLTextAreaElement).value;
                commitStepDrafts()
              "
            ></textarea>
          </label>
        </div>

        <button type="button" class="property-panel__add-btn" @click="addStep">+ 添加步骤</button>

        <div class="property-panel__section">循环退出条件</div>
        <div
          v-for="(condition, index) in exitConditions()"
          :key="index"
          class="property-panel__condition"
        >
          <ConditionEditor
            :condition="condition"
            @change="updateExitCondition(index, $event)"
          />
          <button type="button" title="删除条件" @click="removeExitCondition(index)">×</button>
        </div>
        <button type="button" class="property-panel__add-btn" @click="addExitCondition">
          + 添加退出条件
        </button>
        <span v-if="exitConditions().length === 0" class="property-panel__hint property-panel__hint--warn">
          未定义循环退出条件，将被校验标记为问题（E3）
        </span>

        <label class="property-panel__field">
          <span class="property-panel__label">前提条件（进入下一任务）</span>
          <textarea
            class="property-panel__textarea"
            rows="2"
            placeholder="如何判断可以进入下一任务"
            :value="taskData()?.precondition ?? ''"
            @input="setTaskField('precondition', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>

        <div class="property-panel__section">异常处理</div>
        <label class="property-panel__field">
          <span class="property-panel__label">反思（出问题如何分析）</span>
          <textarea
            class="property-panel__textarea"
            rows="2"
            placeholder="如：分析失败原因——数据源？参数？"
            :value="taskData()?.onFailure.reflection ?? ''"
            @input="setFailureField('reflection', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="property-panel__field">
          <span class="property-panel__label">重规划（如何调整）</span>
          <textarea
            class="property-panel__textarea"
            rows="2"
            placeholder="如：调整策略或改用备用方案后重试"
            :value="taskData()?.onFailure.replan ?? ''"
            @input="setFailureField('replan', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="property-panel__field">
          <span class="property-panel__label">重试上限</span>
          <input
            class="property-panel__input"
            type="number"
            min="0"
            :value="taskData()?.onFailure.maxRetries ?? 0"
            @input="setMaxRetries(($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

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

        <div class="property-panel__field">
          <span class="property-panel__label">
            {{ edgeData.kind === 'success' ? '前提条件' : '异常条件（可选）' }}
          </span>
          <ConditionEditor :condition="edgeData.condition" @change="setEdgeCondition" />
        </div>

        <p
          v-if="edgeData.kind === 'success' && !edgeData.condition && !edgeSourceIsStart"
          class="property-panel__hint property-panel__hint--warn"
        >
          该成功转移尚未设置前提条件，将被校验标记为问题（E5）
        </p>
      </template>
    </template>
  </div>
</template>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.property-panel__section {
  margin-top: 4px;
  padding-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-top: 1px dashed var(--color-border);
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

.property-panel__step {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.property-panel__step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.property-panel__step-actions {
  display: flex;
  gap: 4px;
}

.property-panel__step-actions button,
.property-panel__action-head button,
.property-panel__param-row button,
.property-panel__condition > button {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  font-size: 13px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 5px;
}

.property-panel__step-actions button:hover,
.property-panel__action-head button:hover,
.property-panel__param-row button:hover,
.property-panel__condition > button:hover {
  color: var(--color-error);
  border-color: var(--color-error);
}

.property-panel__action {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 6px;
}

.property-panel__action-head {
  display: flex;
  gap: 4px;
  align-items: center;
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

.property-panel__condition {
  display: flex;
  gap: 4px;
  align-items: flex-start;
}

.property-panel__condition > :first-child {
  flex: 1;
  min-width: 0;
}

.property-panel__condition > button {
  margin-top: 2px;
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
