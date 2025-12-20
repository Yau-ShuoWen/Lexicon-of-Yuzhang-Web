export function formatRichText(text) {
    if (!text || typeof text !== "string") return text;

    // --- 1) 先处理 {} 特殊格式 ---------------------------------------

    // {b 内容} → <b>内容</b>
    text = text.replace(/\{b\s+([^}]+)\}/g, (m, p1) => {
        return `<b>${p1}</b>`;
    });

    // {z 内容} → <small style="color: gray;">内容</small>
    text = text.replace(/\{z\s+([^}]+)\}/g, (m, p1) => {
        return `<small style="color: gray;">${p1}</small>`;
    });

    // {l 内容} → 链接标签（直接混在文本里即可）
    text = text.replace(/\{l\s+([^}]+)\}/g, (m, p1) => {
        return `<a href="/entry/${p1}" class="dict-link">${p1}</a>`;
    });

    // {t 内容} → 直接去掉外层花括号，只保留内容
    // 例如 {t [pa1]蛆趋区驱蛐} → [pa1]蛆趋区驱蛐
    text = text.replace(/\{t\s+([^}]+)\}/g, (m, p1) => {
        return `${p1}`;
    });


    // --- 2) 处理 [] 拼音、IPA 字体 ---------------------------------------
    text = text.replace(/\[([^\]]+)\]/g, (m, inner) => {

        // 如果含有“横杠 - ”，需要做 IPA 分段
        if (inner.includes("-")) {
            const [pre, tone] = inner.split("-");
            return (
                `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif;">[${pre}` +
                `</span>` +
                `<span style="font-family: 'Charis SIL', 'Microsoft YaHei', sans-serif;">${tone}]</span>`
            );
        }

        // 否则视为普通拼音
        return `<span style="font-family: 'Cambria', 'Cambria Math', 'Microsoft YaHei', serif;">[${inner}]</span>`;
    });

    // --- 3) 处理换行 ------------------------------------------------------
    text = text.replace(/\r/g, "").replace(/\n/g, "<br>");

    text = text.replace(/\[(.*?)\]/g, '$1');


    return text;
}