import { normalizeRichTextSyntax } from './richText/normalize.js'
import { renderRichText } from './richText/renderer.js'

// 对外入口保持不变，现有 v-formatted-text 和直接调用方无需迁移。
export function formatRichText(text) {
    if (!text || typeof text !== 'string') return text
    return renderRichText(text)
}

export { normalizeRichTextSyntax }
