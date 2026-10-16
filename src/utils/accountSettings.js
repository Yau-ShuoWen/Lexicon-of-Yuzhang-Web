import { reactive, ref, watch } from 'vue'
import router from '../router/index.js'
import { request } from '../services/request.js'
import { token, user } from './auth.js'

const SYNC_KEY = 'yuzhang-account-settings-sync'
const CHANNEL = 'yuzhang-account-settings'
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
const LINGUISTIC_ROUTES = new Set([
  'PinyinTable', 'Search', 'HanziDetail', 'CiyuDetail', 'StudyQuestion',
  'TestPinyinAndIPA', 'HanziCreator', 'HanziFilter', 'HanziEditor',
  'CiyuCreator', 'CiyuFilter', 'CiyuEditor', 'PinyinEditor',
  'ReferenceFilter', 'ReferenceEditor', 'StudyWordCardFilter', 'StudyWordCardEditor'
])

export const pinyinSchemeRevision = ref(0)

function refreshCurrentLinguisticView() {
  const route = router.currentRoute.value
  if (route.params.dialect === 'lac' && LINGUISTIC_ROUTES.has(route.name))
    pinyinSchemeRevision.value += 1
}

export const accountSettings = reactive({
  lacLegacyPinyinReadWrite: false,
  loading: false,
  saving: false,
  version: 0,
  error: ''
})

let generation = 0
let loadedToken = ''

function announce(change) {
  if (channel) channel.postMessage(change)
  else localStorage.setItem(SYNC_KEY, JSON.stringify({...change, nonce: Date.now()}))
}

function acceptChange(data) {
  if (accountSettings.saving) return
  if (token.value && user.value?.id != null && data?.userId === user.value.id) {
    const nextValue = data.value === true
    if (nextValue === accountSettings.lacLegacyPinyinReadWrite) return
    accountSettings.lacLegacyPinyinReadWrite = nextValue
    accountSettings.version = Number(data.version) || 0
    refreshCurrentLinguisticView()
  }
}

export async function refreshAccountSettings() {
  const currentToken = token.value
  const currentGeneration = ++generation
  accountSettings.error = ''
  if (!currentToken) {
    loadedToken = ''
    accountSettings.loading = false
    accountSettings.lacLegacyPinyinReadWrite = false
    return
  }
  accountSettings.loading = true
  if (loadedToken !== currentToken) {
    accountSettings.lacLegacyPinyinReadWrite = false
    accountSettings.version = 0
  }
  try {
    const data = await request('/api/user/settings')
    if (currentGeneration !== generation || token.value !== currentToken) return
    const nextValue = data?.lacLegacyPinyinReadWrite === true
    if (loadedToken === currentToken && nextValue !== accountSettings.lacLegacyPinyinReadWrite) {
      refreshCurrentLinguisticView()
    }
    accountSettings.lacLegacyPinyinReadWrite = nextValue
    accountSettings.version = Number(data?.version) || 0
    loadedToken = currentToken
  } catch {
    if (currentGeneration === generation) accountSettings.error = '设置加载失败，请稍后重试'
  } finally {
    if (currentGeneration === generation) accountSettings.loading = false
  }
}

export async function setLegacyPinyinReadWrite(value) {
  if (typeof value !== 'boolean' || accountSettings.saving) return
  accountSettings.error = ''
  if (!token.value) {
    accountSettings.error = '登录后才能保存此设置'
    return
  }
  accountSettings.saving = true
  const currentToken = token.value
  const previousValue = accountSettings.lacLegacyPinyinReadWrite
  accountSettings.lacLegacyPinyinReadWrite = value
  try {
    const data = await request('/api/user/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({lacLegacyPinyinReadWrite: value, version: accountSettings.version})
    })
    if (token.value !== currentToken) return
    accountSettings.lacLegacyPinyinReadWrite = data?.lacLegacyPinyinReadWrite === true
    accountSettings.version = Number(data?.version) || 0
    if (user.value?.id != null) announce({userId: user.value.id, value: accountSettings.lacLegacyPinyinReadWrite, version: accountSettings.version})
    refreshCurrentLinguisticView()
  } catch {
    if (token.value === currentToken) {
      accountSettings.lacLegacyPinyinReadWrite = previousValue
      await refreshAccountSettings()
      accountSettings.error = '保存失败，请重试'
    }
  } finally {
    accountSettings.saving = false
  }
}

watch(token, () => { void refreshAccountSettings() }, {immediate: true})

channel?.addEventListener('message', event => acceptChange(event.data))

window.addEventListener('storage', event => {
  if (event.key === SYNC_KEY && event.newValue) {
    try { acceptChange(JSON.parse(event.newValue)) } catch { /* Ignore malformed tab messages. */ }
  }
})

window.addEventListener('focus', () => {
  if (token.value && !accountSettings.saving) void refreshAccountSettings()
})
