# Design

## Context

绿地项目：当前目录仅有 `AGENTS.md`（领域基线）与 OpenSpec 骨架，无任何代码。动机与范围见 `proposal.md`。

塑造本设计的约束：

- **领域约束**：节点与连线的语义由 `AGENTS.md`「核心领域概念」定义（六类节点、三类边、ReAct 必备要素、退出条件），规格见 `specs/` 四个能力。
- **设计原则——schema 是"结构约束器"而非"语义执行器"**：格式只强制声明目标、T-A-O 链条、循环控制点与显式退出条件；推理内容、工具参数等一律人工填写，系统不做语义校验、不引入条件表达式引擎。
- **变更流程**：迭代走 OpenSpec（先规格后实现），产物用中文。
- **运行环境**：纯浏览器单页应用，v1 无后端；文件流转走本地下载/上传。
- **既定方向（v2，不在本次范围）**：流程图回放/假执行。本设计为其预留两个接缝（见 Decisions D2、D10），但不实现回放引擎。

## Goals / Non-Goals

**Goals：**

- 一个可直接实现的分层架构：UI（Vue 组件）与图引擎（X6 封装）解耦，纯逻辑（数据模型、图算法、校验规则）可脱离 DOM 单测。
- 明确"谁是真源"与数据流向，避免双向同步类缺陷。
- 为 v2 回放预留低成本接缝：纯函数图算法模块、统一的 cell 态标注接口。
- 落地四条规格（画布编辑、属性编辑、JSON 存储、ReAct 校验）所需的全部技术选型。

**Non-Goals：**

- 不实现回放/假执行引擎、不实现多文档管理、不做 i18n、无后端与账号体系。
- 不引入组件库与重型 UI 依赖；不做大图渲染优化（目标规模为数百节点）。
- 不支持除自有 JSON 之外的任何数据格式（无外部格式兼容层）。

## Decisions

### D1. 编辑期真源：X6 Graph 实例；schema JSON 是持久化格式

编辑期的唯一真源是 X6 `Graph` 实例（节点/边的领域数据存于 cell 的 `data`）。数据流为单向：

```
  用户交互 ──> X6 Graph (真源) ──投影──> FlowSchema JSON ──> 校验 / 导出
                   ^
                   └──── 导入：FlowSchema JSON ──还原──> Graph
```

- 校验/导出消费 `graphToSchema(graph)` 的纯投影结果，**不**在 store 里维护第二份图数据。
- 导入是"整体替换"：校验通过后清空画布重建，并清空撤销栈。
- **备选**：store 持有 schema、与 X6 双向同步 —— 拒绝：X6 的拖动/连线天然产生在 graph 侧，双向同步的映射与竞态成本高、易出隐性缺陷。

### D2. 目录分层与依赖方向

```
src/
├── schema/       # 数据模型：TS 类型、zod 校验、FlowSchema <-> X6 投影转换
├── analysis/     # 纯图算法：SCC 找环、可达性、祖先判断、后继查询（零依赖）
├── validation/   # 校验规则集：基于 analysis 产出一组 Issue
├── graph/        # X6 封装：创建、插件、节点/边的视觉与交互、态标注
│   └── nodes/    # 六类节点的 Vue SFC 与 shape 注册
├── components/   # Vue 组件：工具栏、调色板、画布容器、属性面板、问题面板
└── stores/       # 轻量状态：选中、校验结果、脏标记（图的派生视图）
```

依赖方向单向：`components → graph | stores | schema | validation`；`validation → analysis`；`graph → analysis`（回边识别）。`analysis/` 与 `schema/` 不依赖 X6/Vue，可纯单测。此分层是对 `AGENTS.md`「目录结构」的扩展，随本变更同步更新该文档。

### D3. 节点渲染：`@antv/x6-vue-shape` + 每类型一个 Vue SFC

六类节点各一个 SFC（如 `ThoughtNode.vue`），经 `register({ shape, component })` 注册。节点内的差异化视觉（thought 虚线边框、decision 菱形与**退出条件徽标**、action 工具徽标）都在 SFC 内实现。

- **备选**：X6 内置 shape + markup —— 拒绝：徽标、条件列表等复杂内容用模板字符串难维护；SFC 可复用 Vue 生态与类型检查。代价是每节点一个 Vue 实例，在目标规模（数百节点）内可接受。

