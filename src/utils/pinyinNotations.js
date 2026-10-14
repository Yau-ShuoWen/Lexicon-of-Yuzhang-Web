import { getUserSettings } from './userSettings.js'

export const PINYIN_NOTATIONS = Object.freeze([
    {value: 'putonghua', label: '读起来像普通话的', note: '普通话拟音', preview: '[lān→ còng↘]'},
    {value: 'standard', label: '标准写法', preview: '[lān còng]'},
    {value: 'keyboard', label: '键盘输入', preview: '[lan4 cong1]'},
    {value: 'yzcIPA', label: '本词典使用 IPA', preview: "[lan_˧˥] [ts'ɔŋ_˦˨]"},
    {value: 'other', label: '其他版拼音', note: '如果有', preview: '[lān] [ceòng]'},
    {value: 'dictIPA', label: '辞书对应版本 IPA', note: '如果有', preview: "[lan_˦˦˦] [ts'ɔŋ_˦˨]"}
])

export function selectPinyinPairs(pairs, settings = getUserSettings()) {
    if (!pairs.some(pair => pair.tag)) return pairs

    const order = settings.dialectNotations
    const selected = new Set(order)
    const orderByTag = new Map(order.map((tag, index) => [tag, index]))
    const visible = pairs
        .filter(pair => selected.has(pair.tag))
        .sort((left, right) => (orderByTag.get(left.tag) ?? Infinity) - (orderByTag.get(right.tag) ?? Infinity))

    const pinnedIndex = visible.findIndex(pair => pair.tag === settings.pinnedDialectNotation)
    if (pinnedIndex > 0) visible.unshift(...visible.splice(pinnedIndex, 1))
    return visible.length ? visible : pairs
}
