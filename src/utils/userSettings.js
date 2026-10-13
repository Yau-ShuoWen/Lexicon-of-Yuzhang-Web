const STORAGE_KEY = 'yuzhang-user-settings'

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
  window.dispatchEvent(new CustomEvent('yuzhang-settings-change', {detail: settings}))
}

