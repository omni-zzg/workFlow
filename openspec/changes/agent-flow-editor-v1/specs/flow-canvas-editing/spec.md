# Spec Delta

## Purpose

提供任务流画布：以开始/任务/结束三类节点与 success/failure 两类连线组织 Agent 工作流；任务卡片常驻 ReAct 骨架摘要，使"输入、步骤、循环退出条件、进入下一任务的前提条件"在画布上一眼可见。

## ADDED Requirements

### Requirement: 调色板创建节点

系统 SHALL 提供含三类节点（start、task、final）的调色板；用户 SHALL 能通过拖拽或点击在画布上创建节点，新节点创建后进入选中态。

#### Scenario: 拖拽创建任务节点

- **WHEN** 用户将调色板中的 task 拖拽到画布落点
- **THEN** 画布在落点创建一个任务节点，内容为空并处于选中态

#### Scenario: 三类节点均可创建

- **WHEN** 用户依次创建 start、task、final 节点
- **THEN** 三类节点均成功出现在画布上

### Requirement: 节点类型差异化视觉

系统 SHALL 按节点类型呈现可区分的视觉：start 与 final 为胶囊形（区分配色），task 为任务卡片。

#### Scenario: 类型可辨认

- **WHEN** 画布上同时存在三类节点
- **THEN** 开始/结束为胶囊形状，任务为卡片形状，配色互不相同

### Requirement: 任务卡片常驻 ReAct 骨架

任务卡片 SHALL 常驻展示本任务的 ReAct 骨架摘要：任务名、输入、步骤摘要（展示前若干步；步骤数超出时给出"共 N 步"）、循环退出条件徽标、前提条件、失败处理摘要（如"失败重试 ≤3"）。

#### Scenario: 骨架摘要完整展示

- **WHEN** 任务包含 2 个步骤、退出条件（目标达成、max=5）、前提条件与最大重试 3 次
- **THEN** 卡片上同时可见：输入、步骤摘要、两个退出条件徽标、前提条件、"失败重试 ≤3"

#### Scenario: 空任务的占位

- **WHEN** 任务尚未填写步骤与退出条件
- **THEN** 卡片对应区域显示"未定义退出条件"等占位样式，而非空白

### Requirement: 连线创建与默认类型

用户 SHALL 能从节点的连接点拖拽创建连线；新连线默认 kind 为 `success`。

#### Scenario: 创建成功转移连线

- **WHEN** 用户从任务节点拖拽连到下一个节点
- **THEN** 创建一条 kind=success 的连线

### Requirement: 回边自动识别为异常路径

当新连线指向源节点的上游祖先（构成有向环）时，系统 SHALL 自动将其识别为 kind=`failure`（重试/回退路径）并呈现异常样式；用户 SHALL 能手动修改任意边的 kind。

#### Scenario: 自动识别失败回退边

- **WHEN** 用户从任务节点拖拽连到其上游的节点
- **THEN** 新边被标记为 failure，并以异常样式呈现（虚线、区分于 success）

#### Scenario: 手动修改边类型

- **WHEN** 用户在属性面板把一条 success 边改为 failure
- **THEN** 该边立即以异常样式呈现

### Requirement: 连线合法性约束

系统 SHALL 阻止创建重复连线（相同 source、target 与 kind）；满足"相同端点、不同 kind"（如同时存在 success 与 failure）SHALL 允许。

#### Scenario: 阻止完全重复的连线

- **WHEN** 用户尝试在已存在 success 连线的两个节点之间再连一条 success 线
- **THEN** 系统拒绝创建并提示已存在连线

#### Scenario: 同向不同 kind 允许

- **WHEN** 两个节点之间已有一条 success 边，用户再创建一条 failure 边
- **THEN** 创建成功

### Requirement: 选择、移动与删除

用户 SHALL 能选中（含框选）并拖动节点；删除节点时其关联连线 SHALL 一并删除；用户 SHALL 能用键盘快捷方式删除选中内容。

#### Scenario: 删除节点连带删除边

- **WHEN** 用户删除一个存在入边与出边的任务节点
- **THEN** 该节点与其全部关联连线被一并删除

### Requirement: 撤销与重做

系统 SHALL 支持撤销与重做，覆盖节点创建/移动/删除、连线创建/删除及属性修改；导入后撤销栈 SHALL 被清空，不混入导入前的历史。

#### Scenario: 撤销删除

- **WHEN** 用户删除一个任务节点后执行撤销
- **THEN** 该节点与其关联连线恢复原状

#### Scenario: 导入后历史清理

- **WHEN** 用户导入一份新任务流
- **THEN** 撤销栈被清空，无法撤销回导入前的图

### Requirement: 画布导航与对齐辅助

用户 SHALL 能缩放、平移画布并使用"适应画布"；拖动节点时 SHALL 提供对齐辅助线。

#### Scenario: 对齐辅助线

- **WHEN** 用户拖动节点靠近与其他节点的水平或垂直对齐位置
- **THEN** 显示对齐辅助线并吸附对齐

### Requirement: 任务流模板一键插入

系统 SHALL 提供任务流骨架模板：start → task（预填示例步骤、退出条件、前提条件与异常处理）→ final，并含一条 task 指向 final 的 failure 边（超限退出示例）；用户 SHALL 能一键插入画布。

#### Scenario: 插入模板

- **WHEN** 用户在画布点击"插入任务流模板"
- **THEN** 画布出现完整骨架：三个节点、两条 success 边与一条 failure 边

### Requirement: 空画布引导

画布无任何节点时 SHALL 显示引导提示（从调色板拖拽节点，或插入任务流模板）。

#### Scenario: 空态提示

- **WHEN** 画布上没有任何节点
- **THEN** 显示引导文字与模板插入入口
