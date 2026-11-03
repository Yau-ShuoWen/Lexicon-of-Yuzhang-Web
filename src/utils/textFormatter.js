import { normalizeRichTextSyntax } from './richText/normalize.js'
import { renderRichText } from './richText/renderer.js'
import { getRouteContext } from './richText/inline.js'

// 对外入口保持不变，现有 v-formatted-text 和直接调用方无需迁移。
export function formatRichText(text, images) {
    if (!text || typeof text !== 'string') return text
    return renderRichText(text, {...getRouteContext(), ...(images ? { images } : {})})
}

export { normalizeRichTextSyntax }
