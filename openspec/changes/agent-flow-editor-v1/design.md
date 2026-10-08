# Design

## Context

项目由脚手架 + 两轮规划构成；动机与范围见 `proposal.md`。塑造本设计的约束：

- **领域模型（已确认）**：画布是任务流（先做 A、再做 B）；**每个任务节点本身是一个完整的 ReAct 单元**——输入、多步「思考/行动/观察」序列、类型化循环退出条件、进入下一任务的前提条件、失败反思与重规划。领域定义见 `AGENTS.md`，行为规格见 `specs/` 四个能力。
- **模型修订记录**：早期草案曾把整张图建模为单一全局 ReAct 循环（顶层 thought/action/observation/decision 节点）；经确认修正为"任务流 + 节点内 ReAct"，任务组 1-11 的已完成实现中凡与旧模型耦合的部分在任务组 12 重构。
- **设计原则——schema 是"结构约束器"而非"语义执行器"**：格式强制声明输入、步骤、循环退出条件、前提条件与失败处置；推理内容、工具参数等一律人工填写，不做语义校验、不引入表达式引擎。
- **运行环境**：纯浏览器单页应用，v1 无后端；文件流转走本地下载/上传。
- **既定方向（v2，不在本次范围）**：流程图回放/假执行——按任务逐节点展开回放（进入某任务后回放其步骤与循环退出判定）。

## Goals / Non-Goals

**Goals：**

- 分层建模落地：顶层任务流（可达性/失败回退环）+ 节点内 ReAct 单元（步骤序列与循环语义）各自可校验、可编辑。
- 任务卡片刻画"思考、循环退出条件、前提条件、失败处置"——应用的核心卖点必须在画布上一眼可见。
- UI 与图引擎、纯逻辑分层如前；为 v2 节点级回放保留接缝（纯函数图算法、cell 态标注）。
- 落实四条规格所需的全部技术选型。

**Non-Goals：**

- 不做"双击进入节点内部的可展开子画布"（schema 预留扩展位，v2 评估）；不实现回放引擎、多文档、i18n、后端。
- 不引入组件库与重型依赖；不为大图渲染做优化（目标规模：数十个任务节点）。

## Decisions

### D1. 编辑期真源：X6 Graph 实例；任务流 JSON 是持久化格式

同前：编辑期唯一真源是 X6 `Graph`（领域数据存于 `cell.data`）；`graphToSchema` 投影供校验/导出，导入走 `schemaToCells` 还原；不做双向同步；导入为整体替换并清空撤销栈。

### D2. 目录分层与依赖方向

```
src/
├── schema/       # 任务流数据模型：类型、zod 校验、持久化格式 <-> 中间形态转换
├── analysis/     # 纯图算法：SCC（失败回退环）、可达性、祖先判断（零依赖）
├── validation/   # 校验规则集（E1-E8 / W1-W7）与规则注册表
├── graph/        # X6 封装：实例与插件、投影、mutate、态标注、任务流模板、导入导出
│   └── nodes/    # start/task/final 的 Vue SFC 与 shape 注册
├── components/   # Vue 组件：工具栏、调色板、画布、属性面板、问题面板、导入对话框
├── stores/       # 轻量状态：图运行时、单选快照、文档脏标记、校验集成
├── testing/      # 测试夹具，不进入应用包
└── styles/       # 全局样式（含 cell 态标注）
```

依赖方向单向：`components → graph | stores | schema | validation`；`validation → analysis`；`graph → analysis`。

### D3. 节点渲染：任务卡片常驻 ReAct 骨架

三类节点各一个 SFC（vue-shape + teleport 模式，机制同前）：
- `task`：**任务卡片**（默认约 264×188）——标题（任务名 + 失败重试摘要）→ 输入 → 步骤摘要（最多展示前 2 步，超出显示"共 N 步"）→ **循环退出条件徽标行** → 前提条件摘要；各区块空态占位。
- `start` / `final`：胶囊（绿/深绿），分别显示全局目标与最终产出。
- 卡片骨架是"固定槽位 + 数据摘要"：退出条件徽标与步骤摘要随属性编辑即时刷新（订阅 change:data 重算）。

### D4. 数据模型定稿（version 1，pre-release 直接重定义）

- **节点三类**：`start{goal}`、`final{answer}`、`task{...}`（判别联合）。
- **task = ReAct 单元**：
  - `name`（任务名）、`goal`（本任务要达成什么）、`input`（输入描述）
  - `steps: { id, thought, actions: {name, params}[], observation }[]`——**循环体**：一轮 = 依次执行全部步骤；一轮结束评估退出条件，未退出则重跑序列（`max_iterations` 计轮数）
  - `loop: { exitConditions: ExitCondition[] }`——类型化循环退出条件（可多条）
  - `precondition`——进入下一任务的判断依据（自由文本；结构化前提声明在 success 边上）
  - `onFailure: { reflection, replan, maxRetries }`——反思 / 重规划 / 重试上限
- **边两类**：`success`（成功的任务转移，`data.condition` 为类型化前提条件，start 出边豁免）/ `failure`（异常与回退路径，条件可选）；两类的条件均可为 null（草稿态，由校验标记）。
- **类型化条件七类**在循环退出条件与转移前提条件间复用：`goal_achieved | max_iterations{max} | timeout{seconds} | budget{tokens} | error | human_interrupt | custom{text}`。
- 尺寸不持久化；**扩展位**：`steps` 为带 id 的数组、节点字段单层组织，未来引入节点内子画布时可增加 `subflow` 类字段而不破坏既有结构。

