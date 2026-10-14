import { onBeforeUnmount, reactive } from 'vue'

const STORAGE_KEY = 'yuzhang-user-settings'
const SETTINGS_CHANGE_EVENT = 'yuzhang-settings-change'

export const DEFAULT_USER_SETTINGS = Object.freeze({
  languageStyle: 'sc',
  mandarinNotation: 'pinyin',
  dialectNotations: ['mandarinApproximation', 'standard', 'keyboard', 'alternate', 'dictionaryIpa', 'referenceIpa'],
  pinnedDialectNotation: 'mandarinApproximation',
  soundEnabled: true,
  weekdayStyle: 'weekday'
})

const DIALECT_NOTATIONS = new Set(DEFAULT_USER_SETTINGS.dialectNotations)
const VALID_VALUES = {
  languageStyle: new Set(['sc', 'tc']),
  mandarinNotation: new Set(['pinyin', 'zhuyin', 'parallel']),
  weekdayStyle: new Set(['weekday', 'youbi'])
}

export function getUserSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const dialectNotations = Array.isArray(stored.dialectNotations)
      ? stored.dialectNotations.filter(item => DIALECT_NOTATIONS.has(item))
      : [...DEFAULT_USER_SETTINGS.dialectNotations]
    const pinnedDialectNotation = dialectNotations.includes(stored.pinnedDialectNotation)
      ? stored.pinnedDialectNotation
      : dialectNotations[0] || DEFAULT_USER_SETTINGS.pinnedDialectNotation

    return {
      languageStyle: VALID_VALUES.languageStyle.has(stored.languageStyle) ? stored.languageStyle : DEFAULT_USER_SETTINGS.languageStyle,
      mandarinNotation: VALID_VALUES.mandarinNotation.has(stored.mandarinNotation) ? stored.mandarinNotation : DEFAULT_USER_SETTINGS.mandarinNotation,
      dialectNotations,
      pinnedDialectNotation,
      soundEnabled: typeof stored.soundEnabled === 'boolean' ? stored.soundEnabled : DEFAULT_USER_SETTINGS.soundEnabled,
      weekdayStyle: VALID_VALUES.weekdayStyle.has(stored.weekdayStyle) ? stored.weekdayStyle : DEFAULT_USER_SETTINGS.weekdayStyle
    }
  } catch {
    return {...DEFAULT_USER_SETTINGS, dialectNotations: [...DEFAULT_USER_SETTINGS.dialectNotations]}
  }
}

export function saveUserSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, {detail: settings}))
}

export function getUserSetting(key) {
  if (!(key in DEFAULT_USER_SETTINGS)) return undefined
  return getUserSettings()[key]
}

export function subscribeUserSettings(listener) {
  const handleSettingsChange = event => listener(event?.detail || getUserSettings())
  const handleStorageChange = event => {
    if (event.key === STORAGE_KEY) listener(getUserSettings())
  }

  window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange)
  window.addEventListener('storage', handleStorageChange)
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}

export function useUserSettings() {
  const settings = reactive(getUserSettings())
  const unsubscribe = subscribeUserSettings(value => {
    for (const [key, nextValue] of Object.entries(value)) {
      if (key === 'dialectNotations') {
        if (settings.dialectNotations.join('\0') !== nextValue.join('\0')) {
          settings.dialectNotations = [...nextValue]
        }
      } else if (settings[key] !== nextValue) {
        settings[key] = nextValue
      }
    }
  })
  onBeforeUnmount(unsubscribe)
  return settings
}

