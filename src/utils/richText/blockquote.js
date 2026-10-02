import { BLOCKQUOTE_TAG_MAP } from '../blockquote.js'

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/\\/g, '&#92;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function consumeBlockquote(lines, start, renderInline, renderContent) {
    if (!/^\s*```/.test(lines[start])) return null

    const openingRemainder = lines[start].replace(/^\s*```/, '')
    const sameLineEnd = openingRemainder.indexOf('```')
    if (sameLineEnd !== -1) {
        return renderBlockquote(
            openingRemainder.slice(0, sameLineEnd).trim().split('\n'),
            start + 1,
            renderInline,
            renderContent
        )
    }
    const content = openingRemainder ? [openingRemainder] : []
    let index = start + 1

    while (index < lines.length && !/```\s*$/.test(lines[index])) {
        content.push(lines[index])
        index++
    }

    if (index >= lines.length) return null

    const closingPrefix = lines[index].replace(/```\s*$/, '')
    if (closingPrefix) content.push(closingPrefix)

    return renderBlockquote(content, index + 1, renderInline, renderContent)
}

function renderBlockquote(content, nextIndex, renderInline, renderContent) {
    const normalized = content.join('\n').trim().split('\n').map(line => line.trim())
    const firstLine = normalized[0] || ''
    const tagName = /^[a-z][a-z0-9]*$/.test(firstLine) ? firstLine : null
    const config = tagName ? BLOCKQUOTE_TAG_MAP[tagName] : null

    if (config && normalized.length >= 2) {
        const title = renderInline(normalized[1])
        const bodyLines = tagName === 'dm' ? content.slice(2) : normalized.slice(2)
        const body = tagName === 'dm'
            ? bodyLines.map(escapeHtml).join('<br>')
            : renderContent(bodyLines.join('\n'))
        const style = `--bq-accent:${config.accent};--bq-bg:${config.bg};--bq-header-bg:${config.headerBg};--bq-icon-bg:${config.iconBg};--bq-text:${config.text || config.accent}`
        const modifierClass = tagName === 'dm' ? ' rt-blockquote-tag--dm' : ''
        return {
            nextIndex,
            html: `<blockquote class="rt-blockquote rt-blockquote-tag${modifierClass}" style="${style}"><div class="rt-blockquote__header"><img class="rt-blockquote__icon" src="${config.icon}" alt="${tagName}"><span class="rt-blockquote__title">${title}</span></div>${body ? `<div class="rt-blockquote__body">${body}</div>` : ''}</blockquote>`
        }
    }

    return {
        nextIndex,
        html: `<blockquote class="rt-blockquote">${renderContent(normalized.join('\n'))}</blockquote>`
    }
}
