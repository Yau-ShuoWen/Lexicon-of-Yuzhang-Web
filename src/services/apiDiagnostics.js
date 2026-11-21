import { ref } from 'vue'

const STORAGE_KEY = 'api-diagnostics-v1'
const ENABLED_KEY = 'api-diagnostics-enabled'
const MAX_ENTRIES = 35

export const apiDiagnosticsEnabled = ref(localStorage.getItem(ENABLED_KEY) === '1')

export function setApiDiagnosticsEnabled(enabled) {
  apiDiagnosticsEnabled.value = Boolean(enabled)
  try { localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0') } catch { /* ignore */ }
}

function restore() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.slice(-MAX_ENTRIES) : []
  } catch {
    return []
  }
}

export const diagnosticEntries = ref(restore())

export function recordDiagnostic(entry) {
  const currentToken = localStorage.getItem('auth-token')
  const safeEntry = {...entry}
  if (safeEntry.message) {
    safeEntry.message = String(safeEntry.message).replace(/([?&]t=)[^&\s]+/gi, '$1[已隐藏]')
    if (currentToken) safeEntry.message = safeEntry.message.split(currentToken).join('[已隐藏]')
  }
  const next = [...diagnosticEntries.value, {
    time: new Date().toLocaleString(),
    page: location.pathname,
    ...safeEntry
  }].slice(-MAX_ENTRIES)
  diagnosticEntries.value = next
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 存储不可用时仍可截图 */ }
}

export function clearDiagnostics() {
  diagnosticEntries.value = []
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export function safeRequestPath(url) {
  try {
    const parsed = new URL(url, location.origin)
    return `${parsed.pathname}${parsed.searchParams.has('view') ? `?view=${parsed.searchParams.get('view')}` : ''}`
  } catch {
    return String(url).split('?')[0]
  }
}
