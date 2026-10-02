import { BLOCKQUOTE_TAG_MAP } from '../blockquote.js'

export function consumeBlockquote(lines, start, renderInline) {
    if (!/^\s*```/.test(lines[start])) return null

    const openingRemainder = lines[start].replace(/^\s*```/, '')
    const sameLineEnd = openingRemainder.indexOf('```')
    if (sameLineEnd !== -1) {
        return renderBlockquote(
            openingRemainder.slice(0, sameLineEnd).trim().split('\n'),
            start + 1,
            renderInline
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

    return renderBlockquote(content, index + 1, renderInline)
}

function renderBlockquote(content, nextIndex, renderInline) {
    const normalized = content.join('\n').trim().split('\n').map(line => line.trim())
    const firstLine = normalized[0] || ''
    const tagName = /^[a-z][a-z0-9]*$/.test(firstLine) ? firstLine : null
    const config = tagName ? BLOCKQUOTE_TAG_MAP[tagName] : null

    if (config && normalized.length >= 2) {
        const title = renderInline(normalized[1])
        const body = normalized.slice(2).map(renderInline).join('<br>')
        const style = `--bq-accent:${config.accent};--bq-bg:${config.bg};--bq-header-bg:${config.headerBg};--bq-icon-bg:${config.iconBg};--bq-text:${config.text || config.accent}`
        return {
            nextIndex,
            html: `<blockquote class="rt-blockquote rt-blockquote-tag" style="${style}"><div class="rt-blockquote__header"><img class="rt-blockquote__icon" src="${config.icon}" alt="${tagName}"><span class="rt-blockquote__title">${title}</span></div>${body ? `<div class="rt-blockquote__body">${body}</div>` : ''}</blockquote>`
        }
    }

    return {
        nextIndex,
        html: `<blockquote class="rt-blockquote">${normalized.map(renderInline).join('<br>')}</blockquote>`
    }
}
