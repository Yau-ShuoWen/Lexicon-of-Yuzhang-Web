export const HTTP_CODE = {
    NOT_FOUND: 404,
    NOT_LOGIN: 401,
    NO_PERMISSION: 403
}

export class APIError extends Error {
    constructor(message, code = 0, status = 0, kind = 'api') {
        super(message)
        this.name = 'APIError'
        this.code = code
        this.status = status
        this.kind = kind
    }
}

const AUTH_TOKEN_KEY = 'auth-token'

function prepareOptions(options) {
    const headers = new Headers(options.headers || {})
    const token = localStorage.getItem(AUTH_TOKEN_KEY)

    if (token && !headers.has('X-Auth-Token')) {
        headers.set('X-Auth-Token', token)
    }

    return {...options, headers}
}

/**
 * 统一完成请求、JSON 解析和 APIResponse 解包。
 * 迁移期间遇到旧接口的裸数据时，会直接返回原数据。
 */
export async function request(url, options = {}) {
    const {timeout = 0, ...fetchOptions} = options
    const timeoutController = timeout > 0 ? new AbortController() : null
    const externalSignal = fetchOptions.signal
    const canCombineSignals = externalSignal && timeoutController && typeof AbortSignal.any === 'function'
    const signal = canCombineSignals
        ? AbortSignal.any([externalSignal, timeoutController.signal])
        : externalSignal || timeoutController?.signal
    let timedOut = false
    const timeoutId = timeoutController
        ? setTimeout(() => {
            timedOut = true
            timeoutController.abort()
        }, timeout)
        : null
    let response

    try {
        response = await fetch(url, prepareOptions({...fetchOptions, signal}))
    } catch (error) {
        if (error?.name === 'AbortError') {
            if (timedOut) throw new APIError('请求超时', 0, 0, 'timeout')
            throw error
        }
        throw new APIError(error.message || '网络连接失败', 0, 0, 'network')
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
    }

    let result = null
    if (response.status !== 204) {
        try {
            result = await response.json()
        } catch (error) {
            if (response.ok) {
                throw new APIError('服务器响应格式错误', 0, response.status, 'protocol')
            }
        }
    }

    if (!response.ok) {
        throw new APIError(
            result?.message || `请求失败（${response.status}）`,
            result?.code || response.status,
            response.status
        )
    }

    if (typeof result?.success === 'boolean') {
        if (!result.success) {
            throw new APIError(
                result.message || '请求失败',
                result.code || response.status,
                response.status
            )
        }
        return result.data
    }

    return result
}

export function isBackendUnavailableError(error) {
    return error instanceof APIError
        && (error.kind === 'network' || error.kind === 'timeout' || error.status >= 500)
}
