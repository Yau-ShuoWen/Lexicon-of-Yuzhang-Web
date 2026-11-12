import { request } from './request.js'

const url = (path, token, extra = {}) => {
  const query = new URLSearchParams({ t: token, ...extra })
  return `/api/admin/users${path}?${query}`
}

export const searchAdminUsers = (token, keyword) => request(url('', token, { keyword }))
export const listAdminUsers = (token, afterId = 0) => request(url('/list', token, { afterId }))
export const getAdminUser = (token, id) => request(url(`/${id}`, token))
export const updateAdminUserAccount = (token, id, account) => request(url(`/${id}/account`, token), {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account)
})
export const updateAdminUserSettings = (token, id, settings) => request(url(`/${id}/settings`, token), {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
})
