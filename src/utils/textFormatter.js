export function formatTextWithFont(text) {
    if (!text || typeof text !== 'string') return text;

    // 使用内联样式，直接写入 style
    text = text.replace(/\/\/(.*?)\/\//g, '<span style="font-family: \'Cambria\', \'Microsoft YaHei\', serif;">$1</span>');
    text = text.replace(/--(.*?)--/g, '<span style="font-family: \'Charis SIL\', \'Microsoft YaHei\', sans-serif;">$1</span>');

    return text.replace(/\n/g, '<br>') // 将换行符转换为 <br>
        .replace(/\r/g, ''); // 移除回车符;
}