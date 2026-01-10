import {createRouter, createWebHistory} from 'vue-router'

const routes = [

    // 重定向
    {
        path: '/:lang/pinyin',
        redirect: to => {
            const {lang} = to.params
            if (lang !== 'sc' && lang !== 'tc') return '/sc/pinyin'
            return false
        }
    },


    // 主要路由
    {
        path: '/:lang(sc|tc)',
        component: () => import('../layouts/LangLayout.vue'),
        children: [
            {
                path: 'pinyin',
                name: 'PinyinTableWithLang',
                component: () => import('../views/PinyinTable.vue')
            },
            {
                path: 'about',
                name: 'AboutWithLang',
                component: () => import('../views/AboutPage.vue')
            },
            {
                path: 'developer-home',
                name: 'DeveloperHomeWithLang',
                component: () => import('../views/Developer/NavigationPage.vue')
            },
            {
                path: 'search',
                name: 'SearchWithLang',
                component: () => import('../components/SearchResult.vue')
            },
            {
                path: 'home',
                name: 'Home',
                component: () => import('../views/HomePage.vue')
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
            {
                path: 'test',
                name: 'Test',
                component: () => import('../views/HelloWorld.vue')
            },
            {
                path: 'style',
                name: 'PinyinStyle',
                component: () => import('../views/PinyinStyle.vue')
            },
            {
                path: 'edit/:id?',
                name: 'Edit',
                component: () => import('../views/Developer/HanziEditor.vue'),
                props: true
            },
            {
                path: 'filter',
                name: 'Filter',
                component: () => import('../views/Developer/HanziEditFilter.vue')
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
            {
                path: 'refer',
                name: 'Refer',
                component: () => import('../views/Developer/EditReferencePage.vue')
            },
        ]


    },

    // 默认跳转
    {
        path: '/pinyin',
        redirect: '/sc/pinyin'
    },
    {
        path: '/about',
        redirect: '/sc/about'
    },
    {
        path: '/developer-home',
        redirect: '/sc/developer-home'
    },
    {
        path: '/search',
        redirect: '/sc/search'
    },
    {
        path: '/',
        redirect: '/sc/home'
    },
    {
        path: '/h/:hanzi',
        redirect: to => `/sc/h/${encodeURIComponent(to.params.hanzi)}`
    },
    {
        path: '/c/:ciyu',
        redirect: to => `/sc/c/${encodeURIComponent(to.params.ciyu)}`
    },
    {
        path: '/test',
        redirect: '/sc/test'
    },
    {
        path: '/style',
        redirect: '/sc/style'
    },
    {
        path: '/edit/:id?',
        redirect: '/sc/edit/:id?',
    },
    {
        path: '/filter',
        redirect: '/sc/filter'
    },
    {
        path: '/test/sc-tc',
        redirect: '/sc/test-tc'
    },
    {
        path: '/test/pinyin-ipa',
        redirect: '/sc/test/pinyin-ipa'
    },
    {
        path: '/login',
        redirect: '/sc/login'
    },
    {
        path: '/register',
        redirect: '/sc/register'
    },
    {
        path: '/profile',
        redirect: '/sc/profile'
    },
    {
        path: '/refer',
        redirect: '/sc/refer'
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router