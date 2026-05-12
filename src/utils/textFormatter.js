// 主入口
export function formatRichText(text) {
    if (!text || typeof text !== "string") return text;

    text = processCurlySyntax(text);
    text = processTable(text);
    text = processList(text);
    text = processBracketPhonetic(text);
    text = processLineBreak(text);
    text = processSpaces(text);

    return text;
}

// 处理 {} 特殊格式（支持有限嵌套）
function processCurlySyntax(text) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const language = segments[0];
    const dialect = segments[1];

    return parseCurly(text);

    // 遞歸解析
    function parseCurly(input, insideTag = false) {
        let result = "";
        let i = 0;

        while (i < input.length) {

            // 找到 {
            if (input[i] === "{") {

                // 嘗試匹配 tag 類型
                const tagMatch = input.slice(i).match(/^\{([a-z])\s/);

                if (!tagMatch) {
                    result += input[i];
                    i++;
                    continue;
                }

                const tag = tagMatch[1];

                // 找到內容開始位置
                const contentStart = i + 3; // {x␠

                // 找對應 }
                const end = findMatchingBrace(input, i);

                // 找不到匹配，當普通文本
                if (end === -1) {
                    result += input[i];
                    i++;
                    continue;
                }

                const inner = input.slice(contentStart, end);

                // render
                result += renderTag(tag, inner, insideTag);

                i = end + 1;
                continue;
            }

            result += input[i];
            i++;
        }

        return result;
    }

    function splitDisplayTarget(text, requireTarget = false) {

        const separatorIndex = text.indexOf("|");

        // 去掉簡單格式 tag，用於 target
        const stripTags = (str) =>
            str.replace(/\{[a-z]\s+([^{}]+)\}/g, "$1").trim();

        // 沒有 |
        if (separatorIndex === -1) {

            if (requireTarget) {
                return null;
            }

            return {
                display: text.trim(),
                target: stripTags(text)
            };
        }

        const display = text.slice(0, separatorIndex).trim();
        const target = text.slice(separatorIndex + 1).trim();

        if (!display || !target) {
            return null;
        }

        return {
            display,
            target
        };
    }

    // render 各種 tag
    function renderTag(tag, inner, insideTag) {

        switch (tag) {

            case "b":
                return `<b>${inner}</b>`;
            case "i":
                return `<i>${inner}</i>`;
            case "d":
                return `<del>${inner}</del>`;

            case "c": {

                const parsedData = splitDisplayTarget(inner);

                if (!parsedData) {
                    return `{c ${inner}}`;
                }

                const {display, target} = parsedData;

                // 只解析 display
                const displayHtml = parseCurly(display, true);

                return `<a href="/${language}/${dialect}/c/${encodeURIComponent(target)}" target="_blank" style="color: #1a73e8;">${displayHtml}</a>`;
            }

            case "n":

                // note 必須在最外層
                if (insideTag) return `{n ${inner}}`;


                const parsed = parseCurly(inner, true);
                const safe = parsed.replace(/"/g, "&quot;");

                return `<span class="rt-note"><span class="rt-note-trigger">※</span><span class="rt-note-popup">${safe}</span></span>`;

            case "l": {

                const parsedData = splitDisplayTarget(inner, true);

                if (!parsedData) {
                    return `{l ${inner}}`;
                }

                const {display, target} = parsedData;

                // 只解析 display
                const displayHtml = parseCurly(display, true);

                return `<a href="${target}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8;">${displayHtml}</a>`;
            }

            case "h":
                return `<h3>${inner}</h3>`;

            case "s":
                return "";// 不出現在前端


            // ===== 預留 =====



            case "a":
                // TODO: audio
                return inner;

            case "p":
                // TODO: picture
                return inner;

            case "v":
                // TODO: video
                return inner;

            default:
                return `{${tag} ${inner}}`;
        }
    }

    // 找匹配的大括號
    function findMatchingBrace(str, start) {
        let depth = 0;

        for (let i = start; i < str.length; i++) {

            if (str[i] === "{") {
                depth++;
            } else if (str[i] === "}") {
                depth--;

                if (depth === 0) {
                    return i;
                }
            }
        }

        return -1;
    }
}

// 處理 markdown table
function processTable(text) {

    const lines = text.split(/\r?\n/);
    const result = [];

    let i = 0;

    while (i < lines.length) {

        // 至少要有 header + align 行
        if (
            i + 1 < lines.length &&
            isTableRow(lines[i]) &&
            isAlignRow(lines[i + 1])
        ) {

            const headerLine = lines[i];
            const alignLine = lines[i + 1];

            const headers = splitTableRow(headerLine);
            const aligns = parseAlignments(alignLine);

            const rows = [];

            i += 2;

            // 收集 body
            while (i < lines.length && isTableRow(lines[i])) {
                rows.push(splitTableRow(lines[i]));
                i++;
            }

            // render
            let html = `<table class="rt-table">`;

            // thead
            html += `<thead><tr>`;

            headers.forEach((cell, idx) => {

                const align = aligns[idx] || "left";

                html += `<th style="text-align:${align}">${cell}</th>`;
            });

            html += `</tr></thead>`;

            // tbody
            if (rows.length > 0) {

                html += `<tbody>`;

                rows.forEach(row => {

                    html += `<tr>`;

                    headers.forEach((_, idx) => {

                        const align = aligns[idx] || "left";
                        const cell = row[idx] || "";

                        html += `<td style="text-align:${align}">${cell}</td>`;
                    });

                    html += `</tr>`;
                });

                html += `</tbody>`;
            }

            html += `</table>`;

            result.push(html);

            continue;
        }

        result.push(lines[i]);
        i++;
    }

    return result.join("\n");

    // ---------- helpers ----------

    function isTableRow(line) {
        return /^\s*\|(.+)\|\s*$/.test(line);
    }

    function isAlignRow(line) {

        if (!isTableRow(line)) {
            return false;
        }

        const cells = splitTableRow(line);

        return cells.every(cell =>
            /^:?-{3,}:?$/.test(cell.trim())
        );
    }

    function splitTableRow(line) {

        return line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell => cell.trim());
    }

    function parseAlignments(line) {

        const cells = splitTableRow(line);

        return cells.map(cell => {

            const c = cell.trim();

            if (c.startsWith(":") && c.endsWith(":")) {
                return "center";
            }

            if (c.endsWith(":")) {
                return "right";
            }

            return "left";
        });
    }
}

