// index.js

import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import { AUTH_TOKEN_KEY, clearAuth, hasPermission, isAdminUser, saveAuth } from '../utils/auth'
import { isBackendUnavailableError } from '../services/networkRecovery.js'

const VALID_LANGUAGES = ['sc', 'tc'] // 两门语言：简体中文、繁体中文（不区分地区）
const VALID_DIALECTS = ['lac', "ced"]       // 一门方言：南昌话

const DEFAULT_LANGUAGE = 'sc'
const DEFAULT_DIALECT = 'lac'

const routes = [
    {
        path: '/:language(sc|tc)/:dialect(lac|ced)',
        component: () => import('../layouts/LayoutWithLD.vue'),
        redirect: to => {
            return {path: `/${to.params.language}/${to.params.dialect}/home`}
        },
        children: [
            // 字典
            {
                path: 'dict',
                name: 'dictionary',
                component: () => import('../views/Personal/LayoutBlog.vue'),
                redirect: to => {
                    return {path: `/${to.params.language}/${to.params.dialect}/dict/home`}
                },
                children: [
                    {
                        path: 'home',
                        name: 'Home',
                        component: () => import('../views/HomePage.vue')
                    },
                    {
                        path: 'pinyin',
                        name: 'PinyinTable',
                        component: () => import('../views/Pinyin/PinyinTable.vue')
                    },
                    {
                        path: 'about',
                        name: 'About',
                        component: () => import('../views/AboutPage.vue')
                    },
                    // 教程
                    {
                        path: 'tutorial',
                        name: 'Tutorial',
                        component: () => import('../views/Tutorial/TutorialHome.vue')
                    },
                    {
                        path: 'article/:id?',
                        name: 'Article',
                        component: () => import('../views/Tutorial/ArticlePage.vue')
                    },

                    // 查询
                    {
                        path: 'search',
                        name: 'Search',
                        component: () => import('../views/Search/SearchResult.vue')
                    },
                    {
                        path: 'h/:query',
                        name: 'HanziDetail',
                        component: () => import('../views/Search/HanziDetail.vue'),
                        props: true
                    },
                    {
                        path: 'c/:query',
                        name: 'CiyuDetail',
                        component: () => import('../views/Search/CiyuDetail.vue'),
                        props: true
                    },
                ]
            },

            // 学习
            {
                path: 'study',
                name: 'study',
                component: () => import('../views/Personal/LayoutBlog.vue'),
                redirect: to => `/${to.params.language}/${to.params.dialect}/study/me`,
                children: [
                    {
                        path: 'me',
                        name: 'StudyMe',
                        component: () => import('../views/Study/StudyHome.vue'),
                        meta: {requiresAuth: true}
                    },
                    {
                        path: 'question',
                        name: 'StudyQuestion',
                        component: () => import('../views/Study/Question.vue'),
                        meta: {requiresAuth: true}
                    },
                    {
                        path: 'profile',
                        name: 'StudyProfile',
                        component: () => import('../views/Study/ProfileHome.vue'),
                        meta: {requiresAuth: true}
                    },
                    {
                        path: 'profile/username',
                        name: 'StudyProfileUsername',
                        component: () => import('../views/Study/EditUsername.vue'),
                        meta: {requiresAuth: true}
                    },
                    {
                        path: 'profile/password',
                        name: 'StudyProfilePassword',
                        component: () => import('../views/Study/EditPassword.vue'),
                        meta: {requiresAuth: true}
                    }
                ]
            },

            // 开发者模式
            {
                path: 'dev',
                name: 'developer',
                component: () => import('../views/Personal/LayoutBlog.vue'),
                redirect: to => {
                    return {path: `/${to.params.language}/${to.params.dialect}/dev/home`}
                },
                children: [
                    {
                        path: 'home',
                        name: 'DevHome',
                        component: () => import('../views/Developer/DevHome.vue'),
                        meta: {requiresAuth: true, requiresAdmin: true}
                    },
                    {
                        path: 'profile',
                        name: 'Profile',
                        component: () => import('../views/Developer/Profile.vue'),
                        meta: {requiresAuth: true, requiresAdmin: true}
                    },
                    {
                        path: 'admin',
                        name: 'AdminDashboard',
                        component: () => import('../views/Developer/AdminDashboard.vue'),
                        meta: {requiresAuth: true, requiresAdmin: true}
                    },

                    // 测试
                    {
                        path: 'test',
                        name: 'Test',
                        component: () => import('../views/Developer/Tool/TestPage.vue')
                    },
                    {
                        path: 'test/sc-tc',
                        name: 'TestSimplifiedAndTraditional',
                        component: () => import('../views/Developer/Tool/TestScTc.vue')
                    },
                    {
                        path: 'test/pinyin-ipa',
                        name: 'TestPinyinAndIPA',
                        component: () => import('../views/Developer/Tool/TestPinyinIPA.vue')
                    },
                    {
                        path: 'test/audio',
                        name: 'TestAudio',
                        component: () => import('../views/Developer/Tool/TestAudio.vue')
                    },
                    {
                        path: 'test/oss',
                        name: 'TestOss',
                        component: () => import('../views/Developer/Tool/TestOss.vue')
                    },

                    {
                        path: 'tool/special-symbol',
                        name: 'specialSymbol',
                        component: () => import('../views/Developer/Tool/SpecialSymbol.vue')
                    },
                    {
                        path: 'tool/text-diff',
                        name: 'TextDiffTool',
                        component: () => import('../views/Developer/Tool/TextDiffTool.vue')
                    },

                    // 漢字
                    {
                        path: 'hanzi-creator',
                        name: 'HanziCreator',
                        component: () => import('../views/Developer/Hanzi/HanziCreator.vue'),
                        //meta: { requiresAuth: true }
                    },
                    {
                        path: 'hanzi-filter',
                        name: 'HanziFilter',
                        component: () => import('../views/Developer/Hanzi/HanziFilter.vue'),
                        //meta: { requiresAuth: true }
                    },
                    {
                        path: 'hanzi-editor/:id?',
                        name: 'HanziEditor',
                        component: () => import('../views/Developer/Hanzi/HanziEditor.vue'),
                        props: true,
                        // meta: { requiresAuth: true }
                    },

                    {
                        path: 'ciyu-creator',
                        name: 'CiyuCreator',
                        component: () => import('../views/Developer/Ciyu/CiyuCreator.vue'),
                        //meta: { requiresAuth: true }
                    },
                    {
                        path: 'ciyu-filter',
                        name: 'CiyuFilter',
                        component: () => import('../views/Developer/Ciyu/CiyuFilter.vue'),
                        //meta: { requiresAuth: true }
                    },
                    {
                        path: 'ciyu-editor/:id?',
                        name: 'CiyuEditor',
                        component: () => import('../views/Developer/Ciyu/CiyuEditor.vue'),
                        props: true,
                        // meta: { requiresAuth: true }
                    },

                    {
                        path: 'pinyin-editor',
                        name: 'PinyinEditor',
                        component: () => import('../views/Developer/Pinyin/PinyinNoteEditor.vue'),
                    },

                    {
                        path: 'ref-filter',
                        name: 'ReferenceFilter',
                        component: () => import('../views/Developer/Ref/ReferenceFilter.vue'),
                        //  meta: { requiresAuth: true }
                    },
                    {
                        path: 'ref-editor/:dictionary/:sort?',
                        name: 'ReferenceEditor',
                        component: () => import('../views/Developer/Ref/ReferenceEditor.vue'),
                        //  meta: { requiresAuth: true }
                    },
                    {
                        path: 'study-word-card',
                        name: 'StudyWordCardFilter',
                        component: () => import('../views/Developer/Study/WordCardFilter.vue'),
                    },
                    {
                        path: 'study-word-card-editor/:id?',
                        name: 'StudyWordCardEditor',
                        component: () => import('../views/Developer/Study/WordCardEditor.vue'),
                        props: true,
                    },
                    {
                        path: 'streak-admin',
                        name: 'StreakAdmin',
                        component: () => import('../views/Developer/Study/StreakAdmin.vue'),
                        meta: {requiresAuth: true, requiresAdmin: true}
                    },
                    {
                        path: 'loading-text',
                        name: 'LoadingTextEditor',
                        component: () => import('../views/Developer/LoadingText/LoadingTextEditor.vue'),
                        meta: {requiresAuth: true, requiresAdmin: true}
                    },
                ]
            },

            {
                path: 'ysw',
                name: 'Blog',
                component: () => import('../views/Personal/LayoutBlog.vue'),
                redirect: to => {
                    return {path: `/${to.params.language}/${to.params.dialect}/ysw/alphabet`}
                },
                children: [

                    {
                        path: 'home',
                        name: 'YswHome',
                        component: () => import('../views/Personal/YswHome.vue'),
                    },


                    // 字母表
                    {
                        path: 'alphabet',
                        name: 'AlphabetCatalog',
                        component: () => import('../views/Alphabet/AlphabetCatalog.vue')
                    },

                    // 特殊页面
                    {
                        path: 'alphabet/tc-sc',
                        name: 'AlphabetTcSc',
                        component: () => import('../views/Alphabet/Alphabet-TcSc.vue'),
                    },

                    // 通用页面
                    {
                        path: 'alphabet/:code',
                        name: 'Alphabet',
                        component: () => import('../views/Alphabet/AlphabetIntroduce.vue'),
                    },
                    {
                        path: 'diary',
                        name: 'DiaryHome',
                        component: () => import('../views/Diary/DiaryHome.vue')
                    },
                    {
                        path: 'diary/edit/:id(\\d+)',
                        name: 'DiaryEditor',
                        component: () => import('../views/Diary/DiaryEditor.vue'),
                        meta: { requiresPermission: 'blog.edit' }
                    },
                    {
                        path: 'diary/:id(\\d+)',
                        name: 'DiaryDetail',
                        component: () => import('../views/Diary/DiaryDetail.vue')
                    }
                ]
            }
        ]
    },

    {
        path: '/',
        name: 'Root'
    },

    {
        path: '/:language(sc|tc)/:dialect(lac|ced)/dev-hidden',
        name: 'DevHidden',
        component: () => import('../views/Developer/DevHidden.vue')
    },

    {
        path: '/:language(sc|tc)/:dialect(lac|ced)/login',
        name: 'StudyLogin',
        component: () => import('../views/Study/StudyLogin.vue'),
        meta: {hideNav: true}
    },

    {
        path: '/:language(sc|tc)/:dialect(lac|ced)/admin-login',
        name: 'Login',
        redirect: to => `/${to.params.language}/${to.params.dialect}/login`
    },

    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }

]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach(async (to, from, next) => {

    // ===== 1. 根路径重定向=====
    if (to.path === '/') {
        let language = localStorage.getItem('user-language')
        let dialect = localStorage.getItem('user-dialect')

        if (!VALID_LANGUAGES.includes(language)) {
            language = DEFAULT_LANGUAGE
            localStorage.setItem('user-language', language)
        }

        if (!VALID_DIALECTS.includes(dialect)) {
            dialect = DEFAULT_DIALECT
            localStorage.setItem('user-dialect', dialect)
        }

        return next(`/${language}/${dialect}/dict/home`)
    }

    // 学习模块统一鉴权：未登录时回到学习区登录页，登录后可返回原目标。
    if (to.name === 'StudyLogin') {
        const token = localStorage.getItem(AUTH_TOKEN_KEY)
        if (!token) return next()

        const redirect = typeof to.query.redirect === 'string'
            && to.query.redirect.startsWith('/')
            && !to.query.redirect.startsWith('//')
            && !to.query.redirect.endsWith('/login')
            ? to.query.redirect
            : `/${to.params.language}/${to.params.dialect}/study/me`
        return next(redirect)
    }

    const isStudyRoute = to.path.includes('/study/')
    if (isStudyRoute && to.meta?.requiresAuth && !localStorage.getItem(AUTH_TOKEN_KEY)) {
        return next({
            name: 'StudyLogin',
            params: {
                language: to.params.language,
                dialect: to.params.dialect
            },
            query: {redirect: to.fullPath}
        })
    }

    if (to.meta?.requiresPermission && !hasPermission(to.meta.requiresPermission)) {
        if (to.name === 'DiaryEditor') {
            return next({
                name: 'DiaryDetail',
                params: {
                    language: to.params.language,
                    dialect: to.params.dialect,
                    id: to.params.id
                }
            })
        }
        return next(false)
    }

    // ===== 2. 只保护 dev 下非 login =====
    const isDevRoute = to.path.includes('/dev/')

    if (!isDevRoute) {
        return next()
    }

    // ===== 3. dev 模块统一鉴权 =====
    const token = localStorage.getItem(AUTH_TOKEN_KEY)

    // ❌ 没 token → 直接显示隐藏页
    if (!token) {
        return next({
            name: 'DevHidden',
            params: {
                language: to.params.language,
                dialect: to.params.dialect
            }
        })
    }

    // ===== 4. 校验 token =====
    try {

        const res = await axios.get('/api/user/check-auth', {
            params: {t: token}
        })

        if (res.data.success) {
            const userRes = await axios.get('/api/user/me', {
                params: {t: token}
            })

            if (userRes.data.success && userRes.data.data) {
                saveAuth(userRes.data.data, token)

                if (isAdminUser(userRes.data.data)) {
                    return next()
                }
            }
        }

    } catch (e) {
        const status = e.response?.status
        const isExplicitAuthFailure = status === 401 || status === 403

        if (isBackendUnavailableError(e) || !isExplicitAuthFailure) {
            // 后端暂时不可用不清除 Token，允许当前页面保留，恢复后可继续校验。
            if (isAdminUser()) return next()
            return next({
                name: 'DevHidden',
                params: {
                    language: to.params.language,
                    dialect: to.params.dialect
                }
            })
        }

        console.error(e)
    }

    // ===== 5. token 失效处理 =====
    clearAuth()

    return next({
        name: 'DevHidden',
        params: {
            language: to.params.language,
            dialect: to.params.dialect
        }
    })
})


export default router
