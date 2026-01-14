import {createRouter, createWebHistory} from 'vue-router'

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
                path: 'filter',
                name: 'Filter',
                component: () => import('../views/Developer/HanziEditFilter.vue')
            },
            {
                path: 'edit/:id?',
                name: 'Edit',
                component: () => import('../views/Developer/HanziEditor.vue'),
                props: true
            },
            {
                path: 'refer',
                name: 'Refer',
                component: () => import('../views/Developer/EditReferencePage.vue')
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
                component: () => import('../views/Developer/UserLogin.vue')
            },
            {
                path: 'register',
                name: 'Register',
                component: () => import('../views/Developer/UserRegister.vue')
            },
            {
                path: 'profile',
                name: 'Profile',
                component: () => import('../views/Developer/UserProfile.vue')
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

router.beforeEach((to, from, next) => {
    if (to.path === '/') {
        let language = localStorage.getItem('user-language')
        let dialect = localStorage.getItem('user-dialect')

        // language 校验
        if (!VALID_LANGUAGES.includes(language)) {
            language = DEFAULT_LANGUAGE
            localStorage.setItem('user-language', language)
        }

        // dialect 校验
        if (!VALID_DIALECTS.includes(dialect)) {
            dialect = DEFAULT_DIALECT
            localStorage.setItem('user-dialect', dialect)
        }

        return next(`/${language}/${dialect}/home`)
    }

    next()
})

export default router