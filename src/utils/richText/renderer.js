import { consumeBlockquote } from './blockquote.js'
import { getRouteContext, parseInline } from './inline.js'
import { consumeTable } from './table.js'

function splitStructuralLines(text) {
    const lines = []
    let current = ''
    let curlyDepth = 0

    for (let index = 0; index < text.length; index++) {
        const char = text[index]
        if (char === '{' && (curlyDepth > 0 || /^\{[a-z][a-z0-9]*\s/.test(text.slice(index)))) curlyDepth++
        if (char === '}' && curlyDepth > 0) curlyDepth--

        if (char === '\n' && curlyDepth === 0) {
            lines.push(current)
            current = ''
        } else {
            current += char
        }
    }
    lines.push(current)
    return lines
}

function renderLine(line, orderedIndex, context) {
    if (/^[ \t]*-{5,}[ \t]*$/.test(line)) {
        return {html: '<hr class="rt-hr">', orderedIndex: 0, consumesBreak: true}
    }
    if (line.startsWith('- ')) {
        return {
            html: `<span class="rt-list-item"><span class="rt-list-marker rt-li-dot">●</span><span class="rt-list-content">${parseInline(line.slice(2), context)}</span></span>`,
            orderedIndex: 0,
            block: true,
        }
    }
    if (line.startsWith('+ ')) {
        const next = orderedIndex + 1
        return {
            html: `<span class="rt-list-item"><span class="rt-list-marker rt-list-number">${next}.</span><span class="rt-list-content">${parseInline(line.slice(2), context)}</span></span>`,
            orderedIndex: next,
            block: true,
        }
    }
    const isHeading = /^\s*\{h1\s[\s\S]*}\s*$/.test(line)
    return {
        html: parseInline(line, context),
        orderedIndex: 0,
        ...(isHeading ? {block: true, kind: 'heading'} : {}),
    }
}

function normalizeHeadingWhitespace(parts) {
    return parts.filter((part, index) => {
        if (!part.empty) return true

        let previous = index - 1
        while (previous >= 0 && parts[previous].empty) previous--
        let next = index + 1
        while (next < parts.length && parts[next].empty) next++

        return parts[previous]?.kind !== 'heading' && parts[next]?.kind !== 'heading'
    })
}

function joinParts(parts) {
    let html = ''
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index]
        if (part.empty) continue
        html += part.html
        let blankCount = 0
        let cursor = index + 1
        while (cursor < parts.length && parts[cursor].empty) {
            blankCount++
            cursor++
        }
        const next = parts[cursor]
        if (!next) break

        if (part.kind === 'blockquote' && next.kind === 'blockquote') {
            html += '<div class="rt-blockquote-gap"></div>'
            index += blankCount
            continue
        }
        if (part.block || part.consumesBreak) {
            if (blankCount === 1) html += '<br>'
            if (blankCount > 1) {
                html += `<br><span class="rt-empty-line" style="height:${(blankCount - 1) * 0.8}em"></span>`
            }
            index += blankCount
            continue
        }
        if (blankCount) {
            html += `<br><span class="rt-empty-line" style="height:${blankCount * 0.8}em"></span>`
            index += blankCount
        } else {
            html += '<br>'
        }
    }
    return html
}

export function renderRichText(text, context = getRouteContext()) {
    const lines = splitStructuralLines(text.replace(/\r/g, ''))
    const parts = []
    let index = 0
    let orderedIndex = 0
    const renderContent = value => renderRichText(value, context)
    const inlineContext = {...context, renderContent}
    const renderInline = value => parseInline(value, inlineContext)

    while (index < lines.length) {
        const blockquote = consumeBlockquote(lines, index, renderInline, renderContent)
        if (blockquote) {
            parts.push({html: blockquote.html, block: true, kind: 'blockquote'})
            index = blockquote.nextIndex
            orderedIndex = 0
            continue
        }

        const table = consumeTable(lines, index, renderInline)
        if (table) {
            parts.push({html: table.html, block: true, kind: 'table'})
            index = table.nextIndex
            orderedIndex = 0
            continue
        }

        if (lines[index] === '') {
            parts.push({html: '', empty: true})
            index++
            orderedIndex = 0
            continue
        }

        const rendered = renderLine(lines[index], orderedIndex, inlineContext)
        orderedIndex = rendered.orderedIndex
        parts.push(rendered)
        index++
    }

    return joinParts(normalizeHeadingWhitespace(parts)).replace(/\\\\/g, '<br>')
}
