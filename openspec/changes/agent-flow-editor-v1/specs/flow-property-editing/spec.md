# Spec Delta

## Purpose

让用户通过属性面板把每个任务节点定义成一个完整的 ReAct 单元：任务名与目标、输入、多步「思考/行动/观察」序列、循环退出条件、进入下一任务的前提条件、失败反思与重规划；内容以人工填写的自由文本与简单参数为主，系统不做语义规范化。

## ADDED Requirements

### Requirement: 面板随选中项切换

系统 SHALL 在选中单个节点或边时于属性面板展示对应类型的编辑表单；未选中或选中多个对象时 SHALL 展示空态提示。

#### Scenario: 选中任务节点显示表单

- **WHEN** 用户选中一个任务节点
- **THEN** 属性面板展示任务名、目标、输入、步骤、循环退出条件、前提条件与异常处理字段

#### Scenario: 未选中时的空态

- **WHEN** 画布上没有选中任何对象
- **THEN** 属性面板显示空态提示，不展示任何字段

### Requirement: 任务基础字段

属性面板 SHALL 为任务节点提供字段：任务名（必填）、目标（必填）、输入（描述从哪来/是什么）、前提条件（进入下一任务的判断依据）。必填字段为空时 SHALL 在字段旁标注。

#### Scenario: 必填标注

- **WHEN** 用户选中一个任务节点
- **THEN** 任务名与目标字段旁显示必填标注

#### Scenario: 编辑任务名

- **WHEN** 用户在任务名输入"查询天气"
- **THEN** 节点数据与卡片标题同步更新

### Requirement: 步骤序列编辑

属性面板 SHALL 提供多步「思考/行动/观察」序列编辑器：支持添加与删除步骤、调整步骤顺序（上移/下移）；每个步骤含思考（多行文本）、行动（一个或多个"名称 + 键值参数"的动作，可增删）、观察（多行文本）。

#### Scenario: 添加步骤

- **WHEN** 用户点击"添加步骤"并填写思考、行动与观察
- **THEN** 该步骤被追加到任务步骤序列末尾

#### Scenario: 删除步骤

- **WHEN** 用户删除序列中的某个步骤
- **THEN** 该步骤从数据中移除，其余步骤保持原有顺序

#### Scenario: 步骤含多个行动

- **WHEN** 用户在一个步骤内添加两个动作（如 get_weather 与 validate_fields）
- **THEN** 该步骤的 actions 保存为两个动作对象

### Requirement: 循环退出条件编辑

属性面板 SHALL 以"条件类型选择器 + 参数输入"方式编辑任务的循环退出条件列表：支持添加与删除条件；七类条件（goal_achieved、max_iterations、timeout、budget、error、human_interrupt、custom）可选，带参数类型提供对应数值输入（max / seconds / tokens），custom 提供自由文本。

#### Scenario: 添加最大迭代条件

- **WHEN** 用户在退出条件列表中添加 max_iterations 并输入 max=5
- **THEN** 任务数据中新增 {type: max_iterations, params: {max: 5}}，卡片上出现"max=5"徽标

#### Scenario: 删除全部条件

- **WHEN** 用户删除任务的全部退出条件
- **THEN** 任务数据退出条件为空，校验将其标记为"缺少循环退出条件"

### Requirement: 异常处理编辑

属性面板 SHALL 提供异常处理字段：反思（出问题时如何分析，多行文本）、重规划（如何调整，多行文本）、重试上限（数值）。

#### Scenario: 填写反思与重规划

- **WHEN** 用户填写反思"分析失败原因：网络？城市名？"与重规划"修正城市名或改用备用数据源"，重试上限 3
- **THEN** 三者在任务数据中保存，卡片失败摘要显示"失败重试 ≤3"

### Requirement: 连线编辑

面板 SHALL 允许编辑选中边的类型（kind：success / failure）；success 边 SHALL 提供前提条件编辑器（类型化，与循环退出条件相同的选择器与参数输入），failure 边 SHALL 提供可选的条件编辑器。

#### Scenario: 为成功转移设置前提条件

- **WHEN** 用户把某 success 边的条件设为 goal_achieved
- **THEN** 该边条件保存并显示在边标签上

#### Scenario: 改为异常边

- **WHEN** 用户把一条边的 kind 从 success 改为 failure
- **THEN** 该边立即以异常样式呈现，条件编辑器变为可选

### Requirement: 自由文本与参数编辑

思考、观察、输入、前提条件、反思、重规划及 custom 条件文本 SHALL 接受任意多行文本并原样保存；行动参数 SHALL 以键值对编辑并序列化为 JSON 对象，系统 SHALL NOT 对内容做语义校验或规范化。

#### Scenario: 多行文本原样保存

- **WHEN** 用户在多行字段中输入包含换行的文本
- **THEN** 文本原样保存并在卡片上原样呈现

#### Scenario: 添加行动参数

- **WHEN** 用户为动作 get_weather 添加参数 city=北京
- **THEN** 该动作 params 更新为 {"city": "北京"}

### Requirement: 编辑即时生效并纳入撤销

属性修改 SHALL 立即反映到画布呈现（卡片骨架、退出条件徽标、边标签等），并 SHALL 纳入撤销/重做。

#### Scenario: 修改即时呈现

- **WHEN** 用户为任务添加一条 goal_achieved 退出条件
- **THEN** 任务卡片上的退出条件徽标同步更新

#### Scenario: 撤销属性编辑

- **WHEN** 用户修改任务名后执行撤销
- **THEN** 任务名恢复为修改前的内容
