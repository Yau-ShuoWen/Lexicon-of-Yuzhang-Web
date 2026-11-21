import { ref } from 'vue'
import { HTTP_CODE, request } from '../services/request.js'
import { recordDiagnostic } from '../services/apiDiagnostics.js'

const AUTH_TOKEN_KEY = 'auth-token'
const AUTH_USER_KEY = 'auth-user'
const AUTH_CHECK_TIMEOUT_MS = 3_000
const AUTH_RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1_000

const isAuthenticated = ref(false)
const user = ref(null)
const token = ref(localStorage.getItem(AUTH_TOKEN_KEY) || '')

const readStoredUser = () => {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch (e) {
        return null
    }
}

user.value = readStoredUser()
const getStoredUser = () => token.value ? user.value : null
let authGeneration = 0

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
    recordDiagnostic({type: '登录状态', status: '清除本地登录', tokenPresent: !!token.value})
    authGeneration += 1
    isAuthenticated.value = false
    user.value = null
    token.value = ''
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
}

const saveAuth = (userData, userToken) => {
    recordDiagnostic({type: '登录状态', status: '验证成功', tokenPresent: !!userToken,
        diaryLevel: Array.isArray(userData?.permissions) ? userData.permissions.filter(p => String(p).startsWith('diary.read.')).join(', ') : ''})
    authGeneration += 1
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
    recordDiagnostic({type: '登录状态', status: '验证失败，保留本地资料', tokenPresent: !!savedToken,
        code: error?.code || 0, httpStatus: error?.status || 0,
        kind: error?.kind || '', message: error?.message || ''})
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
    if (!savedToken) {
        clearAuth()
        return
    }
    const generation = authGeneration
    const isCurrent = () => generation === authGeneration && localStorage.getItem(AUTH_TOKEN_KEY) === savedToken
    try {
        // 每次读取最新资料，避免旧权限和缓存的验证结果长期留在客户端。
        const profile = await request(`/api/user/me?t=${encodeURIComponent(savedToken)}`, {
            timeout: AUTH_CHECK_TIMEOUT_MS, cache: 'no-store'
        })
        if (!isCurrent()) return
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return
        saveAuth(profile, savedToken)
    } catch (error) {
        if (!isCurrent()) return
        const code = error.code || error.status
        if (code === HTTP_CODE.NOT_LOGIN) clearAuth()
        else preserveAuthForBackendUnavailable(savedToken, readStoredUser(), error)
    }
}

const logout = async () => {
    const currentToken = localStorage.getItem(AUTH_TOKEN_KEY)
    // 旧退出请求返回时不能清除后来登录的新会话。
    clearAuth()
    if (currentToken) {
        try {
            await request(`/api/user/logout?t=${encodeURIComponent(currentToken)}`, {
                headers: {'X-Auth-Token': currentToken}, cache: 'no-store'
            })
        } catch (error) {
            console.error('退出登录失败:', error)
        }
    }
}

let authSyncInstalled = false
const installAuthSync = () => {
    if (authSyncInstalled) return
    authSyncInstalled = true
    let checking = false
    let checkedAt = 0
    const revalidate = () => {
        if (document.visibilityState === 'hidden' || checking || Date.now() - checkedAt < 15_000) return
        checking = true
        checkedAt = Date.now()
        void initializeAuth().finally(() => { checking = false })
    }
    window.addEventListener('storage', event => {
        if (event.key !== null && ![AUTH_TOKEN_KEY, AUTH_USER_KEY].includes(event.key)) return
        authGeneration += 1
        token.value = localStorage.getItem(AUTH_TOKEN_KEY) || ''
        user.value = token.value ? readStoredUser() : null
        isAuthenticated.value = false
        void initializeAuth()
    })
    window.addEventListener('focus', revalidate)
    window.addEventListener('pageshow', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    window.setInterval(revalidate, AUTH_RECHECK_INTERVAL_MS)
}

const isLoggedIn = () => !!token.value

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
    installAuthSync,
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
