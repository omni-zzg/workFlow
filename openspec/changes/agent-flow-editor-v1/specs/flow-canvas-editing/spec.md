# Spec Delta

## Purpose

提供可视化画布，让用户通过拖拽创建与连线，自由绘制 Agent 工作流流程图，并以差异化视觉呈现六类 ReAct 节点与三类连线，使"思考过程"与"循环退出条件"在图上直接可见。

## ADDED Requirements

### Requirement: 调色板创建节点

系统 SHALL 提供含六类节点（start、thought、action、observation、decision、final）的调色板；用户 SHALL 能通过拖拽或点击在画布上创建节点，新节点创建后进入选中态。

#### Scenario: 拖拽创建

- **WHEN** 用户将调色板中的 thought 拖拽到画布落点
- **THEN** 画布在落点创建一个 thought 节点，内容为空并处于选中态

#### Scenario: 六类节点均可创建

- **WHEN** 用户依次创建六类节点
- **THEN** 六类节点均成功出现在画布上

### Requirement: 节点类型差异化视觉

系统 SHALL 按节点类型呈现可区分的形状与样式（如 thought 虚线边框、action 工具徽标、decision 菱形），使用户无需阅读文字即可辨认节点类型。

#### Scenario: 六类节点互不相同

- **WHEN** 画布上同时存在六类节点
- **THEN** 各类型节点的形状、边框或配色互不相同

### Requirement: 判断节点展示退出条件徽标

decision 节点 SHALL 在节点内展示其全部 exit 出边的条件摘要（条件类型名与关键参数，如"目标达成"、"max=8"）。

#### Scenario: 展示多条条件

- **WHEN** 某 decision 节点有两条 exit 出边，条件分别为 goal_achieved 与 max_iterations(max=8)
- **THEN** 节点内并排显示"目标达成"与"max=8"两个条件徽标

#### Scenario: 无退出条件时的占位

- **WHEN** decision 节点没有任何 exit 出边
- **THEN** 节点内显示"未定义退出条件"的提示样式

### Requirement: 拖拽连线与默认类型

用户 SHALL 能从节点的连接点拖拽创建连线；新连线默认 kind 为 sequence。

#### Scenario: 创建顺序连线

- **WHEN** 用户从 thought 的连接点拖拽到下方的 action 节点
- **THEN** 创建一条 kind=sequence 的连线

### Requirement: 回边自动识别

当新连线指向源节点的上游祖先（构成有向环）时，系统 SHALL 自动将其识别为 kind=loop 并呈现回边样式（虚线，区别于顺序边）；用户 SHALL 能手动修改任意边的 kind。

#### Scenario: 自动识别回边

- **WHEN** 用户从 decision 拖拽连到其上游的 thought
- **THEN** 新边被标记为 loop，并以虚线回边样式呈现

#### Scenario: 手动修改边类型

- **WHEN** 用户在属性面板把一条 sequence 边改为 loop
- **THEN** 该边立即以回边样式呈现

### Requirement: 连线合法性约束

系统 SHALL 阻止创建重复连线（相同 source 与 target），并给出提示。

#### Scenario: 阻止重复连线

- **WHEN** 用户尝试在已存在连线的两个节点之间再次连线
- **THEN** 系统拒绝创建并提示已存在连线

### Requirement: 选择、移动与删除

用户 SHALL 能选中（含框选）并拖动节点；删除节点时其关联连线 SHALL 一并删除；用户 SHALL 能用键盘快捷方式删除选中内容。

#### Scenario: 删除节点连带删除边

- **WHEN** 用户删除一个存在入边与出边的节点
- **THEN** 该节点与其全部关联连线被一并删除

### Requirement: 撤销与重做

系统 SHALL 支持撤销与重做，覆盖节点创建/移动/删除、连线创建/删除及属性修改；导入后撤销栈 SHALL 被清空，不混入导入前的历史。

#### Scenario: 撤销删除

- **WHEN** 用户删除一个节点后执行撤销
- **THEN** 该节点与其关联连线恢复原状

#### Scenario: 导入后历史清理

- **WHEN** 用户导入一份新流程图
- **THEN** 撤销栈被清空，无法撤销回导入前的图

### Requirement: 画布导航与对齐辅助

用户 SHALL 能缩放、平移画布并使用"适应画布"；拖动节点时 SHALL 提供对齐辅助线。

#### Scenario: 对齐辅助线

- **WHEN** 用户拖动节点靠近与其他节点的水平或垂直对齐位置
- **THEN** 显示对齐辅助线并吸附对齐

### Requirement: ReAct 模板一键插入

系统 SHALL 提供 ReAct 骨架模板（start → thought → action → observation → decision → final，含一条 loop 回边与一条 goal_achieved 的 exit 边），用户 SHALL 能一键插入画布。

#### Scenario: 插入模板

- **WHEN** 用户在画布点击"插入 ReAct 模板"
- **THEN** 画布出现完整骨架：六个节点、五条顺序边、一条回边与一条标注 goal_achieved 的退出边

### Requirement: 空画布引导

画布无任何节点时 SHALL 显示引导提示（从调色板拖拽节点，或插入 ReAct 模板）。

#### Scenario: 空态提示

- **WHEN** 画布上没有任何节点
- **THEN** 显示引导文字与模板插入入口
