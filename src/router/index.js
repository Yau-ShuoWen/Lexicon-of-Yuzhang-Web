import {createRouter, createWebHistory} from 'vue-router'
import axios from 'axios'

const VALID_LANGUAGES = ['sc', 'tc'] // 两门语言：简体中文、繁体中文（不区分地区）
const VALID_DIALECTS = ['nam']       // 一门方言：南昌话

const DEFAULT_LANGUAGE = 'sc'
const DEFAULT_DIALECT = 'nam'

const routes = [
    {
        path: '/:language(sc|tc)/:dialect(nam)',
        component: () => import('../layouts/LayoutWithLD.vue'),
        children: [
            {
                path: 'home',
                name: 'Home',
                component: () => import('../views/HomePage.vue')
            },
            {
                path: 'pinyin',
                name: 'PinyinTableWithLang',
                component: () => import('../views/PinyinTable.vue')
            },
            {
                path: 'about',
                name: 'AboutWithLangDialect',
                component: () => import('../views/AboutPage.vue')
            },

            // 开发者模式
            {
                path: 'developer-home',
                name: 'DeveloperHomeWithLang',
                component: () => import('../views/Developer/NavigationPage.vue')
            },

            // 测试
            {
                path: 'test',
                name: 'Test',
                component: () => import('../views/HelloWorld.vue')
            },
            {
                path: 'test/sc-tc',
                name: 'TestSimplifiedAndTraditional',
                component: () => import('../views/Test/TestScTc.vue')
            },
            {
                path: 'test/pinyin-ipa',
                name: 'TestPinyinAndIPA',
                component: () => import('../views/Test/TestPinyinIPA.vue')
            },

            // 编辑

            {
                path: 'hanzi-filter',
                name: 'HanziFilter',
                component: () => import('../views/Developer/HanziFilter.vue'),
                //meta: { requiresAuth: true }
            },
            {
                path: 'hanzi-editor/:id?',
                name: 'HanziEditor',
                component: () => import('../views/Developer/HanziEditor.vue'),
                props: true,
               // meta: { requiresAuth: true }
            },


            {
                path: 'ref-filter',
                name: 'ReferenceFilter',
                component: () => import('../views/Developer/ReferenceFilter.vue'),
              //  meta: { requiresAuth: true }
            },
            {
                path: 'ref-editor/:dictionary/:sort?',
                name: 'ReferenceEditor',
                component: () => import('../views/Developer/ReferenceEditor.vue'),
                //  meta: { requiresAuth: true }
            },

            // 查询
            {
                path: 'search',
                name: 'SearchWithLang',
                component: () => import('../components/SearchResult.vue')
            },
            {
                path: 'h/:hanzi',
                name: 'HanziDetailWithLang',
                component: () => import('../components/HanziDetail.vue'),
                props: true
            },
            {
                path: 'c/:ciyu',
                name: 'CiyuDetailWithLang',
                component: () => import('../components/CiyuDetail.vue'),
                props: true
            },

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
                meta: { requiresAuth: true }
            },

        ]
    },

    // 特殊路由，未来会根据方言的不同完全更换界面
    {
        path: '/:language(sc|tc)/nam',
        component: () => import('../layouts/LayoutWithLD.vue'),
        children: [
            {
                path: 'style',
                name: 'PinyinStyle',
                component: () => import('../views/Developer/NamPinyinStyle.vue')
            },
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

    // ===== 2. 鉴权路由处理，暂时真正使用 =====
    if (to.meta.requiresAuth) {
        const token = localStorage.getItem('auth-token')

        // 2.1 本地没 token
        if (!token) {
            alert('无权限，请先登录')
            return next({
                name: 'DeveloperHomeWithLang',
                params: to.params
            })
        }

        // 2.2 向后端校验 token
        try {
            const res = await axios.get('/api/check-auth', {
                params: { t: token }
            })

            if (res.data.success) {
                return next()
            } else {
                throw new Error('invalid token')
            }
        } catch (e) {
            localStorage.removeItem('auth-token')
            alert('登录已失效，请重新登录')

            return next({
                name: 'DeveloperHomeWithLang',
                params: to.params
            })
        }
    }
    next()
})


export default router