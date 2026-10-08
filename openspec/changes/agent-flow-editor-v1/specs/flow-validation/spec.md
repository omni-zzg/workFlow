# Spec Delta

## Purpose

持续校验任务流——逐节点检查"每个任务是否是一个完整的 ReAct 单元"（输入/步骤/循环退出条件/前提条件/反思与重规划），并检查顶层任务流完整性（开始、结束、可达性与失败回退环的出口），把问题分级呈现在画布与问题面板，使循环退出条件与失败处置从隐含假设变成可见、可检验的结构。

## ADDED Requirements

### Requirement: 实时与手动校验

画布内容变化后系统 SHALL 自动重新校验（短防抖，不阻断操作），并 SHALL 提供手动校验入口；校验 SHALL NOT 修改任务流数据；空画布 SHALL 不产生任何问题。

#### Scenario: 编辑触发校验

- **WHEN** 用户清空某任务的全部循环退出条件
- **THEN** 问题面板在短暂防抖后出现对应的 error 问题

#### Scenario: 空画布无问题

- **WHEN** 画布上没有任何节点
- **THEN** 校验结果为空，问题面板显示"暂无问题"

### Requirement: 任务标识检查（E1）

任务节点 SHALL 具有非空的任务名与目标，否则报 error 并定位到该节点。

#### Scenario: 任务名为空

- **WHEN** 某任务节点没有填写任务名
- **THEN** 报 error"任务缺少名称或目标"并定位到该任务节点

### Requirement: 步骤序列检查（E2 / W1）

任务 SHALL 包含至少一个步骤（一组思考-行动-观察），步骤序列为空时 SHALL 报 error；某个步骤的思考、行动、观察存在缺项时 SHALL 报 warning。

#### Scenario: 任务没有步骤

- **WHEN** 某任务节点的步骤序列为空
- **THEN** 报 error"任务没有步骤：至少需要一组思考-行动-观察"

#### Scenario: 步骤不完整

- **WHEN** 某步骤填写了思考与观察，但没有行动
- **THEN** 报 warning"步骤不完整：思考/行动/观察存在缺项"

### Requirement: 循环退出条件检查（E3 / W2）

任务 SHALL 至少声明一条循环退出条件，否则报 error；全部退出条件均属异常/人工/自定义类型（无 goal_achieved、max_iterations、timeout、budget 之一）时 SHALL 报 warning。

#### Scenario: 缺少循环退出条件

- **WHEN** 某任务未声明任何循环退出条件
- **THEN** 报 error"任务缺少循环退出条件"并定位到该任务节点

#### Scenario: 仅有异常退出

- **WHEN** 某任务的退出条件仅有 error
- **THEN** 报 warning"循环仅有异常/人工退出，建议补充可控退出条件"

### Requirement: 前提条件检查（E4 / E5）

存在 success 出边的任务节点 SHALL 声明非空的前提条件，否则报 error；success 边（source 不是 start）SHALL 携带非空条件，否则报 error 并定位到该边。

#### Scenario: 任务缺少前提条件

- **WHEN** 某任务有 success 出边但没有填写前提条件
- **THEN** 报 error"任务有成功出边但缺少前提条件"

#### Scenario: 成功边缺少条件

- **WHEN** 一条 success 边（source 非 start）没有条件
- **THEN** 报 error"success 边缺少前提条件（开始节点的出边除外）"并定位到该边

### Requirement: 开始与终止检查（E6 / E7 / W7）

任务流 SHALL 有且建议仅有一个 start 节点且其 goal 非空，否则报 error；存在多个 start 节点 SHALL 报 warning；从 start SHALL 存在到达某个 final 的路径，否则报 error。

#### Scenario: 缺少开始

- **WHEN** 任务流没有 start 节点
- **THEN** 报 error"缺少开始节点与全局目标"

#### Scenario: 无法到达终点

- **WHEN** 所有 final 节点均从 start 不可达
- **THEN** 报 error"没有从开始到结束的路径"

#### Scenario: 多个开始节点

- **WHEN** 任务流存在两个 start 节点
- **THEN** 报 warning"存在多个开始节点"

### Requirement: 失败回退环检查（E8）

由失败回退等边构成的循环（有向环）SHALL 至少有一条离开该环的 success 边（能正常退出），否则报 error 并定位到环内节点。

#### Scenario: 失败回退环没有成功出口

- **WHEN** 两个任务之间只有 failure 边构成环，没有任何离开该环的 success 边
- **THEN** 报 error"死循环风险：失败回退形成的环没有成功出口"并定位到环内节点

#### Scenario: 补充成功出口后消失

- **WHEN** 为该环补一条指向环节点之外（最终可达 final）的 success 边
- **THEN** 该 error 消失

### Requirement: 异常处理检查（W3 / W4）

任务的异常处理中反思或重规划为空 SHALL 报 warning；任务存在 success 出边但没有 failure 出边 SHALL 报 warning（建议声明失败出口）。

#### Scenario: 反思为空

- **WHEN** 某任务填写了重规划但没有反思内容
- **THEN** 报 warning"任务缺少失败反思或重规划"

#### Scenario: 未声明失败出口

- **WHEN** 某任务只有 success 出边，没有 failure 出边
- **THEN** 报 warning"任务未声明失败出口"

### Requirement: 连通性检查（W5 / W6）

从 start 不可达的节点 SHALL 报 warning；非 final 节点没有任何出边（流程中断）SHALL 报 warning。

#### Scenario: 孤立节点

- **WHEN** 画布上存在一个没有任何连线的任务节点
- **THEN** 报 warning"节点从开始节点不可达"

#### Scenario: 流程中断

- **WHEN** 某任务没有任何出边且它不是最终的承接方
- **THEN** 报 warning"任务没有出边，流程在此中断"

### Requirement: 问题呈现与定位

校验问题 SHALL 以"级别 + 描述"列表呈现于问题面板，并在画布上以节点/边角标提示；点击问题 SHALL 选中并高亮定位到相关节点或边。

#### Scenario: 点击问题定位

- **WHEN** 用户点击问题面板中"任务缺少循环退出条件"的条目
- **THEN** 画布选中该任务节点并高亮，必要时调整视口使其可见

#### Scenario: 画布角标

- **WHEN** 某节点被任意 error 级问题命中
- **THEN** 该节点显示 error 级角标
