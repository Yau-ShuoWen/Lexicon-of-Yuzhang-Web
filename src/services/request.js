export const HTTP_CODE = {
    NOT_FOUND: 404,
    NOT_LOGIN: 401,
    NO_PERMISSION: 403
}

export class APIError extends Error {
    constructor(message, code = 0, status = 0) {
        super(message)
        this.name = 'APIError'
        this.code = code
        this.status = status
    }
}

/**
 * 统一完成请求、JSON 解析和 APIResponse 解包。
 * 迁移期间遇到旧接口的裸数据时，会直接返回原数据。
 */
export async function request(url, options = {}) {
    let response

    try {
        response = await fetch(url, options)
    } catch (error) {
        if (error?.name === 'AbortError') throw error
        throw new APIError(error.message || '网络连接失败')
    }

    const result = await response.json().catch(() => null)

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
