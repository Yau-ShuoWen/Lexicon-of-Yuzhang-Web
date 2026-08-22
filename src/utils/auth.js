import { ref } from 'vue'
import axios from 'axios'

const AUTH_TOKEN_KEY = 'auth-token'
const AUTH_USER_KEY = 'auth-user'

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

const getBlogVisibilityLevel = () => {
    const permissions = getUserPermissions()
    if (permissions.includes('blog.read.private')) return 3
    if (permissions.includes('blog.read.friends')) return 2
    if (permissions.includes('blog.read.public')) return 1
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

const initializeAuth = async () => {
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    const savedUser = getStoredUser()

    if (!savedToken) {
        clearAuth()
        return
    }

    try {
        const response = await axios.get('/api/user/check-auth', {
            params: { t: savedToken }
        })

        if (response.data?.success) {
            isAuthenticated.value = true
            token.value = savedToken
            user.value = savedUser
            if (!savedUser) {
                const profileRes = await axios.get('/api/user/me', {
                    params: { t: savedToken }
                })
                if (profileRes.data?.success && profileRes.data?.data) {
                    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profileRes.data.data))
                    user.value = profileRes.data.data
                }
            }
            return
        }
    } catch (error) {
        console.error('验证登录状态失败:', error)
    }

    clearAuth()
}

const logout = async () => {
    const currentToken = token.value || localStorage.getItem(AUTH_TOKEN_KEY)
    if (currentToken) {
        try {
            await axios.get('/api/user/logout', {
                params: { t: currentToken }
            })
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
    getBlogVisibilityLevel,
    hasPermission
}
