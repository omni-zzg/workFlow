/**
 * 任务流持久化数据模型（version 1）。
 *
 * 设计原则（见 design.md D4/D5）：
 * - schema 是"结构约束器"而非"语义执行器"：只约束结构，内容均为人工填写的自由值。
 * - 画布 = 任务流；每个 task 节点自身是一个完整 ReAct 单元：
 *   输入 → 多步「思考/行动/观察」序列（作为循环体重复，直到循环退出条件满足）
 *   → 进入下一任务的前提条件 → 失败反思与重规划。
 */

/** 画布坐标（左上角锚点） */
export interface XY {
  x: number
  y: number
}

/** 三类节点 */
export type NodeType = 'start' | 'task' | 'final'

/** 七类类型化条件（循环退出条件与转移前提条件共用） */
export type ConditionType =
  | 'goal_achieved'
  | 'max_iterations'
  | 'timeout'
  | 'budget'
  | 'error'
  | 'human_interrupt'
  | 'custom'

/** 类型化条件（判别联合） */
export type ExitCondition =
  | { type: 'goal_achieved' }
  | { type: 'max_iterations'; params: { max: number } }
  | { type: 'timeout'; params: { seconds: number } }
  | { type: 'budget'; params: { tokens: number } }
  | { type: 'error' }
  | { type: 'human_interrupt' }
  | { type: 'custom'; text: string }

/** 两类连线：普通连线（依次衔接）/ 异常出口（失败时转向其他节点，可选） */
export type EdgeKind = 'normal' | 'exception'

/** 任务步骤中的动作（工具调用；params 为自由 JSON 对象，人工填写） */
export interface ReactAction {
  name: string
  params: Record<string, unknown>
}

/** 任务步骤：一组「思考-行动-观察」 */
export interface ReactStep {
  id: string
  thought: string
  actions: ReactAction[]
  observation: string
}

/** 任务失败处置：反思 → 重规划 → 重试上限 */
export interface TaskFailureHandling {
  reflection: string
  replan: string
  maxRetries: number
}

/** 任务节点的 data：一个完整 ReAct 单元 */
export interface TaskData {
  /** 任务名 */
  name: string
  /** 本任务要达成什么 */
  goal: string
  /** 输入：从哪来 / 是什么 */
  input: string
  /** 多步序列（循环体；一轮 = 依次执行全部步骤，未退出则重跑） */
  steps: ReactStep[]
  /** 循环退出条件（类型化，可多条） */
  loop: { exitConditions: ExitCondition[] }
  /** 进入下一任务的判断依据（自由文本） */
  precondition: string
  /** 异常处理 */
  onFailure: TaskFailureHandling
}

/** 各节点类型的 data */
export interface NodeDataMap {
  start: { goal: string }
  task: TaskData
  final: { answer: string }
}

export type NodeData = NodeDataMap[NodeType]

/** 节点尺寸（可选持久化；缺省按类型给定） */
export interface Size {
  width: number
  height: number
}

/** 节点：type 判别 data（判别联合） */
export type FlowNode = {
  [T in NodeType]: { id: string; type: T; position: XY; size?: Size; data: NodeDataMap[T] }
}[NodeType]

/** 边：普通连线（依次衔接）/ 异常出口（失败时转向其他节点，可选）；均无附加数据 */
export interface FlowEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
}

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
  [T in NodeType]: {
    id: string
    nodeType: T
    x: number
    y: number
    width?: number
    height?: number
    data: NodeDataMap[T]
  }
}[NodeType]

export interface RawEdge {
  id: string
  source: string
  target: string
  kind: EdgeKind
}
