const DEFAULT_LOADING_TEXT = '方言是我们能听见的历史'
const CACHE_PREFIX = 'study-loading-text:'
const requests = new Map()

const cacheKey = (language, dialect) => `${CACHE_PREFIX}${language}:${dialect}`

const readCachedLoadingText = (language, dialect) => {
  try {
    return localStorage.getItem(cacheKey(language, dialect)) || DEFAULT_LOADING_TEXT
  } catch {
    return DEFAULT_LOADING_TEXT
  }
}

const refreshLoadingText = (language, dialect) => {
  const key = cacheKey(language, dialect)
  if (requests.has(key)) return requests.get(key)

  const request = fetch(`/api/study/loading-text/${language}/${dialect}`)
      .then(async response => {
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || '加载提示语失败')
        if (typeof result.data === 'string' && result.data.trim()) {
          try {
            localStorage.setItem(key, result.data)
          } catch {
            // 本地存储不可用时不影响主要加载流程。
          }
        }
      })
      .catch(error => console.warn('加载提示语更新失败：', error))
      .finally(() => requests.delete(key))

  requests.set(key, request)
  return request
}

export const prepareLoadingText = (language, dialect) => {
  const text = readCachedLoadingText(language, dialect)
  // 本次固定使用已读取的文字；请求结果只写入缓存，留给下一次加载。
  void refreshLoadingText(language, dialect)
  return text
}

export { DEFAULT_LOADING_TEXT }