### D4. 数据模型定稿（对 `AGENTS.md` 基线的修正）

- **`data` 按节点类型判别**（TS discriminated union）：`start{goal}`、`thought{content}`、`action{tool{name,params}}`、`observation{content}`、`decision{criteria?}`、`final{answer}`。
- **退出条件是 exit 边的属性**（`edge.data.condition`），删除基线中节点级的 `data.exitCondition` 与通用 `data.label`——一个 decision 可有多条出口，节点级单字段装不下；label 只是类型名的复述。
- **退出条件类型化**：`goal_achieved | max_iterations{max} | timeout{seconds} | budget{tokens} | error | human_interrupt | custom{text}`；`custom` 是自由文本逃生口。类型化使校验能区分"可控退出"，且条件徽标/边标签可自动生成。
- **不持久化节点尺寸**：position 存左上角坐标，尺寸由内容自适应（见 Risks）。
- `version: 1`；图数据之外只留 `meta`（名称/描述等）；校验结果等派生数据一律不持久化。

### D5. 导入校验用 zod；schema 与 TS 类型同源

`schema/` 用 zod 定义 v1 结构（含判别联合与七类条件），由 schema 推断 TS 类型，导入时用同一份定义校验并产出带路径的可读错误。

- 未识别的**额外字段**：忽略（为字段级扩展留余地）；未识别的**类型/缺失必需字段/版本不支持**：报错并拒绝导入，画布不动。
- **备选**：ajv + 手写 JSON Schema（要维护两份定义）、纯手写校验（代码多且易漏）——均拒绝。

### D6. 状态管理：不引入 Pinia，模块级 composable 单例

`stores/` 提供 `useGraph()`（graph 实例单例）、`useSelection()`、`useValidation()`（问题列表 + 态标注联动）、`useDocument()`（脏标记、meta）。这些状态本质是 X6 图的**派生视图**，而非独立领域状态；引入独立 store 会让"谁是真源"含混。

- **备选**：Pinia —— 拒绝：当前单视图、状态轻；若 v2 出现回放会话/多文档，再评估迁移。

### D7. 撤销/重做：X6 history 插件 + 统一 mutate 包装

启用 `@antv/x6-plugin-history`（限制栈深，如 100 步）。所有程序化修改——包括属性面板的字段编辑——必须经 `graph/` 暴露的统一 `mutate(fn)` 包装（内部 batch），保证"撤销属性修改"成立（规格 `flow-property-editing`、`flow-canvas-editing` 的撤销场景）。导入后清空历史。

### D8. X6 插件与画布能力清单

| 插件 | 用途 |
| ---- | ---- |
| selection | 单选/框选，属性面板与删除的输入 |
| snapline | 拖动对齐辅助线（规格要求） |
| history | 撤销/重做 |
| keyboard | Delete 删除等快捷键 |
| clipboard | 复制粘贴（编辑效率，含 Ctrl+C/V） |
| dnd / stencil | 调色板拖拽创建节点 |

画布导航（滚轮缩放、拖拽平移、适应画布）用 Graph 内置交互；不加 minimap（v1 保持简洁，需要时插件即插即用）。

### D9. 校验：纯函数规则集 + 全量重算 + 防抖

`validation/` 暴露 `validate(schema): Issue[]`，`Issue = {severity, ruleId, message, cellIds[]}`。实现要点：

- 循环检测用 **Tarjan SCC**：每个强连通分量即一个"循环"（含自环）；"死循环风险"（E2）判定为该 SCC 存在离开它的、条件非空的 exit 边。
- 其余规则用可达性/祖先等基础算法：E1 目标与入口、E3 终止路径、E4 退出条件完整性、W1 三要素链、W2/W7 判断点规范、W3 可控退出、W4/W5 连通性、W6 kind 与拓扑一致、W8 多 start。
- 触发：graph 结构性事件与 cell data 变化 → 防抖（约 200ms）→ 全量重算（O(V+E)，目标规模无压力）；空图短路。**增量校验不做**——复杂度不值得。
- error/warning 分级语义：error = 结构非法（死循环、断链、条件缺失、无目标）；warning = 规范性建议。导出时 error 触发确认弹窗（规格 `flow-json-storage`）。

