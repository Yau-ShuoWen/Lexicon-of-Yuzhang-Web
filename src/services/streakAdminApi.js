import { request } from './request.js'

function endpoint(path, params) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => query.set(key, value))
    return `/api/admin/study/streak${path}?${query.toString()}`
}

export const searchStreakUsers = (token, keyword) =>
    request(endpoint('/users', {t: token, keyword}))

export const getStreakOverview = (token, userId, from, to) =>
    request(endpoint(`/${userId}/overview`, {t: token, from, to}))

export const updateStreakRecord = (token, userId, date, status) =>
    request(endpoint(`/${userId}/record`, {t: token}), {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({date, status})
    })
