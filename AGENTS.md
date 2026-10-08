# AGENTS.md

> 面向 AI 编码代理（Claude Code、Cursor 等）的项目指南：本仓库的结构、领域约定与协作规范。

## 项目概述

基于 **Vue 3 + AntV X6** 的可视化流程图编辑器，面向 **Agent 工作流**：用户可以在画布上自由创建、绘制、编辑流程图，流程图数据以 **JSON** 形式存储（保存 / 导入 / 导出）。

与传统流程图工具的核心区别：**每个任务节点内建一个完整的 ReAct 单元**（输入、思考-行动-观察步骤序列、循环退出条件、进入下一任务的前提条件、失败反思与重规划），任务流既描述"做什么"，也描述"每步怎么做、循环何时停、失败怎么办"。

**功能范围（v1）**：画布编辑（拖拽/创建节点、连线）→ 任务节点属性编辑（输入、步骤序列、循环退出条件、前提条件、异常处理）→ JSON 导入/导出 → ReAct 规则校验与提示。

## 技术栈

| 项 | 选择 |
| ---- | ---- |
| 框架 | Vue 3（Composition API + `<script setup>`） |
| 图编辑引擎 | AntV X6 |
| 构建 | Vite |
| 语言 | TypeScript |
| 包管理 | pnpm |
| 测试 | Vitest |

## 核心领域概念（最重要）

### 分层模型：任务流 + 节点内 ReAct

流程图描述**任务流**：一件事先做 A、再做 B。而**每个任务节点本身就是一个完整的 ReAct 单元**——进入 A 之后：

- A 怎么接收输入（`input`）
- A 内部按 ReAct 过程执行：多组「思考 → 行动 → 观察」构成步骤序列（`steps`）
- 步骤序列作为**循环体**重复执行：一轮 = 依次执行全部步骤，一轮结束评估循环退出条件；未退出则重跑序列（`loop.exitConditions`，max_iterations 计轮数）
- A 怎么判断可以进入 B：完成任务的前提条件（`precondition` 自由文本描述判断依据）
- A 遇到问题怎么反思/重规划：`onFailure`（反思 → 重规划 → 重试上限）；必要时通过 `failure` 边路由到其他任务（如人工介入）

### 节点类型

| type | 含义 | 关键说明 |
| ---- | ---- | ---- |
| `start` | 开始 | 声明全局目标（goal） |
| `task` | 任务 | 唯一承载 ReAct 结构的节点：输入 / 步骤序列 / 循环退出条件 / 前提条件 / 异常处理 |
| `final` | 结束 | 最终产出（answer） |

### 连线类型

| kind | 含义 | 关键说明 |
| ---- | ---- | ---- |
| `success` | 成功转移 | `data.condition` 为该转移的类型化前提条件；`start` 的出边豁免（可为 null） |
| `failure` | 异常转移 | 失败 / 超限 / 人工介入路径，`data.condition` 可选 |

### 类型化条件（循环退出条件与转移前提条件共用）

`goal_achieved` | `max_iterations{max}` | `timeout{seconds}` | `budget{tokens}` | `error` | `human_interrupt` | `custom{text}`

### ReAct 必备要素（校验清单）

**每个任务节点**必须：

1. 有任务名与目标
2. 至少一组「思考 → 行动 → 观察」步骤
3. 有循环退出条件（类型化，且至少一条可控退出：目标达成 / 最大迭代 / 超时 / 预算）
4. 有进入下一步的前提条件（若存在 `success` 出边）
5. 声明异常处理（反思与重规划）

**整张图**必须：

1. 有开始（全局目标声明）与可达的结束
2. 由失败回退形成的环必须有能离开该环的成功出口（否则视为死循环风险）

> 以上规则同时用于 JSON 校验和画布 UI 提示，不要在别处重复定义。

## 数据模型（JSON，v1）

存储格式为自定义 schema（与 X6 内部 JSON 解耦，由 `src/schema` 负责转换与校验）：

```json
{
  "version": 1,
  "meta": { "name": "示例任务流", "description": "" },
  "nodes": [
    { "id": "s1", "type": "start", "position": { "x": 120, "y": 40 },
      "data": { "goal": "为用户生成出行建议" } },
    { "id": "t1", "type": "task", "position": { "x": 120, "y": 160 },
      "data": {
        "name": "查询天气",
        "goal": "获取目标城市实时天气",
        "input": "用户问题中的城市（默认北京）",
        "steps": [
          { "id": "t1-s1", "thought": "需要调用天气工具",
            "actions": [{ "name": "get_weather", "params": { "city": "北京" } }],
            "observation": "返回温度与天气状况" }
        ],
        "loop": { "exitConditions": [
          { "type": "goal_achieved" },
          { "type": "max_iterations", "params": { "max": 5 } }
        ] },
        "precondition": "拿到有效天气数据",
        "onFailure": { "reflection": "分析失败原因：网络？城市名？",
                       "replan": "修正城市名或改用备用数据源", "maxRetries": 3 }
      } },
    { "id": "f1", "type": "final", "position": { "x": 120, "y": 460 },
      "data": { "answer": "最终建议" } }
  ],
  "edges": [
    { "id": "e1", "source": "s1", "target": "t1", "kind": "success", "data": { "condition": null } },
    { "id": "e2", "source": "t1", "target": "f1", "kind": "success",
      "data": { "condition": { "type": "goal_achieved" } } },
    { "id": "e3", "source": "t1", "target": "f1", "kind": "failure",
      "data": { "condition": { "type": "max_iterations", "params": { "max": 3 } } } }
  ]
}
```

