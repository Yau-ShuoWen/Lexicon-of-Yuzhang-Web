import {createRouter, createWebHistory} from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('../views/HomePage.vue')
    },
    {
        path: '/search',
        name: 'Search',
        component: () => import('../components/SearchResult.vue')
    },
    {
        path: '/h/:hanzi',
        name: 'HanziDetail',
        component: () => import('../components/HanziDetail.vue'),
        props: true // 启用 props 传参
    },
    {
        path: '/pinyin',
        name: 'PinyinTable',
        component: () => import('../views/PinyinTable.vue'),
    },
    {
        path: '/c/:ciyu',
        name: 'CiyuDetail',
        component: () => import('../components/CiyuDetail.vue'),
        props: true // 启用 props 传参
    },
    {
        path: '/test',
        name: 'Test',
        component: () => import('../views/HelloWorld.vue')
    },
    {
        path: '/about',
        name: 'About',
        component: () => import('../views/AboutPage.vue')
    },
    {
        path: '/style',
        name: 'PinyinStyle',
        component: () => import('../views/PinyinStyle.vue')
    },


    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/Developer/UserLogin.vue')
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('../views/Developer/UserRegister.vue')
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('../views/Developer/UserProfile.vue')
    },
    {
        path: '/developer-home',
        name: 'Developer Home',
        component: () => import('../views/Developer/NavigationPage.vue')
    },

    {
        path: '/reference',
        name: 'Reference',
        component: () => import('../views/ReferencePage.vue')
    },
    {
        path: '/refer',
        name: 'Refer',
        component: () => import('../views/Developer/EditReferencePage.vue')
    },
    {
        path: '/edit/:id?',
        name: 'Edit',
        component: () => import('../views/Developer/HanziEditor.vue'),
        props: true
    },
    {
        path: '/filter',
        name: 'Filter',
        component: () => import('../views/Developer/HanziEditFilter.vue')
    },


    {
        path: '/test/sc-tc',
        name: 'TestSimplifiedAndTraditional',
        component: () => import('../views/Test/TestScTc.vue')
    },
    {
        path: '/test/pinyin-ipa',
        name: 'TestPinyinAndIPA',
        component: () => import('../views/Test/TestPinyinIPA.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router