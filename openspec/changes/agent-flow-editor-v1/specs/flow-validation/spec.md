# Spec Delta

## Purpose

以 ReAct 规范持续校验流程图——检测死循环风险、检查必备要素与标注一致性，并把问题分级呈现在画布与问题面板，让"循环退出条件"从隐含假设变成可见、可检验的结构。

## ADDED Requirements

### Requirement: 实时与手动校验

画布内容变化后系统 SHALL 自动重新校验（短防抖，不阻断操作），并 SHALL 提供手动校验入口；校验 SHALL NOT 修改流程图数据；空画布 SHALL 不产生任何问题。

#### Scenario: 编辑触发校验

- **WHEN** 用户删除一条 exit 边，造成某循环失去退出条件
- **THEN** 问题面板在短暂防抖后出现对应的 error 问题

#### Scenario: 空画布无问题

- **WHEN** 画布上没有任何节点
- **THEN** 校验结果为空，问题面板显示"暂无问题"

### Requirement: 目标与入口检查

流程图 SHALL 至少有一个 start 节点且其 goal 非空，否则报 error；存在多个 start 节点 SHALL 报 warning。

#### Scenario: 缺少目标

- **WHEN** 流程图没有 start 节点
- **THEN** 报 error"缺少开始节点与目标声明"

#### Scenario: 多个开始节点

- **WHEN** 流程图存在两个 start 节点
- **THEN** 报 warning"存在多个开始节点"

### Requirement: 死循环检测

每个循环（有向环）SHALL 至少有一条离开该循环且条件非空的 exit 边，否则报 error，并把问题定位到该循环内的节点。

#### Scenario: 检测到无出口循环

- **WHEN** 一个由回边构成的循环没有任何条件非空的 exit 出边
- **THEN** 报 error"死循环风险：该循环没有退出条件"并定位到循环内节点

#### Scenario: 补充退出条件后消失

- **WHEN** 为同一循环新增一条 goal_achieved 的 exit 边
- **THEN** 该 error 消失

### Requirement: 退出条件完整性检查

kind=exit 的边 SHALL 携带非空且合法的 condition，否则报 error 并定位到该边。

#### Scenario: 退出边未填条件

- **WHEN** 一条 exit 边没有任何条件
- **THEN** 报 error"退出边缺少退出条件"并定位到该边

### Requirement: 终止路径检查

从 start 节点 SHALL 存在到达某个 final 节点的路径，否则报 error。

#### Scenario: 无法到达终点

- **WHEN** 所有 final 节点均从 start 不可达
- **THEN** 报 error"没有从开始到结束的路径"

### Requirement: ReAct 三要素检查

流程图 SHALL 包含至少一组 thought → action → observation 的顺序链，否则报 warning。

#### Scenario: 缺少行动环节

- **WHEN** 流程图只有 thought 与 final，没有 action 与 observation
- **THEN** 报 warning"缺少思考-行动-观察链"

### Requirement: 判断点规范检查

每个循环内 SHALL 包含至少一个 decision 节点；exit 边 SHALL 由 decision 发出，违反者报 warning。

#### Scenario: 循环内无判断节点

- **WHEN** 一个循环由 thought → action → observation 回边构成且没有 decision
- **THEN** 报 warning"循环缺少判断节点"

#### Scenario: 退出边不来自判断节点

- **WHEN** 一条 exit 边由 observation 直接发出
- **THEN** 报 warning"退出边建议由判断节点发出"

### Requirement: 可控退出检查

循环的退出条件中 SHALL 至少包含一条可控退出（goal_achieved、max_iterations、timeout、budget 之一）；仅含 error 或 human_interrupt 类退出 SHALL 报 warning。

#### Scenario: 仅异常退出

- **WHEN** 某循环唯一的 exit 条件是 error
- **THEN** 报 warning"该循环仅有异常退出，建议补充目标达成或最大迭代条件"

### Requirement: 连通性检查

从 start 不可达的节点 SHALL 报 warning；无法到达任何 final 的节点 SHALL 报 warning。

#### Scenario: 孤立节点

- **WHEN** 画布上存在一个没有任何连线的 action 节点
- **THEN** 报 warning"节点从开始节点不可达"

#### Scenario: 死路节点

- **WHEN** 某节点走不到任何 final
- **THEN** 报 warning"该节点无法到达结束节点"

### Requirement: 标注一致性检查

边的 kind 标注 SHALL 与拓扑一致：标记 loop 但未构成有向环、或构成有向环却未标记 loop，均报 warning。

#### Scenario: 误标回边

- **WHEN** 用户把一条非回边标记为 loop
- **THEN** 报 warning"该边标记为回边但未构成循环"

### Requirement: 问题呈现与定位

校验问题 SHALL 以"级别 + 描述"列表呈现于问题面板，并在画布上以节点/边角标提示；点击问题 SHALL 选中并高亮定位到相关节点或边。

#### Scenario: 点击问题定位

- **WHEN** 用户点击问题面板中"退出边缺少退出条件"的条目
- **THEN** 画布选中该边并高亮，必要时调整视口使其可见

#### Scenario: 画布角标

- **WHEN** 某节点被任意 error 级问题命中
- **THEN** 该节点显示 error 级角标
