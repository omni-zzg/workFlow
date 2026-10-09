import type { Graph } from '@antv/x6'
import { toPng, toSvg } from 'html-to-image'

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

/** 用持久化 schema 整体替换画布内容并清空撤销栈（导入文件与打开本地文档共用） */
export function loadSchema(graph: Graph, schema: FlowSchema): void {
  insertRawGraph(graph, schemaToCells(schema), { clear: true })
  graph.cleanHistory()
}

/** 导入：结构校验通过才整体替换画布并清空撤销栈 */
export function importFlowText(graph: Graph, text: string): ImportResult {
  const parsed = parseFlowSchemaText(text)
  if (!parsed.ok) return parsed

  loadSchema(graph, parsed.schema)
  return { ok: true, schema: parsed.schema }
}

/** 清空画布（新建）并清空撤销栈 */
export function resetGraph(graph: Graph): void {
  mutate(graph, () => {
    graph.clearCells()
  })
  graph.cleanHistory()
}

/** 触发 data URL 下载（PNG/SVG 图片导出用） */
export function downloadDataUrl(fileName: string, dataUrl: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export type ImageExportFormat = 'png' | 'svg' | 'html'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function baseFileName(meta: FlowMeta): string {
  return (meta.name || 'flow').trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'flow'
}

/**
 * 导出画布为可展示文件（spec: flow-canvas-editing「导出为图片与网页」）：
 * PNG / SVG 经 html-to-image 捕获真实 DOM（含 HTML 节点内容与样式）；
 * HTML 为内嵌图形的独立网页，可直接在浏览器打开。
 * 导出前自动缩放以覆盖完整图形，导出完成后恢复原视口。
 */
export async function exportFlowImage(
  graph: Graph,
  meta: FlowMeta,
  format: ImageExportFormat,
): Promise<void> {
  const previousScale = graph.zoom()
  const previousTranslation = graph.translate()

  try {
    graph.zoomToFit({ padding: 32, maxScale: 1 })
    // 等待一次渲染，确保捕获到适配后的视口
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    const options = { backgroundColor: '#f6f7f9' }
    const dataUrl =
      format === 'png' ? await toPng(graph.container, options) : await toSvg(graph.container, options)

    if (format === 'html') {
      const title = escapeHtml(meta.name || '流程图')
      const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { margin: 0; display: flex; justify-content: center; background: #f6f7f9; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
<img src="${dataUrl}" alt="${title}" />
</body>
</html>
`
      downloadTextFile(`${baseFileName(meta)}.html`, html, 'text/html')
      return
    }

    downloadDataUrl(`${baseFileName(meta)}.${format}`, dataUrl)
  } finally {
    graph.zoom(previousScale, { absolute: true })
    graph.translate(previousTranslation.tx, previousTranslation.ty)
  }
}
