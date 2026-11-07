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
        const firstSeparator = part.indexOf('┆')
        if (firstSeparator === -1) continue
        const secondSeparator = part.indexOf('┆', firstSeparator + 1)
        const tagged = secondSeparator !== -1
        const tag = tagged ? part.slice(0, firstSeparator).trim() : ''
        const label = tagged
            ? part.slice(firstSeparator + 1, secondSeparator).trim()
            : part.slice(0, firstSeparator).trim()
        const value = part.slice((tagged ? secondSeparator : firstSeparator) + 1).trim()
        pairs.push({
            tag,
            label,
            valueHtml: renderInline(value, context),
            valueItems: value.split(/\s+/).filter(Boolean).map(item => renderInline(item, context)),
            isIPA: /\[-[^\]]*\]/.test(value)
        })
    }

    const triggerHtml = pairs.find(pair => pair.tag === 'standard')?.valueHtml || renderInline(triggerRaw, context)
    const payload = encodeURIComponent(JSON.stringify({trigger: triggerHtml, pairs}))
    const hasTextBefore = start > 0 && !/\s/.test(text[start - 1]) && text[start - 1] !== '▏'
    const hasTextAfter = end + 1 < text.length && !/\s/.test(text[end + 1]) && text[end + 1] !== '▕'
    const spacingClass = [
        hasTextBefore && 'rt-pinyin-block--space-before',
        hasTextAfter && 'rt-pinyin-block--space-after'
    ].filter(Boolean).join(' ')
    return {
        nextIndex: end + 1,
        html: `<span class="rt-pinyin-block ${spacingClass}"><span class="rt-pinyin-trigger" role="button" tabindex="0" data-pinyin-data="${payload}">${triggerHtml}</span></span>`
    }
}
