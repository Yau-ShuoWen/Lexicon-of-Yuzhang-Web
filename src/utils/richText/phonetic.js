export function consumePhonetic(text, start) {
    if (text[start] !== '[') return null
    const end = text.indexOf(']', start + 1)
    if (end === -1) return null

    const inner = text.slice(start + 1, end)
    const separator = inner.indexOf('_')
    const html = separator === -1
        ? `<span class="rt-pinyin">${inner}</span>`
        : `<span class="rt-pinyin">${inner.slice(0, separator)}</span><span class="rt-ipa">${inner.slice(separator + 1)}</span>`
    return {html, nextIndex: end + 1}
}
