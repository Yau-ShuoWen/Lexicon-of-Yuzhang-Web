const DEFAULT_LIMIT = 50

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
    abridge: localizeValue(item?.abridge, language),
    startDate: item?.startDate ?? '',
    finalizeDate: item?.finalizeDate ?? '',
    updatedTime: item?.updatedTime ?? ''
  }
}

export function normalizeDiaryText(payload, language = 'sc') {
  const raw = unwrapMaybe(payload)
  if (!raw) return null

  return {
    id: raw.id ?? null,
    date: raw.date ?? '',
    content: localizeValue(raw.content, language),
    abridge: localizeValue(raw.abridge, language),
    startDate: raw.startDate ?? '',
    finalizeDate: raw.finalizeDate ?? '',
    createdTime: raw.createdTime ?? '',
    updatedTime: raw.updatedTime ?? ''
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

export async function getDiaryCatalog() {
  const data = await fetchJson('/api/diary/catalog')
  return normalizeCatalog(data)
}

export async function getRecentDiaries(language, limit = DEFAULT_LIMIT) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))

  const data = await fetchJson(`/api/diary/recent/${language}?${params.toString()}`)
  return Array.isArray(data) ? data.map(item => normalizeDigest(item, language)) : []
}

export async function queryDiaries(language, filters = {}) {
  const params = new URLSearchParams()

  if (filters.year) params.set('year', String(filters.year))
  if (filters.month) params.set('month', String(filters.month))
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  params.set('limit', String(filters.limit || DEFAULT_LIMIT))

  const data = await fetchJson(`/api/diary/query/${language}?${params.toString()}`)
  return Array.isArray(data) ? data.map(item => normalizeDigest(item, language)) : []
}

export async function getDiaryByDate(language, date) {
  const data = await fetchJson(`/api/diary/item/${language}/date/${date}`)
  return normalizeDiaryText(data, language)
}

export async function getDiaryById(language, id) {
  const data = await fetchJson(`/api/diary/item/${language}/id/${id}`)
  return normalizeDiaryText(data, language)
}

export function formatDateLabel(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function formatDateTimeLabel(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 19)
}