### D5. 导入校验用 zod；schema 与 TS 类型同源

同前（判别联合 + 未知类型前置扫描给出精确错误）；旧模型数据（如 `type:"thought"`）按"未知的节点类型"拒绝并给出位置，无需迁移（未发布）。

### D6. 状态管理：不引入 Pinia，模块级 composable 单例

同前。

### D7. 撤销/重做：X6 history 插件 + 统一 mutate 包装

同前。补充约定：**派生样式（边样式、卡片骨架为渲染层）不进入撤销栈**；history 过滤以通配事件 `cell:change:*` + `args.key` 判定（attrs/router/connector/labels/vertices），回边 kind 推断以 `dryrun` 写入不占独立撤销步（实现已在 5/7 组验证）。

### D8. X6 插件与画布能力清单

同前：selection / snapline / history / keyboard / clipboard / dnd；画布导航内置；不加 minimap。连线校验：`allowLoop:false`、`allowBlank:false`、重复判定按 **(source, target, kind)** 三元组。

### D9. 校验：逐节点 ReAct 要素 + 顶层任务流完整性

`validation/` 暴露 `validate(schema): Issue[]`，规则表：

| 级别 | 规则 |
| ---- | ---- |
| error | E1 任务名/目标缺失；E2 步骤序列为空（≥1 组 T-A-O）；E3 循环退出条件缺失；E4 有 success 出边但前提条件为空；E5 success 边条件缺失（start 出边豁免）；E6 无 start 或 goal 为空；E7 无 final 或不可达；E8 失败回退环没有离开环的 success 出口（SCC） |
| warning | W1 步骤不完整（思考/行动/观察缺项）；W2 循环仅有异常/人工/自定义退出（不可控）；W3 反思或重规划为空；W4 有 success 出边但无 failure 出边（建议声明失败出口）；W5 不可达节点；W6 非 final 节点无出边（流程中断）；W7 多个 start |

触发：graph 结构性事件与 cell data 变化 → 防抖（约 200ms）→ 全量重算（O(V+E)）；空图短路；error/warning 分级语义与导出确认同前。

### D10. Cell 态标注机制（校验与 v2 回放共用）

统一 `setCellState`/`flash` 接口（类名切换 + global.css），v1 消费者为校验角标与定位闪烁；v2 节点级回放复用。

### D11. UI 技术取向

布局同前（工具栏 / 调色板（**开始、任务、结束** 三项 + 模板按钮）/ 画布 / 属性面板 / 问题面板）；不引入组件库。

### D12. 视觉语言

| 节点 | 视觉 |
| ---- | ---- |
| start | 胶囊、绿底，显示全局目标 |
| task | 卡片：名称 + 输入 + 步骤摘要区 + **循环退出条件徽标** + 前提条件 + 失败重试摘要 |
| final | 胶囊、深绿加粗，显示最终产出 |

| 边 | 视觉 |
| ---- | ---- |
| success | 实线、青灰，标签=前提条件摘要 |
| failure | 橙色虚线、弯曲，标签=条件摘要或"异常" |

回边识别：连线时 `isAncestor(target, source)` 为真（构成环）自动 kind=`failure`；其余默认 `success`。任务流模板：start → task（预填 2 步示例、退出条件、前提、异常处理）→ final，附 task→final 的 failure 边。

### D13. 测试策略

- 纯逻辑（schema / analysis / validation / template / io）Vitest 单测，覆盖往返一致、规则正反例、模板零问题。
- `graph/` 与关键组件 jsdom 冒烟（`*.smoke.spec.ts`，少量浏览器 API polyfill）；端到端冒烟覆盖"新建→模板→编辑→校验→导出→回导"。
- 纯视觉与鼠标交互由人工验收清单覆盖（task 11.1）。

### D14. 依赖清单

同前：`vue@3`、`@antv/x6` + 插件、`@antv/x6-vue-shape`、`zod`；开发：`vite`、`@vitejs/plugin-vue`、`typescript`、`vitest`、`jsdom`；包管理 pnpm。

## Risks / Trade-offs

- [任务卡片信息密度高、尺寸较大（约 264×188），大图空间占用上升] → 步骤摘要仅展示前 2 步 + "共 N 步"；画布缩放与适应画布缓解；后续可做折叠样式。
- [多步序列的循环语义（一轮 = 全部步骤顺序执行）与真实 ReAct 的逐步循环存在差异] → 在 `AGENTS.md` 明确该语义；若需要更自由的控制流，走 v2 节点内子画布。
- [失败回退环沿用最大 SCC 判定（嵌套环不单独识别）] → 与旧实现一致，记录于 `AGENTS.md`；主结论（环必须有成功出口）不受影响。
- [旧模型数据（开发期导出）导入被拒绝] → 给出"未知的节点类型与位置"的可读错误（spec 场景）；未发布无需迁移。
- [常驻骨架随属性编辑即时刷新：订阅开销] → 每个任务卡片只订阅自身数据与入/出边事件，规模内可忽略。

## Open Questions

- 节点内子画布（双击展开绘制）的启动时机与交互（v2）。
- 大图（明显超过数十任务节点）的性能策略延后评估。
