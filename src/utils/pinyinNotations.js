import { getUserSettings } from './userSettings.js'

export const PINYIN_NOTATIONS = Object.freeze([
    {value: 'putonghua', label: '近似读音', labelTc: '近似讀音', preview: 'lān→ còng↘'},
    {value: 'standard', label: '标准写法', labelTc: '標準寫法', preview: 'lān còng'},
    {value: 'keyboard', label: '键盘输入', labelTc: '鍵盤輸入', preview: 'lan4 cong1'},
    {value: 'yzcIPA', label: '国际音标', labelTc: '國際音標', preview: "lan˧˥ ts'ɔŋ˦˨"},
    {value: 'other', label: '其他版拼音', labelTc: '其他版拼音', note: '如果有', noteTc: '如果有', preview: 'lān ceòng'},
    {value: 'dictIPA', label: '辞书里的国际音标', labelTc: '辭書裡的國際音標', note: '如果有', noteTc: '如果有', preview: "lan˦˦˦ ts'ɔŋ˦˨"}
])

export function selectPinyinPairs(pairs, settings = getUserSettings()) {
    if (!pairs.some(pair => pair.tag)) return pairs

    const order = settings.dialectNotations
    const selected = new Set(order)
    const orderByTag = new Map(order.map((tag, index) => [tag, index]))
    const visible = pairs
        .filter(pair => selected.has(pair.tag))
        .sort((left, right) => (orderByTag.get(left.tag) ?? Infinity) - (orderByTag.get(right.tag) ?? Infinity))

    return visible.length ? visible : pairs
}
