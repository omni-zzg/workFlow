<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import { conditionSummary } from '@/schema'
import type { NodeDataMap, ReactStep } from '@/schema'

import { useNodeData } from './useNodeData'

/**
 * 任务卡片（spec: flow-canvas-editing）：
 * 常驻展示完整 ReAct 内容——任务名/步骤数 / 输入 / 全部步骤 / 循环退出条件徽标 / 前提条件 / 异常处理；
 * 内容超出卡片高度时在卡片内滚动查看（滚轮事件不冒泡到画布，避免误缩放）；卡片可拖拽调整尺寸。
 */
const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['task']>(props.node)

const name = computed(() => (data.value.name ?? '').trim())
const input = computed(() => (data.value.input ?? '').trim())
const steps = computed<ReactStep[]>(() => data.value.steps ?? [])
const exitSummaries = computed<string[]>(() =>
  (data.value.loop?.exitConditions ?? []).map((condition) => conditionSummary(condition)),
)
const precondition = computed(() => (data.value.precondition ?? '').trim())
const failure = computed(
  () => data.value.onFailure ?? { reflection: '', replan: '', maxRetries: 0 },
)
const maxRetries = computed(() => failure.value.maxRetries ?? 0)

function actionText(step: ReactStep): string {
  if (!step.actions || step.actions.length === 0) return '……'
  return step.actions.map((action) => action.name.trim() || '（未命名动作）').join('、')
}
</script>

<template>
  <div class="flow-node">
    <div class="flow-task">
      <div class="flow-task__head">
        <span class="flow-task__name" :class="{ 'flow-task__name--empty': !name }">
          {{ name || '未命名任务' }}
        </span>
        <span class="flow-task__count">共 {{ steps.length }} 步</span>
        <span v-if="maxRetries > 0" class="flow-task__retry">失败重试 ≤{{ maxRetries }}</span>
      </div>

      <div class="flow-task__scroll" @wheel.stop>
        <div class="flow-task__row">
          <span class="flow-task__label">输入</span>
          <span class="flow-task__value" :class="{ 'flow-task__value--empty': !input }">
            {{ input || '未填写输入' }}
          </span>
        </div>

        <div class="flow-task__steps">
          <div v-for="(step, index) in steps" :key="step.id" class="flow-task__step">
            <span class="flow-task__step-no">{{ index + 1 }}</span>
            <div class="flow-task__step-body">
              <div class="flow-task__line"><b>思考</b>{{ step.thought || '……' }}</div>
              <div class="flow-task__line"><b>行动</b>{{ actionText(step) }}</div>
              <div class="flow-task__line"><b>观察</b>{{ step.observation || '……' }}</div>
            </div>
          </div>
          <div v-if="steps.length === 0" class="flow-task__value flow-task__value--empty">
            未定义步骤（至少一组思考-行动-观察）
          </div>
        </div>

        <div class="flow-task__conditions">
          <span class="flow-task__label">⟳ 退出</span>
          <span v-if="exitSummaries.length === 0" class="flow-task__badge flow-task__badge--empty">
            未定义退出条件
          </span>
          <span v-for="(summary, index) in exitSummaries" :key="index" class="flow-task__badge">
            {{ summary }}
          </span>
        </div>

        <div class="flow-task__row">
          <span class="flow-task__label">⇒ 前提</span>
          <span class="flow-task__value" :class="{ 'flow-task__value--empty': !precondition }">
            {{ precondition || '未填写前提条件' }}
          </span>
        </div>

        <div class="flow-task__section">异常处理</div>
        <div class="flow-task__line">
          <b>反思</b>
          <span :class="{ 'flow-task__value--empty': !failure.reflection.trim() }">
            {{ failure.reflection.trim() || '……' }}
          </span>
        </div>
        <div class="flow-task__line">
          <b>重规划</b>
          <span :class="{ 'flow-task__value--empty': !failure.replan.trim() }">
            {{ failure.replan.trim() || '……' }}
          </span>
        </div>
        <div class="flow-task__line">
          <b>重试</b>
          <span :class="{ 'flow-task__value--empty': maxRetries <= 0 }">≤ {{ maxRetries }} 次</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-task {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 9px 12px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.4;
  background: #fff;
  border: 1.5px solid #94a3b8;
  border-radius: 10px;
  user-select: none;
}

.flow-task__head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
  flex-shrink: 0;
}

.flow-task__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.flow-task__name--empty {
  color: #94a3b8;
  font-style: italic;
}

.flow-task__count {
  flex-shrink: 0;
  font-size: 10px;
  color: #64748b;
}

.flow-task__retry {
  flex-shrink: 0;
  padding: 0 6px;
  font-size: 10px;
  color: #b45309;
  background: rgb(253 230 138 / 55%);
  border-radius: 4px;
}

/* 内容区：超出高度时卡片内滚动（滚轮不冒泡到画布，避免误缩放） */
.flow-task__scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  padding-right: 2px;
  overflow-y: auto;
}

.flow-task__scroll::-webkit-scrollbar {
  width: 6px;
}

.flow-task__scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.flow-task__row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.flow-task__label {
  flex-shrink: 0;
  font-size: 10px;
  color: #64748b;
}

.flow-task__value {
  min-width: 0;
  color: #334155;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.flow-task__value--empty {
  color: #94a3b8;
  font-style: italic;
}

.flow-task__steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
  border-top: 1px dashed #e2e8f0;
  border-bottom: 1px dashed #e2e8f0;
}

.flow-task__step {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.flow-task__step-no {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  font-size: 9px;
  line-height: 14px;
  color: #4338ca;
  text-align: center;
  background: #eef2ff;
  border-radius: 50%;
}

.flow-task__step-body {
  min-width: 0;
}

.flow-task__line {
  color: #475569;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.flow-task__line b {
  margin-right: 4px;
  font-weight: 600;
  color: #94a3b8;
}

.flow-task__conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.flow-task__badge {
  flex-shrink: 0;
  padding: 0 6px;
  font-size: 10px;
  color: #065f46;
  background: #d1fae5;
  border-radius: 4px;
}

.flow-task__badge--empty {
  color: #b45309;
  background: rgb(253 230 138 / 60%);
}

.flow-task__section {
  margin-top: 2px;
  padding-top: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  border-top: 1px dashed #e2e8f0;
}
</style>
