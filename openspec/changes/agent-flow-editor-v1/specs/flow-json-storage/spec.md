# Spec Delta

## Purpose

定义任务流的唯一持久化格式（版本化 JSON）并负责其进出：导出为可移植 JSON 文件、导入时严格校验并完整还原，保证"任务流 + 节点内 ReAct"的数据在会话之间与工具之间可靠流转。

## ADDED Requirements

### Requirement: 版本化数据格式

持久化 JSON SHALL 含三部分：version（版本号）、meta（名称、描述等元信息）、nodes 与 edges（图数据）；导入时若 version 为不支持的主版本，系统 SHALL 拒绝导入并说明原因。

#### Scenario: 拒绝不支持的版本

- **WHEN** 用户导入 version=99 的 JSON
- **THEN** 系统拒绝导入并提示"不支持的版本 99"，当前画布不受影响

### Requirement: 任务节点数据模型

节点 SHALL 以 {id, type, position:{x,y}, data} 持久化；data 按类型区分：start 存 goal；final 存 answer；task 存完整 ReAct 单元——name、goal、input、steps（{id, thought, actions:[{name, params}], observation} 的数组，至少一步）、loop.exitConditions（类型化条件数组）、precondition、onFailure（reflection、replan、maxRetries）。

#### Scenario: 任务节点含完整 ReAct 结构

- **WHEN** 导出含一个任务节点的任务流
- **THEN** 该节点 data 包含 name、goal、input、steps、loop、precondition、onFailure 全部字段

#### Scenario: 步骤保留动作与参数

- **WHEN** 某步骤包含两个带参数的动作
- **THEN** 序列化后 actions 数组完整保留动作名与参数对象

### Requirement: 边与条件数据模型

边 SHALL 以 {id, source, target, kind, data} 持久化；kind 为 success、failure 之一；两类边的 data.condition 均为类型化条件（七类之一）或 null——success 边在正式流程中必填（start 出边豁免，草稿态允许 null 并由校验标记），failure 边可选。

#### Scenario: 成功边携带前提条件

- **WHEN** 导出含 goal_achieved 前提条件的 success 边
- **THEN** 该边序列化为 {"kind":"success","data":{"condition":{"type":"goal_achieved"}}}

#### Scenario: 失败边条件可空

- **WHEN** 一条 failure 边未设置条件
- **THEN** 序列化为 {"kind":"failure","data":{"condition":null}}，且结构合法

### Requirement: 序列化往返一致性

同一任务流经"导出 → 导入 → 再导出"SHALL 得到语义等价的 JSON：节点、边、步骤、退出条件与异常处理字段无丢失、无篡改。

#### Scenario: 复杂任务流往返

- **WHEN** 对一份含多个任务、多步骤、多退出条件、failure 边与 custom 条件的数据执行导出、再导入、再导出
- **THEN** 两次导出的 JSON 语义等价

### Requirement: 导出为 JSON 文件

导出 SHALL 生成符合上述数据模型的 JSON 文件供下载；当当前流程存在 error 级校验问题，导出前 SHALL 提示问题数量并请求确认，用户确认后仍可导出。

#### Scenario: 带问题导出

- **WHEN** 当前流程存在 1 个 error 级校验问题，用户点击导出
- **THEN** 系统提示"存在 1 个问题，仍要导出？"，用户确认后完成导出

### Requirement: 导入校验与错误报告

导入 SHALL 先做结构校验；结构非法（JSON 解析失败、缺必需字段、未知节点类型、未知边类型、未知条件类型等）SHALL 给出可读错误（原因与位置），且 SHALL NOT 修改当前画布；校验通过 SHALL 完整还原图（含节点位置、步骤、退出条件与边类型）。

#### Scenario: 非法 JSON 被拒绝

- **WHEN** 用户导入一段语法错误的 JSON 文本
- **THEN** 系统提示解析失败原因，画布保持原样

#### Scenario: 未知节点类型被拒绝

- **WHEN** 用户导入含 type="thought"（旧模型）的 JSON
- **THEN** 系统提示未知的节点类型与位置，画布保持原样

#### Scenario: 合法文件完整还原

- **WHEN** 用户导入一份合法任务流文件
- **THEN** 画布完整还原该任务流，节点位置、步骤、退出条件与边类型与文件一致

### Requirement: 校验结果不持久化

持久化 JSON SHALL NOT 包含校验结果、回放状态或任何派生数据；这些数据始终由当前图实时推导。

#### Scenario: 导出文件不含派生数据

- **WHEN** 导出存在 warning 问题的任务流
- **THEN** 导出 JSON 中不存在任何校验问题字段
