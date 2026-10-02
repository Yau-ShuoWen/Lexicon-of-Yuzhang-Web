import { consumeBlockquote } from './blockquote.js'
import { getRouteContext, parseInline } from './inline.js'
import { consumeTable } from './table.js'

function renderLine(line, orderedIndex, context) {
    if (/^[ \t]*-{5,}[ \t]*$/.test(line)) {
        return {html: '<hr class="rt-hr">', orderedIndex: 0, consumesBreak: true}
    }
    if (line.startsWith('- ')) {
        return {html: `<span class="rt-li-dot">●</span>  ${parseInline(line.slice(2), context)}`, orderedIndex: 0}
    }
    if (line.startsWith('+ ')) {
        const next = orderedIndex + 1
        return {html: `${next}. ${parseInline(line.slice(2), context)}`, orderedIndex: next}
    }
    return {html: parseInline(line, context), orderedIndex: 0}
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
    const lines = text.replace(/\r/g, '').split('\n')
    const parts = []
    let index = 0
    let orderedIndex = 0

    while (index < lines.length) {
        const renderInline = value => parseInline(value, context)
        const renderContent = value => renderRichText(value, context)
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

        const rendered = renderLine(lines[index], orderedIndex, context)
        orderedIndex = rendered.orderedIndex
        parts.push(rendered)
        index++
    }

    return joinParts(parts).replace(/\\\\/g, '<br>')
}
