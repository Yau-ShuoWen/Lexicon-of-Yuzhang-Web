// =========================
// 主入口（保持原流程顺序）
// =========================
export function formatRichText(text) {
    if (!text || typeof text !== "string") return text;

    text = processCurlySyntax(text);     // 1)
    text = processList(text);            // 新增列表
    text = processBracketPhonetic(text); // 2)
    text = processLineBreak(text);       // 3)
    text = stripBracket(text);           // []
    text = processSpaces(text);          // 空格

    return text;
}


// =========================
// 模块1：处理 {} 特殊格式
// =========================
function processCurlySyntax(text) {
    text = text.replace(/\{b\s+([^}]+)}/g, (m, p1) => `<b>${p1}</b>`);
    text = text.replace(/\{z\s+([^}]+)}/g, (m, p1) => `<small style="color: gray;">${p1}</small>`);
    text = text.replace(/\{t\s+([^}]+)}/g, (m, p1) => `${p1}`);
    return text;
}


// =========================
// 模块2：处理列表
// =========================
function processList(text) {
    const lines = text.split(/\r?\n/);
    let inUl = false;
    let inOl = false;
    const result = [];

    lines.forEach((line) => {
        if (line.startsWith("- ")) {
            if (!inUl) {
                result.push("<ul>");
                inUl = true;
            }
            result.push(`<li>${line.slice(2).trim()}</li>`);
        } else if (line.startsWith("+ ")) {
            if (!inOl) {
                result.push("<ol>");
                inOl = true;
            }
            result.push(`<li>${line.slice(2).trim()}</li>`);
        } else {
            if (inUl) {
                result.push("</ul>");
                inUl = false;
            }
            if (inOl) {
                result.push("</ol>");
                inOl = false;
            }
            result.push(line);
        }
    });

    if (inUl) result.push("</ul>");
    if (inOl) result.push("</ol>");

    return result.join("\n");
}


// =========================
// 模块3：处理 [] 拼音 / IPA
// =========================
function processBracketPhonetic(text) {
    return text.replace(/\[([^\]]+)\]/g, (m, inner) => {

        if (inner.includes("_")) {
            const [pre, tone] = inner.split("_");
            return (
                `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif; font-size: 1.1em ">[${pre}</span>` +
                `<span style="font-family: 'Charis SIL', 'Microsoft YaHei', sans-serif; ">${tone}]</span>`
            );
        }

        return `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif; font-size: 1.1em">[${inner}]</span>`;
    });
}


// =========================
// 模块4：处理换行
// =========================
function processLineBreak(text) {
    return text.replace(/\r/g, "").replace(/\n/g, "<br>");
}


// =========================
// 模块5：去掉 []
// =========================
function stripBracket(text) {
    return text.replace(/\[(.*?)\]/g, '$1');
}


// =========================
// 模块6：处理空格
// =========================
function processSpaces(text) {
    return text.replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));
}