export function normalizeRichTextSyntax(text) {
    if (!text || typeof text !== 'string') return text

    let inCodeBlock = false
    return text.replace(/^.*(?:\r?\n|$)/gm, line => {
        const content = line.replace(/\r?\n$/, '')
        if (/^\s*```/.test(content)) {
            inCodeBlock = !inCodeBlock
            return line
        }
        if (inCodeBlock || !/^\s*\|.+\|\s*$/.test(content)) return line

        const cells = content.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
        if (!cells.every(cell => /^:?-{2,}(?:[!*+]:?|:[!*+]?)?$/.test(cell))) return line
        return line.replace(/!/g, '')
    })
}
