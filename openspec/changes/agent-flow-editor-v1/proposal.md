# Proposal

## Why

通用流程图工具（draw.io、ProcessOn 等）只能表达普通流程，无法表达 Agent 的推理循环（ReAct）与循环退出条件：画出的 Agent 流程图是"哑图"——没有目标声明、没有思考步骤、循环没有显式退出条件，死循环风险不可见。本项目提供一个专门面向 Agent 工作流的可视化编辑器：节点与连线内建 ReAct 语义，流程图以结构化 JSON 持久化；趁 schema 未定型的窗口期先固化 v1 规划。

## What Changes

- 新建 Vue 3 + AntV X6 前端应用（Vite + TypeScript + pnpm + Vitest），提供流程图编辑画布
- 六类 Agent 节点：`start` / `thought` / `action` / `observation` / `decision` / `final`，按类型差异化视觉渲染与属性表单
- 三类连线：`sequence`（顺序）/ `loop`（回边）/ `exit`（退出边）；exit 边 MUST 携带**类型化退出条件**（`goal_achieved` / `max_iterations` / `timeout` / `budget` / `error` / `human_interrupt` / `custom`）
- 自定义 JSON 数据模型（`version` / `meta` / `nodes` / `edges`，`data` 按节点类型判别），与 X6 内部格式双向解耦
- JSON 导入/导出：导入时合法性校验与错误报告；导出遇 error 级问题时弹确认
- ReAct 校验器：基于 SCC 的死循环检测、必备要素检查、问题分级（error / warning）、问题面板与画布角标
- ReAct 模板一键插入（start → thought → action → observation → decision → final 骨架）
- 同步更新 `AGENTS.md`「数据模型」等章节

**明确不做（v1 范围外）**：流程图回放/假执行（既定 v2 方向，另立变更）、AI 生成流程图、导出可执行代码、多人协作、后端存储。

## Capabilities

### New Capabilities

- `flow-canvas-editing`: 画布编辑——节点/边的创建、连线、拖拽、选择、删除、撤销重做、调色板与 ReAct 模板、六类节点与三类边的视觉呈现
- `flow-property-editing`: 属性编辑——按节点类型渲染差异化表单（goal / content / tool / answer 等），exit 边退出条件的类型化编辑，编辑纳入撤销重做
- `flow-json-storage`: JSON 数据模型与导入导出——version 化 schema、类型化退出条件、导入合法性校验与错误报告、导出确认、序列化往返一致性
- `flow-validation`: ReAct 校验与提示——死循环（SCC）检测、ReAct 必备要素检查、问题分级（error / warning）、问题面板与画布角标、编辑期实时校验

### Modified Capabilities

（无——项目尚无既有 spec）

## Impact

- 新建整个应用代码：`src/graph/`（X6 封装）、`src/schema/`（数据模型与转换）、`src/components/`（Vue 组件）、`src/stores/`（状态）
- 新增依赖：`vue@3`、`@antv/x6`、`@antv/x6-vue-shape`、X6 插件（selection / snapline / keyboard / history / clipboard）、`vite`、`typescript`、`vitest`
- 文档：`AGENTS.md`「核心领域概念」「数据模型」章节随 schema 定稿同步更新
- 项目基建：当前目录尚未 `git init`，需初始化并配置 `.gitignore`（AGENTS.md 要求每次改动提交）
- 纯浏览器应用，无后端依赖；v1 文件流转走本地文件下载/上传
