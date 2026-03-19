export function formatRichText(text) {
    if (!text || typeof text !== "string") return text;

    // --- 1) 先处理 {} 特殊格式 ---------------------------------------
    text = text.replace(/\{b\s+([^}]+)\}/g, (m, p1) => `<b>${p1}</b>`);
    text = text.replace(/\{z\s+([^}]+)\}/g, (m, p1) => `<small style="color: gray;">${p1}</small>`);
    text = text.replace(/\{t\s+([^}]+)\}/g, (m, p1) => `${p1}`);

    // --- 新增 处理列表 -----------------------------------------------
    // 先按行分割
    const lines = text.split(/\r?\n/);
    let inUl = false;
    let inOl = false;
    const result = [];

    lines.forEach((line, idx) => {
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

    // 结束列表
    if (inUl) result.push("</ul>");
    if (inOl) result.push("</ol>");

    text = result.join("\n");

    // --- 2) 处理 [] 拼音、IPA 字体 ---------------------------------------
    text = text.replace(/\[([^\]]+)\]/g, (m, inner) => {

        // 如果含有“横杠 - ”，需要做 IPA 分段
        if (inner.includes("-")) {
            const [pre, tone] = inner.split("-");
            return (
                `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif;  ">[${pre}` + `</span>` +
                `<span style="font-family: 'Charis SIL', 'Microsoft YaHei', sans-serif; ">${tone}]</span>`
            );
        }

        // 否则视为普通拼音
        return `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif;">[${inner}]</span>`;
    });

    // --- 3) 处理换行 ------------------------------------------------------
    text = text.replace(/\r/g, "").replace(/\n/g, "<br>");

    text = text.replace(/\[(.*?)\]/g, '$1');

    text = text.replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));
    return text;
}