- 节点三类：`start` → `{ goal }`；`final` → `{ answer }`；`task` → ReAct 单元（见上例，`steps` ≥ 1，
  `onFailure` 三字段为反思/重规划/重试上限；`params` 为自由 JSON 对象，人工填写）
- 连线两类：`success`（成功转移，前提条件必填，`start` 出边豁免）| `failure`（异常路径，条件可选）
- 类型化条件（七类，循环退出条件与转移前提条件共用）：
  `goal_achieved` | `max_iterations{max}` | `timeout{seconds}` | `budget{tokens}` | `error` | `human_interrupt` | `custom{text}`
  草稿态条件允许为 `null`（由校验规则标记，见 `openspec/specs/flow-validation`）
- 节点尺寸不持久化（由内容自适应），仅存左上角坐标
- 修改 schema 时必须同时更新：本节 + `src/schema` 类型与 zod 定义 + 校验测试

## 目录结构

```text
src/
├── schema/       # 数据模型：类型、zod 校验、持久化格式 <-> 中间形态转换
├── analysis/     # 纯图算法：SCC 循环识别、可达性、祖先判断（零依赖）
├── validation/   # ReAct 校验规则集（E1-E4 / W1-W8）与规则注册表
├── graph/        # X6 封装：实例与插件、投影、mutate、态标注、ReAct 模板、导入导出
│   └── nodes/    # 六类节点的 Vue SFC 与 shape 注册
├── components/   # Vue 组件：工具栏、调色板、画布、属性面板、问题面板、导入对话框
├── stores/       # 轻量状态：图运行时、单选快照、文档脏标记、校验集成
├── testing/      # 测试夹具（jsdom polyfill、图构造），不进入应用包
└── styles/       # 全局样式（含 cell 态标注）
```

- 依赖方向：`components → graph | stores | schema | validation`；`validation → analysis`；`graph → analysis`。`schema/` 与 `analysis/` 不依赖 X6/Vue。
- 测试策略：纯逻辑（schema/analysis/validation/template/io）用 Vitest 单测；`graph/` 与关键组件用 jsdom 冒烟（`*.smoke.spec.ts`）；纯视觉与鼠标交互由人工验收。

## 开发约定

- X6 图编辑逻辑与 Vue 组件解耦：X6 相关代码集中在 `src/graph/`，组件只负责 UI 与调用。
- 编辑期唯一真源是 X6 `Graph` 实例（领域数据存于 `cell.data`）；`stores/` 只保存派生视图，不得保存第二份图数据。
- 所有程序化修改（含属性面板写入）必须经 `graph/` 的 `mutate()` 包装，保证撤销粒度正确。
- 新增/修改节点类型时，同步更新四处：① `schema` 类型 ② 节点渲染 ③ 校验规则 ④ 本文档节点表。
- JSON 序列化/反序列化与 ReAct 校验规则必须有单元测试（Vitest）。
- 本文档是活文档：领域概念、schema、目录或命令变化时，同步更新。

## 变更流程（OpenSpec）

迭代走 spec-driven 流程（`openspec/`，CLI 1.14.1）：

- 新需求先 `/opsx:propose` 产出提案与规格，再 `/opsx:apply` 实现，完成后 `/opsx:archive` 归档
- `openspec/specs/` 是主规格（能力清单）；`openspec/changes/` 是进行中的变更
- 产物用中文撰写（结构标题与 SHALL/MUST 等关键词保留英文），详见 `openspec/config.yaml`
- 实现时必须遵守本文档「核心领域概念」一节（节点类型、ReAct 必备要素、退出条件）

## 通用规范（每次改动都适用）

- 每次改动完成后，创建对应的 Git commit，便于跟踪和回滚。
- 每次改动后，编写/更新相关测试，交付前确保测试全部通过。
- 禁止硬编码密钥（API Key / Token / Secret / 密码），一律通过 `.env` 注入；`.env` 必须写入 `.gitignore`，严禁提交。

## 命令

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器
pnpm build       # 构建产物
pnpm test        # 运行单元测试
```
