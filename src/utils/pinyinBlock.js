/**
 * 将页面展示用的拼音恢复为适合复制的文本。
 * 弹窗展示与交互由 components/Text/PinyinPopup.vue 负责。
 */
export function convertPinyinForCopy(displayText, isIPA = false) {
    if (isIPA) return displayText.replace(/(.)\1{2}/g, '$1$1')
    return displayText.replace('ɑ', 'a').replace('ɡ', 'g')
}
