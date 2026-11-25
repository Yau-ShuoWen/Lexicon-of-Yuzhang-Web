import { consumeCurlyTag } from './curlyTag.js'
import { consumePhonetic } from './phonetic.js'
import { consumePinyinBlock } from './pinyinBlock.js'

export function getRouteContext() {
    const segments = typeof window === 'undefined'
        ? []
        : window.location.pathname.split('/').filter(Boolean)
    return {language: segments[0] || '', dialect: segments[1] || '', insideTag: false}
}

/**
 * 单次从左到右扫描行内语法。各处理器只消费自己的源码区间，生成的 HTML
 * 直接写入结果，不会再次被后续处理器匹配。
 */
export function parseInline(text, context = getRouteContext()) {
    let html = ''
    let index = 0

    while (index < text.length) {
        if (text.startsWith('/*', index)) {
            const end = text.indexOf('*/', index + 2)
            if (end !== -1) {
                html += `<span class="rt-comment">/*${parseInline(text.slice(index + 2, end), context)}*/</span>`
                index = end + 2
                continue
            }
        }
        const consumed = consumePinyinBlock(text, index, context, parseInline)
            || consumeCurlyTag(text, index, context, parseInline)
            || consumePhonetic(text, index)

        if (consumed) {
            html += consumed.html
            index = consumed.nextIndex
            continue
        }

        if (text[index] === ' ' && text[index + 1] === ' ') {
            let end = index + 2
            while (text[end] === ' ') end++
            const betweenPinyinSyllables = text[index - 1] === ']' && text[end] === '['
            html += '&nbsp;'.repeat(betweenPinyinSyllables ? 2 : end - index)
            index = end
            continue
        }

        if (text[index] === '\n') {
            html += '<br>'
            index++
            continue
        }

        html += text[index]
        index++
    }

    return html
}
