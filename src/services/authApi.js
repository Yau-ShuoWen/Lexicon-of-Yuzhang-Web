import { request } from './request.js'

function withQuery(path, params) {
    const query = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.set(key, value)
    })

    return `${path}?${query.toString()}`
}

const post = (path, params) => request(withQuery(path, params), {method: 'POST'})

export const loginByUsername = (username, password) =>
    post('/api/user/login', {username, password})

export const loginByPhone = (phone, password) =>
    post('/api/user/login-by-phone', {phone, password})

export const loginByCode = (phone, code) =>
    post('/api/user/login-by-code', {phone, code})

export const getCurrentUser = (token) =>
    request(withQuery('/api/user/me', {t: token}))

export const createVerificationCode = (phone) =>
    post('/api/user/code/create', {phone})

export const getRecentVerificationCodes = (phone, limit = 5) =>
    request(withQuery('/api/user/code/recent', {phone, limit}))

export const updateUsername = (token, newUsername) =>
    post('/api/user/update-username', {t: token, newUsername})

export const updatePassword = (token, oldPassword, newPassword) =>
    post('/api/user/update-password', {t: token, oldPassword, newPassword})

export const getAdminDashboard = (token) =>
    request(withQuery('/api/admin/dashboard', {t: token}))
