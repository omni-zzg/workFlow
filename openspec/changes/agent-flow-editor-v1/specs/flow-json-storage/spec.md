# Spec Delta

## Purpose

定义流程图的唯一持久化格式（版本化 JSON）并负责其进出：导出为可移植的 JSON 文件、导入时严格校验并完整还原，保证数据在会话之间与工具之间可靠流转。

## ADDED Requirements

### Requirement: 版本化数据格式

持久化 JSON SHALL 含三部分：version（版本号）、meta（名称、描述等元信息）、nodes 与 edges（图数据）；导入时若 version 为不支持的主版本，系统 SHALL 拒绝导入并说明原因。

#### Scenario: 拒绝不支持的版本

- **WHEN** 用户导入 version=99 的 JSON
- **THEN** 系统拒绝导入并提示"不支持的版本 99"，当前画布不受影响

### Requirement: 节点数据模型

节点 SHALL 以 {id, type, position:{x,y}, data} 持久化；data 按节点类型区分——start 存 goal，thought/observation 存 content，action 存 tool（name 与 params），decision 存可选 criteria，final 存 answer。节点尺寸 SHALL NOT 持久化，由画布按内容自适应。

#### Scenario: 节点字段按类型保存

- **WHEN** 导出包含六类节点的流程图
- **THEN** 各节点 data 仅包含其类型对应的字段

### Requirement: 边与退出条件数据模型

边 SHALL 以 {id, source, target, kind} 持久化；kind 为 sequence、loop、exit 之一；exit 边 SHALL 携带 data.condition，其取值为类型化条件之一：goal_achieved、max_iterations{max}、timeout{seconds}、budget{tokens}、error、human_interrupt、custom{text}。

#### Scenario: 退出边携带类型化条件

- **WHEN** 导出含 max_iterations(max=8) 退出边的流程图
- **THEN** 该边序列化为 {"kind":"exit","data":{"condition":{"type":"max_iterations","params":{"max":8}}}}

### Requirement: 序列化往返一致性

同一流程图经"导出 → 导入 → 再导出"SHALL 得到语义等价的 JSON：节点、边、字段与条件无丢失、无篡改。

#### Scenario: 多循环流程往返

- **WHEN** 对一份含两个循环、多条 exit 边与 custom 条件的流程图执行导出、再导入、再导出
- **THEN** 两次导出的 JSON 语义等价

### Requirement: 导出为 JSON 文件

导出 SHALL 生成符合上述数据模型的 JSON 文件供下载；当当前流程存在 error 级校验问题，导出前 SHALL 提示问题数量并请求确认，用户确认后仍可导出。

#### Scenario: 带问题导出

- **WHEN** 当前流程存在 1 个 error 级校验问题，用户点击导出
- **THEN** 系统提示"存在 1 个问题，仍要导出？"，用户确认后完成导出

### Requirement: 导入校验与错误报告

导入 SHALL 先做结构校验；结构非法（JSON 解析失败、缺必需字段、未知节点类型、未知条件类型等）SHALL 给出可读错误（原因与位置），且 SHALL NOT 修改当前画布；校验通过 SHALL 完整还原图（含节点位置、边 kind 与退出条件）。

#### Scenario: 非法 JSON 被拒绝

- **WHEN** 用户导入一段语法错误的 JSON 文本
- **THEN** 系统提示解析失败原因，画布保持原样

#### Scenario: 合法文件完整还原

- **WHEN** 用户导入一份合法流程图文件
- **THEN** 画布完整还原该图，节点位置、边类型与退出条件与文件一致

### Requirement: 校验结果不持久化

持久化 JSON SHALL NOT 包含校验结果、回放状态或任何派生数据；这些数据始终由当前图实时推导。

#### Scenario: 导出文件不含派生数据

- **WHEN** 导出存在 warning 问题的流程图
- **THEN** 导出 JSON 中不存在任何校验问题字段
