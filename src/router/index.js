// index.js

import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'

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

            // 开发者模式
            {
                path: 'dev',
                name: 'developer',
                component: () => import('../views/Personal/LayoutBlog.vue'),
                redirect: to => {
                    return {path: `/${to.params.language}/${to.params.dialect}/dev/home`}
                },
                children: [
                    // 登陆
                    {
                        path: 'login',
                        name: 'Login',
                        component: () => import('../views/Developer/Login.vue')
                    },
                    {
                        path: 'profile',
                        name: 'Profile',
                        component: () => import('../views/Developer/Profile.vue'),
                        meta: {requiresAuth: true}
                    },

                    {
                        path: 'home',
                        name: 'DevHome',
                        component: () => import('../views/Developer/DevHome.vue'),
                        meta: {requiresAuth: true}
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
                        path: 'tool/special-symbol',
                        name: 'specialSymbol',
                        component: () => import('../views/Developer/Tool/SpecialSymbol.vue')
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
                ]
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
                    {
                        path: 'alphabet',
                        name: 'AlphabetCatalog',
                        component: () => import('../views/Personal/AlphabetCatalog.vue')
                    },
                    {
                        path: 'alphabet/:code',
                        name: 'Alphabet',
                        component: () => import('../views/Personal/AlphabetTable.vue'),
                    },
                    {
                        path: 'diary',
                        name: 'DiaryHome',
                        component: () => import('../views/Diary/DiaryHome.vue')
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

        return next(`/${language}/${dialect}/home`)
    }

    // ==============================
    // ❗关键修复：排除 login 页面
    // ==============================
    if (to.name === 'Login') {
        return next()
    }

    // ===== 2. 只保护 dev 下非 login =====
    const isDevRoute = to.path.includes('/dev/')

    if (!isDevRoute) {
        return next()
    }

    // ===== 3. dev 模块统一鉴权 =====
    const token = localStorage.getItem('auth-token')

    // ❌ 没 token → 直接去 login（关键修复点）
    if (!token) {

        return next({
            name: 'Login',
            params: {
                language: to.params.language,
                dialect: to.params.dialect
            }
        })
    }

    // ===== 4. 校验 token =====
    try {

        const res = await axios.get('/api/user/check-auth', {
            params: { t: token }
        })

        if (res.data.success) {

            // ✅ 放行
            return next()
        }

    } catch (e) {
        console.error(e)
    }

    // ===== 5. token 失效处理 =====
    localStorage.removeItem('auth-token')

    return next({
        name: 'Login',
        params: {
            language: to.params.language,
            dialect: to.params.dialect
        }
    })
})


export default router
