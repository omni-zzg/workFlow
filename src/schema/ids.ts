/** 新建步骤的 id 生成（节点/边的 id 由 X6 或导入文件提供） */
let stepSeq = 0

export function createStepId(): string {
  stepSeq += 1
  return `step-${Date.now().toString(36)}-${stepSeq}`
}
