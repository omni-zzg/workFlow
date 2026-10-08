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

## 数据模型（JSON，v1 基线）

存储格式为自定义 schema（与 X6 内部 JSON 解耦，由 `src/schema` 负责双向转换与校验）：

```json
{
  "version": 1,
  "meta": { "name": "示例流程", "description": "" },
  "nodes": [
    {
      "id": "n1",
      "type": "thought",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "思考",
        "content": "需要先查询天气",
        "tool": null,
        "exitCondition": null
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "kind": "sequence", "data": {} }
  ]
}
```

- `edges[].kind`：`sequence`（顺序）| `loop`（回边）| `exit`（退出边，`data.condition` 必填）
- `action` 节点的 `data.tool`：工具名 + 参数
- 修改 schema 时必须同时更新：本节 + `src/schema` 类型定义 + 校验测试

## 目录结构（规划）

```text
src/
├── graph/        # X6 图实例封装：创建、插件、事件
│   └── nodes/    # 自定义节点注册与渲染（按节点类型拆分）
├── schema/       # JSON 数据模型：类型、校验、序列化/反序列化、X6 互转
├── components/   # Vue 组件：画布容器、工具栏、属性面板
└── stores/       # 状态管理
```

## 开发约定

- X6 图编辑逻辑与 Vue 组件解耦：X6 相关代码集中在 `src/graph/`，组件只负责 UI 与调用。
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
