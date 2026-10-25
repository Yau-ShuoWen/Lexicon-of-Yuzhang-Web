export function consumePhonetic(text, start) {
    if (text[start] !== '[') return null
    const end = text.indexOf(']', start + 1)
    if (end === -1) return null

    const inner = text.slice(start + 1, end)
    const isIPA = inner.startsWith('-')
    const content = isIPA ? inner.slice(1) : inner
    const html = isIPA
        ? renderIPA(content)
        : `<span class="rt-pinyin">${content}</span>`
    return {html, nextIndex: end + 1}
}

const TONE_MARKS = /[˥˦˧˨˩꜒꜓꜔꜕꜖]+/gu

function renderIPA(content) {
    let html = ''
    let index = 0
    for (const match of content.matchAll(TONE_MARKS)) {
        if (match.index > index) html += `<span class="rt-ipa-syllable">${content.slice(index, match.index)}</span>`
        html += `<span class="rt-ipa">${match[0]}</span>`
        index = match.index + match[0].length
    }
    if (index < content.length) html += `<span class="rt-ipa-syllable">${content.slice(index)}</span>`
    return html
}