// 处理列表
function processList(text) {
    const lines = text.split(/\r?\n/);
    const result = [];

    let orderedIndex = 0; // 當前 + 列表計數

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 👉 無序列表（永遠單獨處理，不影響上下文）
        if (line.startsWith("- ")) {
            orderedIndex = 0; // 打斷有序列表
            result.push("○  " + line.slice(2));
            continue;
        }

        // 👉 有序列表
        if (line.startsWith("+ ")) {
            // 判斷是不是連續區塊的開始
            if (orderedIndex === 0) {
                orderedIndex = 1;
            } else {
                orderedIndex++;
            }

            result.push(orderedIndex + ". " + line.slice(2));
            continue;
        }

        // 👉 其他行（包括空行）
        orderedIndex = 0; // 中斷有序列表
        result.push(line);
    }

    return result.join("\n");
}

// 处理 [] 拼音 / IPA
function processBracketPhonetic(text) {
    text = text.replace(/\[([^\]]+)]/g, (m, inner) => {

        if (inner.includes("_")) {
            const [pre, tone] = inner.split("_");
            return (
                `<span style="font-family: 'Cambria', 'Cambria Math', 'Charis SIL', serif; font-size: 1.1em ">[${pre}</span>` +
                `<span style="font-family: 'Charis SIL', serif ">${tone}]</span>`
            );
        }

        return `<span style="font-family: 'Cambria', 'Cambria Math', 'Charis SIL', serif; font-size: 1.1em">[${inner}]</span>`;
    });
    return text.replace(/\[(.*?)]/g, '$1');
}

// 处理换行
function processLineBreak(text) {
    return text.replace(/\r/g, "").replace(/\n/g, "<br>");
}

// 处理空格
function processSpaces(text) {
    return text.replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));
}