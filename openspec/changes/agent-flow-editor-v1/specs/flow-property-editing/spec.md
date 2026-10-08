# Spec Delta

## Purpose

让用户通过属性面板填写与修改节点/边的领域信息（目标、思考内容、工具调用、退出条件等）；面板按节点类型呈现差异化表单，内容以人工填写的自由文本与简单参数为主，系统不做语义规范化。

## ADDED Requirements

### Requirement: 面板随选中项切换

系统 SHALL 在选中单个节点或边时于属性面板展示对应类型的编辑表单；未选中或选中多个对象时 SHALL 展示空态提示。

#### Scenario: 选中节点显示表单

- **WHEN** 用户选中一个 action 节点
- **THEN** 属性面板展示工具名与工具参数两个字段的编辑表单

#### Scenario: 未选中时的空态

- **WHEN** 画布上没有选中任何对象
- **THEN** 属性面板显示空态提示，不展示任何字段

### Requirement: 节点类型差异化字段

属性面板 SHALL 按节点类型提供字段：start → goal（必填）；thought → content；action → tool.name（必填）与 tool.params；observation → content；decision → criteria（可选）；final → answer。必填字段为空时 SHALL 在字段旁标注。

#### Scenario: 各类型字段正确

- **WHEN** 用户依次选中六类节点
- **THEN** 面板分别展示上述对应字段，且 goal 与 tool.name 被标注为必填

### Requirement: 退出条件类型化编辑

选中 kind=exit 的边时，面板 SHALL 以"条件类型选择器 + 参数输入"方式编辑退出条件；七类条件（goal_achieved、max_iterations、timeout、budget、error、human_interrupt、custom）可选，带参数类型 SHALL 提供对应数值输入（max_iterations→max、timeout→seconds、budget→tokens），custom SHALL 提供自由文本输入。

#### Scenario: 编辑最大迭代次数

- **WHEN** 用户将某 exit 边条件设为 max_iterations 并输入 max=8
- **THEN** 该边条件保存为 {type: max_iterations, params: {max: 8}}，边标签显示"max=8"

#### Scenario: 自定义条件

- **WHEN** 用户选择 custom 条件并输入"连续两次观察到 404"
- **THEN** 该文本被保存为该边的条件内容并显示在边标签上

### Requirement: 边类型（kind）编辑

面板 SHALL 允许修改选中边的 kind；当改为 exit 时 SHALL 立即展示退出条件编辑区。

#### Scenario: 改为退出边

- **WHEN** 用户把一条边从 sequence 改为 exit
- **THEN** 面板立即出现退出条件编辑区，条件未填写前该边被校验标记为"退出条件未填"

### Requirement: 自由文本与参数编辑

thought/observation 的 content、final 的 answer 及 custom 条件文本 SHALL 接受任意多行文本并原样保存；action 的 tool.params SHALL 以键值对列表编辑并序列化为 JSON 对象，系统 SHALL NOT 对内容做语义校验或规范化。

#### Scenario: 多行文本原样保存

- **WHEN** 用户在 thought 的 content 中输入多行推理文本
- **THEN** 文本原样保存并在节点上原样呈现

#### Scenario: 添加工具参数

- **WHEN** 用户为工具 get_weather 添加参数 city=北京
- **THEN** 节点数据中 tool.params 更新为 {"city": "北京"}

### Requirement: 编辑即时生效并纳入撤销

属性修改 SHALL 立即反映到画布呈现（节点文字、条件徽标等），并 SHALL 纳入撤销/重做。

#### Scenario: 修改即时呈现

- **WHEN** 用户将 decision 某条 exit 边的条件改为 goal_achieved
- **THEN** 该 decision 节点上的条件徽标同步更新

#### Scenario: 撤销属性编辑

- **WHEN** 用户修改 final 的 answer 文本后执行撤销
- **THEN** answer 恢复为修改前的内容
