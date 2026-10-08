import type { Graph } from '@antv/x6'

import { graphToSchema, parseFlowSchemaText, schemaToCells } from '@/schema'
import type { FlowMeta, FlowSchema } from '@/schema'

import { mutate } from './mutate'
import { insertRawGraph, projectRawGraph } from './project'

/**
 * 导入导出（spec: flow-json-storage）：
 * 导出为纯持久化 JSON（version/meta/nodes/edges，不含任何派生数据）；
 * 导入先结构校验，非法时画布不动，成功后整体替换并清空撤销栈。
 */

/** 导出为持久化 JSON 文本 */
export function exportFlowJson(graph: Graph, meta: FlowMeta): string {
  const schema = graphToSchema(projectRawGraph(graph, meta))
  return `${JSON.stringify(schema, null, 2)}\n`
}

/** 依据 meta 生成下载文件名 */
export function flowFileName(meta: FlowMeta): string {
  const base = (meta.name || 'flow').trim().replace(/[\\/:*?"<>|\s]+/g, '-')
  return `${base || 'flow'}.json`
}

/** 触发浏览器下载 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mime = 'application/json',
): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export type ImportResult = { ok: true; schema: FlowSchema } | { ok: false; errors: string[] }

/** 导入：结构校验通过才整体替换画布并清空撤销栈 */
export function importFlowText(graph: Graph, text: string): ImportResult {
  const parsed = parseFlowSchemaText(text)
  if (!parsed.ok) return parsed

  const cells = schemaToCells(parsed.schema)
  insertRawGraph(graph, cells, { clear: true })
  graph.cleanHistory()
  return { ok: true, schema: parsed.schema }
}

/** 清空画布（新建）并清空撤销栈 */
export function resetGraph(graph: Graph): void {
  mutate(graph, () => {
    graph.clearCells()
  })
  graph.cleanHistory()
}
