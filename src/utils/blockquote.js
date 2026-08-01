// 标签引用块配置（可编程映射）
// 键 = 引用块首行的标签名，如 ```warn 中的 warn
// 新增标签只需在此处添加一项：icon 图标 + accent 主题色 + bg 背景色
export const BLOCKQUOTE_TAG_MAP = {
    // 蓝色系：朋友圈
    pyq: {
        icon: new URL('../assets/icons/blockquoteTag/朋友圈.svg', import.meta.url).href,
        accent: '#3b82f6',
        bg: '#eff6ff'
    },
    // 橙红色系：警告
    warn: {
        icon: new URL('../assets/icons/blockquoteTag/警告.svg', import.meta.url).href,
        accent: '#f97316',
        bg: '#fff7ed'
    },
    // 紫色系：人工智能 思考
    ai: {
        icon: new URL('../assets/icons/blockquoteTag/ChatGPT.svg', import.meta.url).href,
        accent: '#7F72EA',
        bg: '#e5e5ff'
    },
    // 绿色系：便签
    bq: {
        icon: new URL('../assets/icons/blockquoteTag/便签.svg', import.meta.url).href,
        accent: '#199e2d',
        bg: '#ebffed',
    },
    yl: {
        icon: new URL('../assets/icons/blockquoteTag/医疗.svg', import.meta.url).href,
        accent: '#dab30c',
        bg: '#fffce7',
    },
    bc: {
        icon: new URL('../assets/icons/blockquoteTag/补充.svg', import.meta.url).href,
        accent: '#29aaa2',
        bg: '#e4fffd',
    },


};