### D10. Cell 态标注机制（校验与 v2 回放共用）

`graph/` 暴露统一接口 `setCellState(cellId, state)` / `clearCellStates()`，实现"节点/边按状态呈现特殊样式"（如校验角标、高亮描边）。v1 只有校验一个消费者（问题面板点击定位 → 高亮 cell）；v2 回放的高亮/当前节点/已走路径直接复用同一接口，回放态与校验态可叠加。

### D11. UI 技术取向

不引入组件库（下拉、输入、徽标等手写轻量控件）；样式用 SFC scoped CSS。布局：

```
+------------------------------------------------------------+
| 工具栏: 新建 | 导入 | 导出 | 校验 | 撤销/重做 | 适应画布        |
+----------+-------------------------------------+-----------+
| 调色板    |            X6 画布                 | 属性面板    |
| 六类节点  |   (空态: 引导 + 插入 ReAct 模板)      | (选中对象)  |
| 模板按钮  |                                     |           |
+----------+-------------------------------------+           |
| 问题面板 (可折叠): 级别 + 描述列表, 点击定位                    |
+------------------------------------------------------------+
```

### D12. 视觉语言

| 节点 | 视觉 | 边 | 视觉 |
| ---- | ---- | ---- | ---- |
| start | 胶囊、绿色 | sequence | 实线、灰 |
| thought | 虚线边框、蓝紫 | loop | 虚线、弯曲、标签"循环" |
| action | 实线、橙色、工具徽标 | exit | 高亮实线、标签=条件摘要 |
| observation | 实线、灰色 | | |
| decision | 菱形、琥珀、内嵌退出条件徽标 | | |
| final | 加粗胶囊、深绿 | | |

回边识别：创建连线时用 `analysis.isAncestor(target, source)` 判断是否成环，成环则自动 kind=loop（规格 `flow-canvas-editing`）；decision 的 exit 出边无法自动推断，由用户在属性面板选择条件类型。

### D13. 测试策略

Vitest 覆盖全部纯逻辑（`AGENTS.md` 硬性要求）：

- `schema/`：序列化往返一致性（含多循环、custom 条件）、非法输入的 zod 错误断言。
- `analysis/`：SCC/自环/多循环、可达性、祖先判断的边界用例。
- `validation/`：每条规则至少一组正例+反例；空图无问题。
- `graph/` 增加 jsdom 模型级冒烟测试（实例/插件、投影与撤销、态标注、store 联动；以少量浏览器 API polyfill 支撑，不做交互模拟）；`components/` 不写自动化测试，交互场景以人工验收清单覆盖（task 11.1）。

### D14. 依赖清单

`vue@3`、`@antv/x6`、`@antv/x6-vue-shape`、`@antv/x6-plugin-{selection,snapline,history,keyboard,clipboard,dnd}`、`zod`；开发：`vite`、`@vitejs/plugin-vue`、`typescript`、`vitest`。包管理 pnpm。

## Risks / Trade-offs

- [嵌套循环只按最大 SCC 分析：内外层嵌套环中，内层不会被单独识别] → v1 接受（最大 SCC 判定仍保证"该环必须有退出条件"这一主结论）；在 `AGENTS.md` 记录该语义边界。
- [节点尺寸由内容自适应、仅持久化左上角坐标：导入后长文本节点可能与邻近节点轻微重叠] → 位置锚定左上角可保证稳定复现；导入后可"适应画布"并手动微调；若体验不佳，v2 评估尺寸持久化。
- [属性面板等程序化修改若绕过 mutate 包装，撤销会不完整] → 统一入口 + `flow-property-editing` 撤销场景作为验收项。
- [X6 插件与 Vue 生命周期耦合（graph 泄漏）] → graph 生命周期收敛在 `graph/` 封装内，画布组件卸载时统一 dispose。
- [zod/规则集把"格式"做重，违背"结构约束器"原则] → 定期以原则自检：凡涉及内容语义的校验一律不加。

## Open Questions

- 节点视觉细节（精确尺寸、配色、图标、长文本截断策略）留实现期定稿，不影响规格与任务拆分。
- 大图（明显超过数百节点）的性能策略延后评估，当前设计不为其优化。
