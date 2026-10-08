<script setup lang="ts">
import { ref } from 'vue'

import { locateCell, useValidation, validateNow } from '@/stores/validation'
import { RULE_TITLES } from '@/validation'
import type { Issue } from '@/validation'

const { issues, errorCount, warningCount } = useValidation()
const collapsed = ref(false)

function onLocate(issue: Issue): void {
  const target = issue.cellIds[0]
  if (target) locateCell(target)
}

function revalidate(): void {
  validateNow()
}
</script>

<template>
  <div class="problems-panel" :class="{ 'problems-panel--collapsed': collapsed }">
    <div class="problems-panel__head" @click="collapsed = !collapsed">
      <span class="problems-panel__toggle">{{ collapsed ? '▲' : '▼' }}</span>
      <span class="problems-panel__title">校验问题</span>
      <span v-if="issues.length > 0" class="problems-panel__counts">
        <span v-if="errorCount > 0" class="problems-panel__count problems-panel__count--error">
          {{ errorCount }} 错误
        </span>
        <span v-if="warningCount > 0" class="problems-panel__count problems-panel__count--warning">
          {{ warningCount }} 建议
        </span>
      </span>
      <span v-else class="problems-panel__count problems-panel__count--ok">无问题</span>
      <button
        type="button"
        class="problems-panel__refresh"
        title="手动校验"
        @click.stop="revalidate"
      >
        校验
      </button>
    </div>

    <div v-show="!collapsed" class="problems-panel__body">
      <div v-if="issues.length === 0" class="problems-panel__empty">暂无问题</div>
      <ul v-else class="problems-panel__list">
        <li
          v-for="(issue, index) in issues"
          :key="`${issue.ruleId}-${index}`"
          class="problems-panel__item"
          :class="`problems-panel__item--${issue.severity}`"
          @click="onLocate(issue)"
        >
          <span class="problems-panel__sev" :title="issue.severity === 'error' ? '错误' : '建议'">
            {{ issue.severity === 'error' ? '错误' : '建议' }}
          </span>
          <span class="problems-panel__rule">{{ RULE_TITLES[issue.ruleId] }}</span>
          <span class="problems-panel__message">{{ issue.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.problems-panel {
  display: flex;
  flex-direction: column;
  height: 152px;
  background: var(--color-surface);
}

.problems-panel--collapsed {
  height: auto;
}

.problems-panel__head {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  user-select: none;
}

.problems-panel__toggle {
  font-size: 9px;
  color: var(--color-text-secondary);
}

.problems-panel__title {
  font-size: 12px;
  font-weight: 600;
}

.problems-panel__counts {
  display: flex;
  gap: 8px;
}

.problems-panel__count {
  font-size: 11px;
}

.problems-panel__count--error {
  color: var(--color-error);
}

.problems-panel__count--warning {
  color: var(--color-warning);
}

.problems-panel__count--ok {
  color: #16a34a;
}

.problems-panel__refresh {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 5px;
}

.problems-panel__refresh:hover {
  border-color: var(--color-primary);
}

.problems-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.problems-panel__empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.problems-panel__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.problems-panel__item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}

.problems-panel__item:hover {
  background: rgb(51 112 255 / 6%);
}

.problems-panel__sev {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
}

.problems-panel__item--error .problems-panel__sev {
  color: var(--color-error);
}

.problems-panel__item--warning .problems-panel__sev {
  color: var(--color-warning);
}

.problems-panel__rule {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.problems-panel__message {
  color: var(--color-text);
}
</style>
