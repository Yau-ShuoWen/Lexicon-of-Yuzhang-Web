// 主入口
export function formatRichText(text) {
    if (!text || typeof text !== "string") return text;

    text = processCurlySyntax(text);
    text = processList(text);
    text = processBracketPhonetic(text);
    text = processLineBreak(text);
    text = processSpaces(text);

    return text;
}

// 处理 {} 特殊格式
function processCurlySyntax(text) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const language = segments[0];
    const dialect = segments[1];

    // {b 粗体}
    text = text.replace(/\{b\s+([^}]+)}/g, (m, p1) => `<b>${p1}</b>`);

    // {c 词语链接}
    text = text.replace(/\{c\s+([^}]+)}/g, (m, p1) => {
        return `<a href="/${language}/${dialect}/c/${encodeURIComponent(p1)}" target="_blank" style="color: #1a73e8;">${p1}</a>`;
    });

    // {n 註釋}
    text = text.replace(/\{n\s+([^}]+)}/g, (m, p1) => {
        const safe = p1.replace(/"/g, "&quot;");
        return `<span class="rt-note"><span class="rt-note-trigger">※</span><span class="rt-note-popup">${safe}</span></span>`;
    });
    // text = text.replace(/\{z\s+([^}]+)}/g, (m, p1) => `<small style="color: gray;">${p1}</small>`);
    //text = text.replace(/\{t\s+([^}]+)}/g, (m, p1) => `${p1}`);

    return text;
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