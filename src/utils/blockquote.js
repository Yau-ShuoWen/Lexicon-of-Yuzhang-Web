// 标签引用块配置（可编程映射）
// 键 = 引用块首行的标签名，如 ```jg 中的 jg
// 新增标签只需在此处添加一项：icon 图标 + accent 主题色 + bg 背景色
// 可选：text 单独指定标题文字颜色（不配置则默认使用 accent 主题色）
export const UNDEFINED_BLOCKQUOTE_STYLE = {
    icon: new URL('../assets/icons/blockquoteTag/便签.svg', import.meta.url).href,
    accent: '#737a76',
    bg: '#f5f5f5',
    headerBg: '#e7e9e8',
    iconBg: '#d5d9d7'
};

export const BLOCKQUOTE_TAG_MAP = {
    // 蓝色系：朋友圈
    pyq: {
        icon: new URL('../assets/icons/blockquoteTag/朋友圈.svg', import.meta.url).href,
        accent: '#3b82f6',
        bg: '#eff6ff',
        headerBg: '#cbdffd',
        iconBg: '#a7c8fb'
    },
    // 橙红色系：警告
    jg: {
        icon: new URL('../assets/icons/blockquoteTag/警告.svg', import.meta.url).href,
        accent: '#f97316',
        bg: '#fff7ed',
        headerBg: '#fee0c4',
        iconBg: '#fdc297'
    },
    // 紫色系：人工智能 思考
    sl: {
        icon: new URL('../assets/icons/blockquoteTag/ChatGPT.svg', import.meta.url).href,
        accent: '#7F72EA',
        bg: '#e5e5ff',
        headerBg: '#d1cefb',
        iconBg: '#bcb7f7'
    },
    // 绿色系：便签
    bq: {
        icon: new URL('../assets/icons/blockquoteTag/便签.svg', import.meta.url).href,
        accent: '#199e2d',
        bg: '#ebffed',
        headerBg: '#c1ebc7',
        iconBg: '#97d8a0',
    },
    dm: {
        icon: new URL('../assets/icons/blockquoteTag/代码.svg', import.meta.url).href,
        accent: '#5da8d1',
        bg: '#e8f6ff',
        headerBg: '#cce6f6',
        iconBg: '#b0d7ed'
    },
    bc: {
        icon: new URL('../assets/icons/blockquoteTag/补充.svg', import.meta.url).href,
        accent: '#29aaa2',
        bg: '#e4fffd',
        headerBg: '#bee8ea',
        iconBg: '#99ddd9',
    },
    gd: {
        icon: new URL('../assets/icons/blockquoteTag/观点.svg', import.meta.url).href,
        accent: '#f8d750',
        bg: '#fbf5e9',
        headerBg: '#faefca',
        iconBg: '#fae9ac',
        text: '#bc953d',   // 黄色主题太浅，单独加深标题文字色保证清晰
    },
    lt: {
        icon: new URL('../assets/icons/blockquoteTag/聊天.svg', import.meta.url).href,
        accent: '#1cb833',
        bg: '#effff1',
        headerBg: '#c4f1cb',
        iconBg: '#9be3a5',
    },

};

export function blockquoteStyleForTag(tag) {
    if (Object.hasOwn(BLOCKQUOTE_TAG_MAP, tag)) return BLOCKQUOTE_TAG_MAP[tag]
    if (tag === 'tag') return BLOCKQUOTE_TAG_MAP.bq
    return tag ? UNDEFINED_BLOCKQUOTE_STYLE : null
}

export function blockquoteStyleVariables(style) {
    return style
        ? `--bq-accent:${style.accent};--bq-bg:${style.bg};--bq-header-bg:${style.headerBg};--bq-icon-bg:${style.iconBg};--bq-text:${style.text || style.accent}`
        : ''
}
