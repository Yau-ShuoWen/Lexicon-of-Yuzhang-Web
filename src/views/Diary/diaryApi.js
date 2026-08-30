import { getToken } from '../../utils/auth.js'

function isObject(value) {
    return value !== null && typeof value === 'object'
}

function unwrapMaybe(value) {
    if (value === null || value === undefined) return null
    if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'empty')) {
        return value.empty ? null : value.value
    }
    return value
}

export function localizeValue(value, language = 'sc') {
    const unwrapped = unwrapMaybe(value)

    if (unwrapped === null || unwrapped === undefined) return ''
    if (typeof unwrapped === 'string' || typeof unwrapped === 'number') return String(unwrapped)

    if (Array.isArray(unwrapped)) {
        return unwrapped.map(item => localizeValue(item, language)).filter(Boolean).join('\n')
    }

    if (isObject(unwrapped)) {
        if (typeof unwrapped[language] === 'string') return unwrapped[language]
        if (typeof unwrapped.sc === 'string') return unwrapped.sc
        if (typeof unwrapped.tc === 'string') return unwrapped.tc
        if (typeof unwrapped.value === 'string') return unwrapped.value
    }

    return ''
}

export function normalizeCatalog(payload) {
    if (!payload) return []

    const years = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.years)
            ? payload.years
            : []

    return years.map(year => ({
        year: year.year,
        total: year.total ?? 0,
        months: Array.isArray(year.months)
            ? year.months.map(month => ({
                month: month.month,
                total: month.total ?? 0,
                startDate: month.startDate ?? '',
                endDate: month.endDate ?? ''
            }))
            : []
    }))
}

export function normalizeDigest(item, language = 'sc') {
    return {
        id: item?.id ?? null,
        date: item?.date ?? '',
        intro: item?.intro??'',
        startDate: item?.startDate ?? '',
        finalizeDate: item?.finalizeDate ?? '',
        updatedTime: item?.updatedTime ?? ''
    }
}

export function normalizeDiaryText(payload, language = 'sc') {
    const raw = unwrapMaybe(payload)
    if (!raw) return null

    const availableViews = Array.isArray(raw.availableViews)
        ? raw.availableViews
            .filter(Boolean)
            .map(item => String(item).trim().toLowerCase())
        : []

    return {
        id: raw.id ?? null,
        date: raw.date ?? '',
        title: raw.title ?? '',
        content: raw.content ?? '',
        abridge: raw.abridge ?? '',
        startDate: raw.startDate ?? '',
        finalizeDate: raw.finalizeDate ?? '',
        createdTime: raw.createdTime ?? '',
        updatedTime: raw.updatedTime ?? '',
        viewMode: raw.viewMode ? String(raw.viewMode).trim().toLowerCase() : '',
        availableViews
    }
}

export function normalizeDiaryEdit(payload) {
    const raw = unwrapMaybe(payload)
    if (!raw) return null

    return {
        id: raw.id ?? null,
        date: raw.date ?? '',
        sort: raw.sort ?? 1,
        content: raw.content ?? '',
        forFriend: raw.forFriend ?? null,
        forStranger: raw.forStranger ?? null,
        startDate: raw.startDate ?? '',
        finalizeDate: raw.finalizeDate ?? '',
        visibility: raw.visibility ? String(raw.visibility).trim().toLowerCase() : 'private'
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options)
    const json = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(json?.message || `HTTP错误: ${response.status}`)
    }

    return json
}

function assertApiSuccess(data, fallbackMessage) {
    if (!data?.success) {
        throw new Error(data?.message || fallbackMessage)
    }
    return data.data
}

function buildDiaryQuery(view, extra = {}) {
    const params = new URLSearchParams()
    if (view) params.set('view', String(view))
    const token = getToken()
    if (token) params.set('t', token)

    for (const [key, value] of Object.entries(extra)) {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, String(value))
        }
    }

    const suffix = params.toString()
    return suffix ? `?${suffix}` : ''
}

export async function getDiaryCatalog(view = 'stranger') {
    const data = await fetchJson(`/api/diary/catalog${buildDiaryQuery(view)}`)
    return normalizeCatalog(data)
}

export async function getRecentDiaries(language, view = 'stranger') {
    const data = await fetchJson(`/api/diary/recent/${language}${buildDiaryQuery(view)}`)
    return Array.isArray(data) ? data.map(item => normalizeDigest(item, language)) : []
}

export async function queryDiaries(language, filters = {}, view = 'stranger') {
    const data = await fetchJson(`/api/diary/query/${language}${buildDiaryQuery(view, {
        year: filters.year,
        month: filters.month
    })}`)
    return Array.isArray(data) ? data.map(item => normalizeDigest(item, language)) : []
}

export async function getDiaryByDate(language, date, view = 'stranger') {
    const data = await fetchJson(`/api/diary/item/${language}/date/${date}${buildDiaryQuery(view)}`)
    return normalizeDiaryText(data, language)
}

export async function getDiaryById(language, id, view = 'stranger') {
    const data = await fetchJson(`/api/diary/item/${language}/id/${id}${buildDiaryQuery(view)}`)
    return normalizeDiaryText(data, language)
}

export async function getDiaryForEdit(id) {
    const data = await fetchJson(`/api/diary/edit/${id}${buildDiaryQuery()}`)
    return normalizeDiaryEdit(assertApiSuccess(data, '加载日记编辑内容失败'))
}

export async function updateDiary(id, payload) {
    const data = await fetchJson(`/api/diary/edit/${id}${buildDiaryQuery()}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    return normalizeDiaryEdit(assertApiSuccess(data, '保存日记失败'))
}

function normalizeNearbyEntity(value) {
    const unwrapped = unwrapMaybe(value)
    if (!unwrapped) return null

    return {
        id: unwrapped.id ?? null,
        date: unwrapped.date ?? '',
        sort: unwrapped.sort ?? ''
    }
}

export function normalizeNearby(payload) {
    if (!payload) return {prev: null, next: null}

    return {
        prev: normalizeNearbyEntity(payload.left),
        next: normalizeNearbyEntity(payload.right)
    }
}

export async function getNearbyDiaries(id, view = 'stranger') {
    const data = await fetchJson(`/api/diary/item/nearby/${id}${buildDiaryQuery(view)}`)
    return normalizeNearby(data)
}

export function formatDateLabel(value) {
    if (!value) return ''
    return String(value).slice(0, 10)
}

export function formatDateTimeLabel(value) {
    if (!value) return ''
    return String(value).replace('T', ' ').slice(0, 19)
}
