export function consumePinyinBlock(text, start, context, renderInline) {
    if (text[start] !== '▕') return null
    const end = text.indexOf('▏', start + 1)
    if (end === -1) return null

    const content = text.slice(start + 1, end)
    const firstPipe = content.indexOf('│')
    const triggerRaw = (firstPipe === -1 ? content : content.slice(0, firstPipe)).trim()
    const pairSource = firstPipe === -1 ? '' : content.slice(firstPipe)
    const pairs = []

    for (const part of pairSource.split('│').filter(Boolean)) {
        const separator = part.indexOf('┆')
        if (separator === -1) continue
        const label = part.slice(0, separator).trim()
        const value = part.slice(separator + 1).trim()
        pairs.push({
            label,
            valueHtml: renderInline(value, context),
            valueItems: value.split(/\s+/).filter(Boolean).map(item => renderInline(item, context)),
            isIPA: /\[[^\]]+_/.test(value)
        })
    }

    const triggerHtml = renderInline(triggerRaw, context)
    const payload = encodeURIComponent(JSON.stringify({trigger: triggerHtml, pairs}))
    return {
        nextIndex: end + 1,
        html: `<span class="rt-pinyin-block"><span class="rt-pinyin-trigger" data-pinyin-data="${payload}">${triggerHtml}</span></span>`
    }
}
