import { useRoute, useRouter } from 'vue-router'

const LANGUAGE_STORAGE_KEY = 'user-language'
const VALID_LANGUAGES = new Set(['sc', 'tc'])

export function getLanguageFromPath(path) {
  const language = path.split('/').filter(Boolean)[0]
  return VALID_LANGUAGES.has(language) ? language : null
}

export function useLanguageSwitcher() {
  const route = useRoute()
  const router = useRouter()

  const currentLanguageInRoute = () => getLanguageFromPath(route.path)

  const changeLanguage = async (language, { reload = false } = {}) => {
    if (!VALID_LANGUAGES.has(language)) return false

    const segments = route.path.split('/').filter(Boolean)
    if (currentLanguageInRoute()) segments[0] = language
    else segments.unshift(language)

    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    const target = {
      path: `/${segments.join('/')}`,
      query: route.query,
      hash: route.hash
    }

    if (reload) {
      window.location.assign(router.resolve(target).href)
      return true
    }

    if (language === currentLanguageInRoute()) return false
    await router.push(target)
    return true
  }

  return { currentLanguageInRoute, changeLanguage }
}
