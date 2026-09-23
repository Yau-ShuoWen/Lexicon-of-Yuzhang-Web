import { computed } from 'vue'
import { useHead } from '@vueuse/head'

const SITE_NAME = '豫章词'
const DEFAULT_DESCRIPTION = '豫章词收录南昌话汉字、词语、读音、释义与相关语言资料。'

// 这些页面对普通访客有用，但不应作为搜索结果的独立入口。
const NOINDEX_PATHS = [
  /\/dev(?:\/|$)/,
  /\/dev-hidden(?:\/|$)/,
  /\/login(?:\/|$)/,
  /\/admin-login(?:\/|$)/,
  /\/study(?:\/|$)/,
  /\/dict\/search(?:\/|$)/,
  /\/ysw\/diary\/edit(?:\/|$)/
]

function normalizedSiteUrl() {
  const configured = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '')
  if (configured) return configured
  return typeof window === 'undefined' ? '' : window.location.origin
}

function canonicalPath(route) {
  // 查询参数不参与 canonical，避免同一内容产生大量重复 URL。
  return route.path.replace(/\/+$/, '') || '/'
}

export function useSiteSeo(route) {
  const noindex = computed(() => NOINDEX_PATHS.some(pattern => pattern.test(route.path)))
  const canonical = computed(() => `${normalizedSiteUrl()}${canonicalPath(route)}`)
  const htmlLang = computed(() => route.params.language === 'tc' ? 'zh-Hant' : 'zh-CN')

  useHead({
    htmlAttrs: { lang: htmlLang },
    titleTemplate: title => title && title.includes(SITE_NAME) ? title : `${title || SITE_NAME} | ${SITE_NAME}`,
    link: [
      { key: 'canonical', rel: 'canonical', href: canonical }
    ],
    meta: [
      { key: 'description', name: 'description', content: DEFAULT_DESCRIPTION },
      { key: 'robots', name: 'robots', content: computed(() => noindex.value ? 'noindex, nofollow' : 'index, follow') },
      { key: 'og-site-name', property: 'og:site_name', content: SITE_NAME },
      { key: 'og-title', property: 'og:title', content: SITE_NAME },
      { key: 'og-description', property: 'og:description', content: DEFAULT_DESCRIPTION },
      { key: 'og-type', property: 'og:type', content: 'website' },
      { key: 'og-url', property: 'og:url', content: canonical }
    ]
  })
}

