import { describe, expect, it } from 'vitest'

// 脚手架自检：证明 Vitest 已接入 pnpm test（真实用例自 schema/analysis/validation 起）
describe('vitest 脚手架', () => {
  it('测试运行器可执行断言', () => {
    expect(true).toBe(true)
  })
})
