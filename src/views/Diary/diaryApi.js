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

async function fetchJson(url) {
    const response = await fetch(url)
    const json = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(json?.message || `HTTP错误: ${response.status}`)
    }

    return json
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
