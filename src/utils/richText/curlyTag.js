function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function findClosingBrace(text, start) {
    let depth = 0
    for (let index = start; index < text.length; index++) {
        if (text[index] === '{') depth++
        if (text[index] === '}' && --depth === 0) return index
    }
    return -1
}

function splitDisplayTarget(text, requireTarget = false) {
    const separator = text.indexOf('=>')
    const stripTags = value => value.replace(/\{[a-z][a-z0-9]*\s+([^{}]+)}/g, '$1').trim()
    if (separator === -1) return requireTarget ? null : {display: text.trim(), target: stripTags(text)}

    const display = text.slice(0, separator).trim()
    const target = text.slice(separator + 2).trim()
    return display && target ? {display, target} : null
}

function renderTag(tag, inner, context, renderInline) {
    const render = value => renderInline(value, {...context, insideTag: true})

    if (tag === 'code') return `<code class="rt-code">${escapeHtml(inner).replace(/\n/g, '<br>')}</code>`
    if (tag === 'b') return `<b>${render(inner)}</b>`
    if (tag === 'i') return `<i>${render(inner)}</i>`
    if (tag === 'd') return `<del>${render(inner)}</del>`
    if (tag === 'h') return `<span class="rt-h">${render(inner)}</span>`
    if (tag === 'h1') return `<span class="rt-h rt-h1">${render(inner)}</span>`
    if (tag === 'dot') return `<span class="rt-dot">${render(inner)}</span>`
    if (tag === 's' || tag === 'a' || tag === 'p' || tag === 'v') {
        return context.renderContent ? context.renderContent(inner) : render(inner)
    }

    if (tag === 'n') {
        if (context.insideTag) return `{n ${inner}}`
        return `<span class="rt-note" data-note="${encodeURIComponent(render(inner))}"><span class="rt-note-trigger">※</span></span>`
    }

    if (tag === 'c' || tag === 'z') {
        const data = splitDisplayTarget(inner)
        if (!data) return `{${tag} ${inner}}`
        const type = tag === 'c' ? 'c' : 'h'
        return `<a href="/${context.language}/${context.dialect}/dict/${type}/${encodeURIComponent(data.target)}" target="_blank" class="normal-link">${render(data.display)}</a>`
    }

    if (tag === 'l') {
        const data = splitDisplayTarget(inner, true)
        if (!data) return `{l ${inner}}`
        const target = data.target.startsWith('/') ? data.target : `/${data.target}`
        return `<a href="/${context.language}/${context.dialect}${target}" class="normal-link">${render(data.display)}</a>`
    }

    if (tag === 'u') {
        const data = splitDisplayTarget(inner, true)
        if (!data) return `{u ${inner}}`
        const target = /^https?:\/\//i.test(data.target) ? data.target : `https://${data.target}`
        return `<a href="${target}" target="_blank" rel="noopener noreferrer" class="normal-link">${render(data.display)}</a>`
    }

    return `{${tag} ${render(inner)}}`
}

export function consumeCurlyTag(text, start, context, renderInline) {
    if (text[start] !== '{') return null
    const match = text.slice(start).match(/^\{([a-z][a-z0-9]*)\s/)
    if (!match) return null
    const end = findClosingBrace(text, start)
    if (end === -1) return null
    const contentStart = start + match[1].length + 2
    return {
        nextIndex: end + 1,
        html: renderTag(match[1], text.slice(contentStart, end), context, renderInline)
    }
}
