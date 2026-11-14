import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ref, computed } from 'vue'
const source = await readFile(new URL('../src/utils/auth.js', import.meta.url), 'utf8')
const exports = source.match(/export \{([\s\S]*?)\}/)[1]
const body = source.replace(/^import .*$/gm, '').replace(/export \{[\s\S]*?\}/, '') + '\nreturn {' + exports + '}'
function setup(request) {
    const values = new Map()
    const localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}
    const events = new Map()
    const window = {addEventListener: (name, fn) => events.set(name, fn)}
    const document = {visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn)}
    const auth = new Function('ref', 'HTTP_CODE', 'request', 'localStorage', 'window', 'document', body)(ref, {NOT_LOGIN: 401}, request, localStorage, window, document)
    return {auth, localStorage, events}
}
function deferred() {
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    return {promise, resolve, reject}
}
test('刷新已有资料和响应式权限，并绕过身份响应缓存', async () => {
    const {auth} = setup(async (url, options) => {
        assert.match(url, /\/api\/user\/me\?t=old/)
        assert.equal(options.cache, 'no-store')
        return {id: 1, permissions: ['diary.read.public']}
    })
    auth.saveAuth({id: 1, permissions: ['diary.read.private']}, 'old')
    const level = computed(() => auth.getDiaryVisibilityLevel())
    assert.equal(level.value, 3)
    await auth.initializeAuth()
    assert.equal(level.value, 1)
})
for (const result of ['success', '401', 'network']) {
    test('旧验证响应不能覆盖新登录：' + result, async () => {
        const pending = deferred()
        const {auth} = setup(() => pending.promise)
        auth.saveAuth({id: 1}, 'old')
        const check = auth.initializeAuth()
        auth.saveAuth({id: 2}, 'new')
        if (result === 'success') pending.resolve({id: 1})
        else pending.reject({code: result === '401' ? 401 : 0})
        await check
        assert.equal(auth.getToken(), 'new')
        assert.equal(auth.user.value.id, 2)
    })
}
test('有效会话的401清理权限，网络故障保留会话', async () => {
    let code = 0
    const {auth} = setup(async () => { throw {code} })
    auth.saveAuth({id: 1, permissions: ['diary.read.private']}, 'old')
    await auth.initializeAuth()
    assert.equal(auth.getToken(), 'old')
    code = 401
    await auth.initializeAuth()
    assert.equal(auth.getToken(), null)
    assert.equal(auth.getDiaryVisibilityLevel(), 0)
})
test('退出请求完成不能清除后续新登录', async () => {
    const pending = deferred()
    const {auth} = setup(() => pending.promise)
    auth.saveAuth({id: 1}, 'old')
    const logout = auth.logout()
    assert.equal(auth.getToken(), null)
    auth.saveAuth({id: 2}, 'new')
    pending.resolve(null)
    await logout
    assert.equal(auth.getToken(), 'new')
})
test('其他标签退出后同步清理当前页权限', () => {
    const {auth, localStorage, events} = setup(async () => null)
    auth.saveAuth({id: 1, permissions: ['diary.read.private']}, 'old')
    auth.installAuthSync()
    localStorage.removeItem('auth-token')
    localStorage.removeItem('auth-user')
    events.get('storage')({key: 'auth-token'})
    assert.equal(auth.isLoggedIn(), false)
    assert.equal(auth.getDiaryVisibilityLevel(), 0)
})
const diarySource = await readFile(new URL('../src/views/Diary/DiaryHome.vue', import.meta.url), 'utf8')
for (const kind of ['List', 'Catalog']) {
    test('日记' + kind + '旧响应不能覆盖当前视角', async () => {
        const first = deferred(), second = deferred()
        const state = ref([]), viewMode = ref('self'), token = ref('session')
        let calls = 0
        const query = () => (++calls === 1 ? first.promise : second.promise)
        const start = diarySource.indexOf('async function load' + kind + '(')
        const end = diarySource.indexOf('\nfunction ', start)
        const block = diarySource.slice(start, end)
        const name = kind === 'List' ? 'list' : 'catalog'
        const deps = {token, viewMode, language: ref('sc'), filters: ref({}), activeSearch: ref(''), listItems: state, catalog: state, queryDiaries: query, getDiaryCatalog: query, searchDiaries: query, startListLoading() {}, stopListLoading() {}, startCatalogLoading() {}, stopCatalogLoading() {}, showError() { assert.fail('旧请求不应产生错误提示') }}
        const load = new Function(...Object.keys(deps), 'let ' + name + 'Sequence = 0;\n' + block + '\nreturn load' + kind)(...Object.values(deps))
        const oldRequest = load()
        viewMode.value = 'stranger'
        const newRequest = load()
        second.resolve(['public'])
        await newRequest
        first.resolve(['private'])
        await oldRequest
        assert.deepEqual([...state.value], ['public'])
    })
}
