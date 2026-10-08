/**
 * 流程图持久化数据模型（version 1）。
 *
 * 设计原则（见 openspec/changes/agent-flow-editor-v1/design.md D4/D5）：
 * - schema 是"结构约束器"而非"语义执行器"：只约束结构与类型化条件，内容均为人工填写的自由值。
 * - `data` 按节点类型判别；退出条件是 exit 边的属性（类型化判别联合）。
 */

/** 画布坐标（左上角锚点） */
export interface XY {
  x: number
  y: number
}

/** 六类节点 */
export type NodeType = 'start' | 'thought' | 'action' | 'observation' | 'decision' | 'final'

/** 七类退出条件类型 */
export type ConditionType =
  | 'goal_achieved'
  | 'max_iterations'
  | 'timeout'
  | 'budget'
  | 'error'
  | 'human_interrupt'
  | 'custom'

/** 类型化退出条件（判别联合，锚定在 exit 边上） */
export type ExitCondition =
  | { type: 'goal_achieved' }
  | { type: 'max_iterations'; params: { max: number } }
  | { type: 'timeout'; params: { seconds: number } }
  | { type: 'budget'; params: { tokens: number } }
  | { type: 'error' }
  | { type: 'human_interrupt' }
  | { type: 'custom'; text: string }

/** 三类连线 */
export type EdgeKind = 'sequence' | 'loop' | 'exit'

/** 六类节点各自的 data 结构 */
export interface NodeDataMap {
  start: { goal: string }
  thought: { content: string }
  action: { tool: { name: string; params: Record<string, unknown> } }
  observation: { content: string }
  decision: { criteria?: string }
  final: { answer: string }
}

export type NodeData = NodeDataMap[NodeType]

/** 节点：type 判别 data（判别联合） */
export type FlowNode = {
  [T in NodeType]: { id: string; type: T; position: XY; data: NodeDataMap[T] }
}[NodeType]

/** 边：exit 边携带退出条件（条件未填时为 null，由校验规则 E4 标记） */
export type FlowEdge =
  | { id: string; source: string; target: string; kind: 'sequence' }
  | { id: string; source: string; target: string; kind: 'loop' }
  | { id: string; source: string; target: string; kind: 'exit'; data: { condition: ExitCondition | null } }

/** 元信息 */
export interface FlowMeta {
  name: string
  description?: string
}

/** 持久化格式（version 1） */
export interface FlowSchema {
  version: 1
  meta: FlowMeta
  nodes: FlowNode[]
  edges: FlowEdge[]
}

/**
 * 编辑期中间形态：与 X6 解耦的纯描述。
 * `graphToSchema` / `schemaToCells` 在此形态与持久化格式之间转换。
 */
export type RawNode = {
  [T in NodeType]: { id: string; nodeType: T; x: number; y: number; data: NodeDataMap[T] }
}[NodeType]

export interface RawEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  /** 仅 exit 边有值；其余为 null */
  condition: ExitCondition | null
}
