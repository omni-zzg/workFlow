<script setup lang="ts">
import { CONDITION_TYPE_LABELS } from '@/schema'
import type { ConditionType, ExitCondition } from '@/schema'

/** 类型化条件的编辑控件（循环退出条件与转移前提条件共用） */
const props = defineProps<{
  condition: ExitCondition | null
}>()

const emit = defineEmits<{ change: [ExitCondition | null] }>()

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

function onTypeChange(raw: string): void {
  if (raw === '') {
    emit('change', null)
    return
  }
  emit('change', defaultConditionFor(raw as ConditionType))
}

function onNumber(raw: string): void {
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  const condition = props.condition
  if (!condition) return
  if (condition.type === 'max_iterations') {
    emit('change', { type: 'max_iterations', params: { max: value } })
  } else if (condition.type === 'timeout') {
    emit('change', { type: 'timeout', params: { seconds: value } })
  } else if (condition.type === 'budget') {
    emit('change', { type: 'budget', params: { tokens: value } })
  }
}

function onCustomText(text: string): void {
  if (props.condition?.type !== 'custom') return
  emit('change', { type: 'custom', text })
}
</script>

<template>
  <div class="condition-editor">
    <select
      class="condition-editor__select"
      :value="condition?.type ?? ''"
      @change="onTypeChange(($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>请选择条件类型</option>
      <option v-for="type in CONDITION_TYPES" :key="type" :value="type">
        {{ CONDITION_TYPE_LABELS[type] }}
      </option>
    </select>

    <input
      v-if="condition?.type === 'max_iterations'"
      class="condition-editor__input"
      type="number"
      min="1"
      :value="condition.params.max"
      @input="onNumber(($event.target as HTMLInputElement).value)"
    />
    <input
      v-else-if="condition?.type === 'timeout'"
      class="condition-editor__input"
      type="number"
      min="1"
      :value="condition.params.seconds"
      @input="onNumber(($event.target as HTMLInputElement).value)"
    />
    <input
      v-else-if="condition?.type === 'budget'"
      class="condition-editor__input"
      type="number"
      min="1"
      :value="condition.params.tokens"
      @input="onNumber(($event.target as HTMLInputElement).value)"
    />
    <textarea
      v-else-if="condition?.type === 'custom'"
      class="condition-editor__textarea"
      rows="2"
      placeholder="用文字描述该条件"
      :value="condition.text"
      @input="onCustomText(($event.target as HTMLTextAreaElement).value)"
    ></textarea>
  </div>
</template>

<style scoped>
.condition-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.condition-editor__select,
.condition-editor__input,
.condition-editor__textarea {
  width: 100%;
  padding: 5px 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.condition-editor__select:focus,
.condition-editor__input:focus,
.condition-editor__textarea:focus {
  border-color: var(--color-primary);
  outline: none;
}
</style>
