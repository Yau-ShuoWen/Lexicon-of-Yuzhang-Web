import axios from 'axios'

const REQUEST_TIMEOUT_MS = 12_000
const HEALTH_CHECK_TIMEOUT_MS = 3_000
const RELOAD_DELAY_MS = 800
const HEALTH_CHECK_INTERVAL_MS = 5_000
const RECOVERY_STATE_KEY = 'yuzong-network-recovery'
const SKIP_RECOVERY_FLAG = '__yuzongSkipNetworkRecovery'

let originalFetch = null
let reloadTimer = null
let healthCheckTimer = null
let reloadScheduled = false

const readRecoveryState = () => {
    try {
        const value = sessionStorage.getItem(RECOVERY_STATE_KEY)
        return value ? JSON.parse(value) : null
    } catch {
        return null
    }
}

const writeRecoveryState = () => {
    try {
        sessionStorage.setItem(RECOVERY_STATE_KEY, JSON.stringify({
            startedAt: Date.now(),
            pending: true,
        }))
    } catch {
        // 某些隐私模式下 sessionStorage 不可用，仍然允许当前请求正常失败。
    }
}

const clearRecoveryState = () => {
    try {
        sessionStorage.removeItem(RECOVERY_STATE_KEY)
    } catch {
        // 忽略存储清理失败，不影响请求结果。
    }
}

const stopHealthCheck = () => {
    if (healthCheckTimer && typeof window !== 'undefined') {
        window.clearInterval(healthCheckTimer)
        healthCheckTimer = null
    }
}

const getRequestUrl = (request) => {
    if (!request) return ''

    const rawUrl = typeof request === 'string' ? request : request.url
    if (!rawUrl || typeof window === 'undefined') return ''

    try {
        return new URL(rawUrl, window.location.href)
    } catch {
        return ''
    }
}

const isBackendRequest = (request) => {
    const url = getRequestUrl(request)
    if (!url || url.origin !== window.location.origin) return false

    return ['/api', '/upload', '/oss'].some(prefix =>
        url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    )
}

const isBackendAxiosRequest = (config) => {
    if (!config) return false

    try {
        const baseUrl = config.baseURL
            ? new URL(config.baseURL, window.location.href).toString()
            : window.location.href
        const requestUrl = new URL(config.url || '', baseUrl).toString()
        return isBackendRequest(requestUrl)
    } catch {
        return false
    }
}

// 仅表示“没有拿到可用的后端响应”。认证接口返回 200 + success:false 时，
// 仍然会被当作有效响应处理；代理断开导致的 5xx 则属于后端不可用。
export const isBackendUnavailableError = (error) => {
    if (!error || error.code === 'ERR_CANCELED') return false

    const status = error.response?.status

    // 没有 response 通常代表请求没有得到后端的 HTTP 响应；
    // Vite 代理在目标后端关闭时可能会返回 5xx，而不是抛出网络异常。
    return error.code === 'ERR_NETWORK'
        || error.code === 'ECONNABORTED'
        || error.code === 'ETIMEDOUT'
        || (status >= 500 && status <= 599)
        || !error.response
}

const reloadPage = () => {
    if (reloadScheduled || typeof window === 'undefined') return

    reloadScheduled = true
    reloadTimer = window.setTimeout(() => {
        reloadTimer = null
        window.location.reload()
    }, RELOAD_DELAY_MS)
}

const checkBackendAndReload = async () => {
    if (!originalFetch || typeof window === 'undefined') return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

    try {
        const response = await originalFetch('/api/hello', {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
            headers: {'X-YuZong-Recovery-Check': '1'},
        })

        if (response.ok) {
            clearRecoveryState()
            stopHealthCheck()
            if (reloadTimer) {
                window.clearTimeout(reloadTimer)
                reloadTimer = null
                reloadScheduled = false
            }
            window.location.reload()
        }
    } catch {
        // 后端尚未恢复，等待下一次探测。
    } finally {
        window.clearTimeout(timeoutId)
    }
}

const startHealthCheck = () => {
    if (healthCheckTimer || typeof window === 'undefined') return

    healthCheckTimer = window.setInterval(() => {
        void checkBackendAndReload()
    }, HEALTH_CHECK_INTERVAL_MS)
    void checkBackendAndReload()
}

const handleBackendFailure = () => {
    if (typeof window === 'undefined') return

    if (!readRecoveryState()) {
        writeRecoveryState()
        reloadPage()
        return
    }

    // 刷新后仍然失败时不继续连续刷新，改为低频探测，避免形成刷新死循环。
    startHealthCheck()
}

const markBackendAvailable = () => {
    if (!readRecoveryState()) return

    clearRecoveryState()
    stopHealthCheck()
    if (reloadTimer && typeof window !== 'undefined') {
        window.clearTimeout(reloadTimer)
        reloadTimer = null
        reloadScheduled = false
    }
}

const installFetchRecovery = () => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

    originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init = {}) => {
        init = init || {}
        const backendRequest = isBackendRequest(input)
        const skipRecovery = init[SKIP_RECOVERY_FLAG] === true
        const shouldWatch = backendRequest && !skipRecovery

        if (!shouldWatch) {
            return originalFetch(input, init)
        }

        const controller = new AbortController()
        let timedOut = false
        let externallyAborted = false
        const timeoutId = window.setTimeout(() => {
            timedOut = true
            controller.abort()
        }, REQUEST_TIMEOUT_MS)

        const sourceSignal = init.signal || (typeof input !== 'string' ? input.signal : null)
        const abortFromSource = () => {
            externallyAborted = true
            controller.abort()
        }

        if (sourceSignal) {
            if (sourceSignal.aborted) abortFromSource()
            else sourceSignal.addEventListener('abort', abortFromSource, {once: true})
        }

        const fetchInit = {...init, signal: controller.signal}
        delete fetchInit[SKIP_RECOVERY_FLAG]

        try {
            const response = await originalFetch(input, fetchInit)
            markBackendAvailable()
            return response
        } catch (error) {
            if (!externallyAborted && (timedOut || error?.name === 'TypeError')) {
                handleBackendFailure()
            }
            throw error
        } finally {
            window.clearTimeout(timeoutId)
            sourceSignal?.removeEventListener('abort', abortFromSource)
        }
    }
}

const installAxiosRecovery = () => {
    axios.defaults.timeout = REQUEST_TIMEOUT_MS

    axios.interceptors.response.use(
        response => {
            if (isBackendAxiosRequest(response.config)) markBackendAvailable()
            return response
        },
        error => {
            if (isBackendAxiosRequest(error.config) && isBackendUnavailableError(error)) {
                handleBackendFailure()
            }
            return Promise.reject(error)
        },
    )
}

export const installNetworkRecovery = () => {
    if (typeof window === 'undefined' || window.__yuzongNetworkRecoveryInstalled) return

    window.__yuzongNetworkRecoveryInstalled = true
    installFetchRecovery()
    installAxiosRecovery()

    if (readRecoveryState()) startHealthCheck()
}
