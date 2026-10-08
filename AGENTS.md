# AGENTS.md

> 面向 AI 编码代理（Claude Code、Cursor 等）的项目指南：本仓库的结构、领域约定与协作规范。

## 项目概述

基于 **Vue 3 + AntV X6** 的可视化流程图编辑器，面向 **Agent 工作流**：用户可以在画布上自由创建、绘制、编辑流程图，流程图数据以 **JSON** 形式存储（保存 / 导入 / 导出）。

与传统流程图工具的核心区别：节点与连线内建对 **Agent 思考过程** 和 **循环退出条件** 的表达能力，可直接刻画 ReAct 这类「思考 → 行动 → 观察 → 判断」的推理循环。

**功能范围（v1）**：画布编辑（拖拽/创建节点、连线）→ 节点属性编辑（思考内容、工具调用、退出条件）→ JSON 导入/导出 → ReAct 规则校验与提示。

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

### ReAct 循环

ReAct = Reason + Act，基本过程：

```text
Thought（思考）→ Action（行动）→ Observation（观察）→ 回到 Thought 判断 → … → 满足退出条件 → Final Answer
```

### 节点类型

| type | 含义 | 关键说明 |
| ---- | ---- | ---- |
| `start` | 开始 | 在其上声明任务目标（goal） |
| `thought` | 思考 | LLM 的推理内容，决定下一步做什么 |
| `action` | 行动 | 工具调用：工具名 + 参数 |
| `observation` | 观察 | 工具返回的结果 |
| `decision` | 判断 | 循环控制点：评估是否继续循环 |
| `final` | 结束 | 最终答案 / 终止态 |

### 循环与退出条件

- 循环以**回边**表达：从 `observation` / `decision` 连回 `thought`。
- 退出条件必须**显式**标注在 `decision` 节点的出边上，常见类型：
  - 目标达成（拿到最终答案）
  - 达到最大迭代次数（max steps）
  - 超时 / 预算耗尽
  - 错误终止 / 人工中断
- 校验规则：**每个循环至少要有一条标注了退出条件的出边**，否则视为非法流程图（无退出条件的循环 = 死循环）。

### ReAct 必备要素（校验清单）

一个合法的 ReAct 片段必须包含：

1. 明确的目标（`start` 节点上声明）
2. 至少一组 Thought → Action → Observation
3. 一个循环控制点（`decision`）
4. 显式的退出条件
5. 一条到达 `final` 的路径

> 以上规则同时用于 JSON 校验和画布 UI 提示，不要在别处重复定义。

## 数据模型（JSON，v1）

存储格式为自定义 schema（与 X6 内部 JSON 解耦，由 `src/schema` 负责转换与校验）：

```json
{
  "version": 1,
  "meta": { "name": "示例流程", "description": "" },
  "nodes": [
    {
      "id": "n1",
      "type": "thought",
      "position": { "x": 100, "y": 200 },
      "data": { "content": "需要先查询天气" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "kind": "sequence" },
    {
      "id": "e2", "source": "n2", "target": "n3", "kind": "exit",
      "data": { "condition": { "type": "max_iterations", "params": { "max": 8 } } }
    }
  ]
}
```

- `data` 按节点类型判别，各类型字段互不相同：
  - `start` → `goal`；`thought` / `observation` → `content`；`final` → `answer`
  - `action` → `tool: { name, params }`（params 为自由 JSON 对象，人工填写）
  - `decision` → `criteria?`（可选，判断依据说明）
- `edges[].kind`：`sequence`（顺序）| `loop`（回边）| `exit`（退出边）
- **退出条件只属于 exit 边**（节点级无此字段）：`data.condition` 为类型化判别联合，七类：
  `goal_achieved` | `max_iterations{max}` | `timeout{seconds}` | `budget{tokens}` | `error` | `human_interrupt` | `custom{text}`
  草稿态允许为 `null`（由校验规则 E4 标记，见 `openspec/specs/flow-validation`）
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
