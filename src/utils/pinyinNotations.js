import { getUserSettings } from './userSettings.js'

export const PINYIN_NOTATIONS = Object.freeze([
    {value: 'standard', label: '标准写法', labelTc: '標準寫法', preview: 'lān còng'},
    {value: 'ganCommon', label: '赣语通用拼音', labelTc: '贛語通用拼音', preview: 'lan4 cong1'},
    {value: 'yzcIPA', label: '国际音标', labelTc: '國際音標', preview: "lan˧˥ ts'ɔŋ˦˨"},
    {value: 'other', label: '其他版拼音', labelTc: '其他版拼音', note: '如果有', noteTc: '如果有', preview: 'lān ceòng'},
    {value: 'dictIPA', label: '辞书里的国际音标', labelTc: '辭書裡的國際音標', note: '如果有', noteTc: '如果有', preview: "lan˦˦˦ ts'ɔŋ˦˨"}
])

export function selectPinyinPairs(pairs, settings = getUserSettings()) {
    if (!pairs.some(pair => pair.tag)) return pairs

    const available = pairs.filter(pair => pair.tag !== 'putonghua' && pair.tag !== 'keyboard')
    const order = settings.dialectNotations
    const selected = new Set(order)
    const orderByTag = new Map(order.map((tag, index) => [tag, index]))
    const visible = available
        .filter(pair => selected.has(pair.tag))
        .sort((left, right) => (orderByTag.get(left.tag) ?? Infinity) - (orderByTag.get(right.tag) ?? Infinity))

    return visible.length ? visible : available
}
