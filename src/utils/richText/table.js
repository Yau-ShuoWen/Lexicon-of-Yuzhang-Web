function isTableRow(line) {
    return /^\s*\|(.+)\|\s*$/.test(line)
}

function splitTableRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

function isAlignRow(line) {
    return isTableRow(line) && splitTableRow(line).every(cell =>
        /^:?-{2,}[!*+]?:?$/.test(cell) || /^:?-{2,}:?[!*+]?$/.test(cell)
    )
}

function parseAlignments(line) {
    return splitTableRow(line).map(cell => {
        let align = 'left'
        if (cell.startsWith(':') && cell.endsWith(':')) align = 'center'
        else if (cell.endsWith(':')) align = 'right'

        let widthType = 'nowrap'
        if (cell.includes('*')) widthType = 'long'
        else if (cell.includes('+')) widthType = 'normal'
        return {align, widthType}
    })
}

function getColumnClass(info) {
    if (info?.widthType === 'nowrap') return 'rt-col-nowrap'
    if (info?.widthType === 'long') return 'rt-col-long'
    return 'rt-col-normal'
}

function buildMergedRows(sourceRows, columnCount) {
    const normalizedRows = sourceRows.map(row =>
        Array.from({length: columnCount}, (_, index) => row[index] || '')
    )
    const parsedRows = normalizedRows.map((row, rowIndex) => {
        const anchors = []
        const coverage = new Array(columnCount)

        row.forEach((content, column) => {
            const left = coverage[column - 1]
            if (content.trim() === '#>' && left && left.row === rowIndex && left.content.trim() !== '#^') {
                left.colspan++
                coverage[column] = left
                return
            }
            const anchor = {content, row: rowIndex, column, colspan: 1, rowspan: 1, hidden: false}
            anchors.push(anchor)
            coverage[column] = anchor
        })
        return {anchors, coverage}
    })

    for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex++) {
        const previousCoverage = parsedRows[rowIndex - 1].coverage
        const current = parsedRows[rowIndex]

        for (const anchor of new Set(previousCoverage)) {
            if (!anchor || anchor.row + anchor.rowspan !== rowIndex) continue
            const start = anchor.column
            const end = start + anchor.colspan
            if (!normalizedRows[rowIndex].slice(start, end).every(content => content.trim() === '#^')) continue

            anchor.rowspan++
            for (let column = start; column < end; column++) {
                const placeholder = current.coverage[column]
                if (placeholder) placeholder.hidden = true
                current.coverage[column] = anchor
            }
        }
    }

    return parsedRows.map(row => row.anchors.filter(cell => !cell.hidden))
}

function renderRows(sectionTag, rows, columnCount, cellTag, alignments, renderInline) {
    let html = `<${sectionTag}>`
    for (const row of buildMergedRows(rows, columnCount)) {
        html += '<tr>'
        for (const cell of row) {
            const info = alignments[cell.column] || {}
            const merged = cell.colspan > 1 || cell.rowspan > 1
            const classes = [getColumnClass(info)]
            if (merged) classes.push('rt-cell-merged')
            const colspan = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ''
            const rowspan = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ''
            const align = merged ? 'center' : (info.align || 'left')
            html += `<${cellTag} class="${classes.join(' ')}" style="text-align:${align}"${colspan}${rowspan}>${renderInline(cell.content)}</${cellTag}>`
        }
        html += '</tr>'
    }
    return `${html}</${sectionTag}>`
}

export function consumeTable(lines, start, renderInline) {
    let headers = null
    let alignments = null
    let index = start

    if (index + 1 < lines.length && isTableRow(lines[index]) && isAlignRow(lines[index + 1])) {
        headers = splitTableRow(lines[index])
        alignments = parseAlignments(lines[index + 1])
        index += 2
    } else if (isAlignRow(lines[index])) {
        alignments = parseAlignments(lines[index])
        index++
    } else {
        return null
    }

    const rows = []
    while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]))
        index++
    }

    const widthTypes = alignments.map(info => info.widthType || 'normal')
    const tableMode = widthTypes.length && widthTypes.every(type => type === 'nowrap')
        ? 'rt-table-compact'
        : widthTypes.includes('long') ? 'rt-table-fill' : 'rt-table-auto'
    const columnCount = headers ? headers.length : Math.max(alignments.length, ...rows.map(row => row.length))

    let table = `<table class="rt-table ${tableMode}">`
    if (headers) table += renderRows('thead', [headers], columnCount, 'th', alignments, renderInline)
    if (rows.length) table += renderRows('tbody', rows, columnCount, 'td', alignments, renderInline)
    table += '</table>'

    return {
        nextIndex: index,
        html: `<div class="rt-table-wrap ${tableMode}-wrap">${table}</div>`
    }
}
