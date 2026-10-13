import { ref } from 'vue'
import { HTTP_CODE, isBackendUnavailableError, request } from '../services/request.js'

const AUTH_TOKEN_KEY = 'auth-token'
const AUTH_USER_KEY = 'auth-user'
const AUTH_CHECK_TIMEOUT_MS = 3_000

const isAuthenticated = ref(false)
const user = ref(null)
const token = ref(localStorage.getItem(AUTH_TOKEN_KEY) || '')

const getStoredUser = () => {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch (e) {
        return null
    }
}

const getUserPermissions = () => {
    const currentUser = getStoredUser()
    if (!currentUser) return []

    if (Array.isArray(currentUser.permissions)) {
        return currentUser.permissions
            .filter(Boolean)
            .map(item => String(item).trim().toLowerCase())
    }

    if (typeof currentUser.authority === 'string' && currentUser.authority.trim()) {
        try {
            const parsed = JSON.parse(currentUser.authority)
            if (Array.isArray(parsed)) {
                return parsed
                    .filter(Boolean)
                    .map(item => String(item).trim().toLowerCase())
            }
        } catch (e) {
            return currentUser.authority
                .replace(/[\[\]'"'"'"\s]/g, ' ')
                .split(/[,\s]+/)
                .map(item => item.trim().toLowerCase())
                .filter(Boolean)
        }
    }

    return []
}

const isAdminUser = (currentUser = null) => {
    const candidate = currentUser || getStoredUser()
    if (!candidate) return false

    if (candidate.admin === true) {
        return true
    }

    const permissions = Array.isArray(candidate.permissions)
        ? candidate.permissions
            .filter(Boolean)
            .map(item => String(item).trim().toLowerCase())
        : (() => {
            if (typeof candidate.authority !== 'string' || !candidate.authority.trim()) {
                return []
            }

            try {
                const parsed = JSON.parse(candidate.authority)
                if (Array.isArray(parsed)) {
                    return parsed
                        .filter(Boolean)
                        .map(item => String(item).trim().toLowerCase())
                }
            } catch (e) {
                return candidate.authority
                    .replace(/[\[\]'"'"'"\s]/g, ' ')
                    .split(/[,\s]+/)
                    .map(item => item.trim().toLowerCase())
                    .filter(Boolean)
            }

            return []
        })()

    return permissions.includes('admin.access') || permissions.includes('admin')
}

const getDiaryVisibilityLevel = () => {
    const permissions = getUserPermissions()
    if (permissions.includes('diary.read.private')) return 3
    if (permissions.includes('diary.read.protected')) return 2
    if (permissions.includes('diary.read.public')) return 1
    return 0
}

const hasPermission = (permission) => {
    if (!permission) return false
    const target = String(permission).trim().toLowerCase()
    const currentUser = getStoredUser()
    const permissions = getUserPermissions()
    return isAdminUser(currentUser)
        || permissions.includes(target)
}

const clearAuth = () => {
    isAuthenticated.value = false
    user.value = null
    token.value = ''
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
}

const saveAuth = (userData, userToken) => {
    isAuthenticated.value = true
    user.value = userData
    token.value = userToken
    localStorage.setItem(AUTH_TOKEN_KEY, userToken)
    if (userData) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData))
    } else {
        localStorage.removeItem(AUTH_USER_KEY)
    }
}

const preserveAuthForBackendUnavailable = (savedToken, savedUser, error = null) => {
    // 后端暂时不可用不等于 Token 失效，保留登录状态，等待后端恢复后再次验证。
    isAuthenticated.value = true
    token.value = savedToken
    user.value = savedUser
    if (error) {
        console.warn('后端暂时不可用，保留当前登录状态:', error.message || error)
    }
}

const initializeAuth = async () => {
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    const savedUser = getStoredUser()

    if (!savedToken) {
        clearAuth()
        return
    }

    try {
        await request(`/api/user/check-auth?t=${encodeURIComponent(savedToken)}`, {
            timeout: AUTH_CHECK_TIMEOUT_MS
        })

        isAuthenticated.value = true
        token.value = savedToken
        user.value = savedUser
        if (!savedUser) {
            const profile = await request(`/api/user/me?t=${encodeURIComponent(savedToken)}`, {
                timeout: AUTH_CHECK_TIMEOUT_MS
            })
            if (profile) {
                localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile))
                user.value = profile
            }
        }
        return
    } catch (error) {
        const code = error.code || error.status

        if (isBackendUnavailableError(error) || code !== HTTP_CODE.NOT_LOGIN) {
            preserveAuthForBackendUnavailable(savedToken, savedUser, error)
            return
        }

        console.error('验证登录状态失败:', error)
    }

    clearAuth()
}

const logout = async () => {
    const currentToken = token.value || localStorage.getItem(AUTH_TOKEN_KEY)
    if (currentToken) {
        try {
            await request(`/api/user/logout?t=${encodeURIComponent(currentToken)}`)
        } catch (error) {
            console.error('退出登录失败:', error)
        }
    }
    clearAuth()
}

const isLoggedIn = () => !!localStorage.getItem(AUTH_TOKEN_KEY)

const getToken = () => localStorage.getItem(AUTH_TOKEN_KEY)

const getUsername = () => {
    const currentUser = user.value || getStoredUser()
    return currentUser?.username || ''
}

export {
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    isAuthenticated,
    user,
    token,
    initializeAuth,
    saveAuth,
    clearAuth,
    logout,
    isLoggedIn,
    getToken,
    getUsername,
    getStoredUser,
    getUserPermissions,
    isAdminUser,
    getDiaryVisibilityLevel,
    hasPermission
}
