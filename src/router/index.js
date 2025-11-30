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
        component: () => import('../views/SearchPage.vue')
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
        path: '/edit/:id?',
        name: 'Edit',
        component: () => import('../views/EditPage.vue'),
        props: true
    },
    {
        path: '/filter',
        name: 'Filter',
        component: () => import('../views/filterPage.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router