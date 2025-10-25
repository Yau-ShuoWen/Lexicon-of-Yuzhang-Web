// src/utils/auth.js
import { ref } from 'vue'

// 全局响应式状态
const isAuthenticated = ref(false)
const user = ref(null)
const token = ref(localStorage.getItem('token') || '')

// 初始化时检查token有效性
const initializeAuth = async () => {
    const savedToken = localStorage.getItem('token')
    const savedUsername = localStorage.getItem('username')

    if (savedToken && savedUsername) {
        try {
            const response = await fetch(`/api/checkAuth?token=${encodeURIComponent(savedToken)}`)
            const result = await response.json()

            if (result.authenticated) {
                isAuthenticated.value = true
                user.value = { username: savedUsername }
                token.value = savedToken
            } else {
                // Token无效，清除本地存储
                clearAuth()
            }
        } catch (error) {
            console.error('验证token失败:', error)
            clearAuth()
        }
    }
}

// 设置认证状态
const setAuth = (userData, userToken) => {
    isAuthenticated.value = true
    user.value = userData
    token.value = userToken
    localStorage.setItem('token', userToken)
    localStorage.setItem('username', userData.username)
}

// 清除认证状态
const clearAuth = () => {
    isAuthenticated.value = false
    user.value = null
    token.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('username')
}

// 退出登录
const logout = async () => {
    const currentToken = token.value
    if (currentToken) {
        try {
            await fetch(`/api/logout?token=${encodeURIComponent(currentToken)}`)
        } catch (error) {
            console.error('退出登录失败:', error)
        }
    }
    clearAuth()
}

// 立即初始化
initializeAuth()

export {
    isAuthenticated,
    user,
    token,
    setAuth,
    clearAuth,
    logout,
    initializeAuth
}

// src/utils/auth.js
// 认证相关的工具函数

// 检查是否已登录
export const isLoggedIn = () => {
    return !!localStorage.getItem('token')
}

// 获取当前用户token
export const getToken = () => {
    return localStorage.getItem('token')
}

// 获取当前用户名
export const getUsername = () => {
    return localStorage.getItem('username')
}

// 保存用户信息
export const saveUserInfo = (token, username) => {
    localStorage.setItem('token', token)
    localStorage.setItem('username', username)
}

// 清除用户信息
export const clearUserInfo = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
}

// 验证token有效性
export const validateToken = async () => {
    const token = getToken()
    if (!token) return false

    try {
        const response = await fetch(`/api/checkAuth?token=${encodeURIComponent(token)}`)
        const result = await response.json()
        return result.authenticated
    } catch (error) {
        console.error('Token验证失败:', error)
        return false
    }
}