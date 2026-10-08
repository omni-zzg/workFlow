<script setup lang="ts">
import { computed } from 'vue'
import type { Graph, Node } from '@antv/x6'

import type { NodeDataMap } from '@/schema'

import { useExitConditionSummaries, useNodeData } from './useNodeData'

/** 判断节点：六边形（菱形系视觉），内嵌退出条件徽标（spec: flow-canvas-editing） */
const props = defineProps<{ node: Node; graph: Graph }>()
const data = useNodeData<NodeDataMap['decision']>(props.node)
const summaries = useExitConditionSummaries(props.node, props.graph)

const criteria = computed(() => (data.value.criteria ?? '').trim())
</script>

<template>
  <div class="flow-node">
    <div class="flow-decision">
      <div class="flow-decision__inner">
        <div class="flow-decision__title">判断</div>
        <div v-if="criteria" class="flow-decision__criteria">{{ criteria }}</div>
        <div class="flow-decision__badges">
          <span
            v-if="summaries.length === 0"
            class="flow-decision__badge flow-decision__badge--empty"
          >
            未定义退出条件
          </span>
          <span v-for="(summary, index) in summaries" :key="index" class="flow-decision__badge">
            {{ summary }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-decision {
  width: 100%;
  height: 100%;
  padding: 2px;
  background: #f59e0b;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

.flow-decision__inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px 30px;
  text-align: center;
  background: #fffbeb;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

.flow-decision__title {
  font-size: 12px;
  font-weight: 600;
  color: #92400e;
}

.flow-decision__criteria {
  overflow: hidden;
  font-size: 11px;
  color: #78350f;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 100%;
}

.flow-decision__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
}

.flow-decision__badge {
  padding: 0 5px;
  font-size: 10px;
  color: #065f46;
  background: #d1fae5;
  border-radius: 4px;
}

.flow-decision__badge--empty {
  color: #b45309;
  background: rgb(253 230 138 / 60%);
}
</style>
