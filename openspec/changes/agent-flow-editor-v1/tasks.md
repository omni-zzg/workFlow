# Tasks

## 1. 项目脚手架与基建

- [x] 1.1 `git init` 并创建 `.gitignore`（node_modules、dist、.env 等），验证：`git status` 不显示 node_modules/dist，且 .env 被忽略
- [x] 1.2 用 Vite 初始化 Vue 3 + TypeScript 项目并安装依赖（design D14 清单：X6 及插件、zod、vitest），验证：`pnpm install` 成功、`pnpm dev` 能启动页面
- [x] 1.3 配置 Vitest 并接入 `pnpm test`，验证：`pnpm test` 运行通过（含一个示例测试）
- [x] 1.4 确认 package.json scripts 与 AGENTS.md「命令」章节一致，完成首次 git commit，验证：`git log --oneline` 有提交记录

## 2. 数据模型（schema/）

- [x] 2.1 定义 TS 类型与 zod schema：六类节点判别联合 data、三类边、七类退出条件、version/meta 结构（design D4/D5），验证：`pnpm build` 类型检查通过
- [x] 2.2 实现 `graphToSchema`（纯投影）与 `schemaToCells`（FlowSchema → 节点/边描述），验证：单测覆盖"导出→导入→再导出"语义等价，含多循环与 custom 条件
- [x] 2.3 编写导入校验单测：语法错误、缺必需字段、未知节点类型、未知条件类型、不支持版本，验证：各返回带路径的可读错误
- [x] 2.4 更新 AGENTS.md「数据模型」章节与 schema 定稿一致，验证：文档字段与类型定义逐一对应

## 3. 图算法（analysis/）

- [x] 3.1 实现 Tarjan SCC 循环识别（含自环），验证：单测覆盖单循环/多循环/嵌套环/自环/无环
- [x] 3.2 实现可达性（从 start、到 final）、祖先判断 `isAncestor`、后继查询，验证：单测覆盖连通/孤立/死路/回边场景

## 4. 校验规则（validation/）

- [x] 4.1 定义 Issue 模型与规则注册表（severity/ruleId/message/cellIds），验证：空图返回空列表的单测
- [x] 4.2 实现 error 级规则（目标与入口、死循环、终止路径、退出条件完整性），验证：对照 specs/flow-validation 每规则正反例单测
- [x] 4.3 实现 warning 级规则（三要素、判断点规范、可控退出、连通性、标注一致性、多 start），验证：对照 specs/flow-validation 每规则正反例单测

## 5. 图封装与基础设施（graph/、stores/）

- [x] 5.1 Graph 实例封装（创建/销毁、selection/snapline/history/keyboard/clipboard/dnd 插件、导航交互），验证：`pnpm dev` 手动确认画布可缩放/平移、卸载时 dispose 无报错
- [ ] 5.2 统一 `mutate(fn)` 修改包装（batch + history、栈深上限、导入后清史），验证：手动确认一次程序化修改可被撤销
- [x] 5.3 实现 `setCellState/clearCellStates` 态标注接口（design D10），验证：dev 环境以临时入口调用，节点/边出现高亮态样式并能清除
- [x] 5.4 轻量状态（useGraph/useSelection/useDocument 脏标记）（design D6），验证：选中变化时状态同步（临时展示确认），无第二份图数据

## 6. 节点与边视觉（graph/nodes/、调色板）

- [x] 6.1 六个节点 Vue SFC 与 shape 注册（按 design D12 视觉语言），验证：dev 环境中六类节点形状/边框/配色互不相同
- [x] 6.2 decision 条件徽标（展示全部 exit 条件摘要；无则占位"未定义退出条件"），验证：手动造两条 exit 边观察徽标，移除后出现占位（对照 specs/flow-canvas-editing）
- [x] 6.3 三类边样式与标签（loop 虚线弯曲、exit 条件摘要标签），验证：手动观察三类边样式可区分
- [x] 6.4 调色板与拖拽创建，验证：从调色板拖入六类节点均创建成功并进入选中态

## 7. 画布交互

- [x] 7.1 连线创建、kind 自动推断（isAncestor → loop）、重复连线阻止，验证：从 decision 连回 thought 得到虚线回边；重复连线被拒绝并提示（spec 场景）
- [x] 7.2 选择/框选/移动/键盘删除（删节点连带删边）、对齐辅助线、适应画布，验证：按 spec 场景手动验收
- [x] 7.3 ReAct 模板插入与空画布引导，验证：模板常量单测断言其含六节点、四条顺序边、一条 loop、一条 goal_achieved exit；空画布显示引导（spec 场景）
- [x] 7.4 撤销/重做接线全部画布操作，验证：撤销删除恢复节点与关联边（spec 场景）

## 8. 属性面板（components/）

- [x] 8.1 面板骨架、选中联动与空态，验证：选中节点/边面板切换表单，未选中显示空态（spec 场景）
- [x] 8.2 六类节点差异化字段表单（必填标注、多行文本、键值对参数编辑），验证：按 spec「节点类型差异化字段」「自由文本与参数编辑」手动验收
- [x] 8.3 exit 边条件类型化编辑与边 kind 编辑，验证：设置 max_iterations(max=8) 后边标签显示"max=8"，decision 徽标同步更新（spec 场景）
- [x] 8.4 属性修改经 mutate 包装并即时生效，验证：修改 answer 后撤销恢复原内容（spec 场景）

## 9. 校验集成与问题面板

- [ ] 9.1 useValidation：graph 变化 → 防抖全量校验 → 问题列表（空图短路），验证：删除一条 exit 边后短延迟内出现 error（spec 场景）
- [ ] 9.2 问题面板 UI（级别+描述、空态"暂无问题"）与点击定位（选中高亮、必要时调整视口），验证：点击问题定位到对应边并高亮（spec 场景）
- [ ] 9.3 节点/边角标（error/warning 级），验证：被 error 命中的节点显示角标（spec 场景）

## 10. 导入导出

- [ ] 10.1 导出 JSON 文件下载；存在 error 级问题时确认弹窗后仍可导出，验证：带 1 个 error 导出出现确认，确认后文件通过 schema 校验（spec 场景）
- [ ] 10.2 导入：文件选择/粘贴 → 校验 → 非法时提示且画布不动；成功则完整还原并清空撤销栈，验证：导入非法 JSON 画布不变；导入合法文件还原位置/kind/条件（spec 场景）
- [ ] 10.3 导出文件不含校验结果等派生数据，验证：导出存在 warning 的图，检查 JSON 无任何问题字段（spec 场景）

## 11. 集成验收与文档同步

- [ ] 11.1 端到端手动验收：新建 → 插入模板 → 改属性 → 删除 exit 边看到死循环 error → 补回 → 导出 → 重新导入，全程符合 specs 场景
- [ ] 11.2 全量校验：`pnpm test` 全绿、`pnpm build` 成功
- [ ] 11.3 更新 AGENTS.md「目录结构」及相关章节与实现一致，验证：目录树与命令逐一核对
- [ ] 11.4 确认全部改动已提交，验证：`git status --porcelain` 为空（否则补提交）

## Workflow follow-up

- 实现完成、验收通过后运行 `/opsx:archive` 归档本变更并同步主规格。
- v2 备忘：回放/假执行另立变更，复用 `analysis/` 纯函数与 `setCellState` 接缝（design D2/D10）。
