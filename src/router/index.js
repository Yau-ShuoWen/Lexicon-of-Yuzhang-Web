// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from "../components/HelloWorld.vue";
import Logo from "../views/logo.vue";
import pinyinStyle from "../views/pinyinStyle.vue";

// 导入页面组件
const Home = () => import('../views/Home.vue')
const Search = () => import('../views/Search.vue')
const Contact = () => import('../views/Contact.vue')

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/search',
        name: 'Search',
        component: Search
    },
    {
        path: '/contact',
        name: 'Contact',
        component: Contact
    },
    {
        path: '/test',
        name: 'Test',
        component: HelloWorld
    },
    {
        path: '/logo',
        name: 'Logo',
        component: Logo
    }
    ,
    {
        path: '/style',
        name: 'pinyinStyle',
        component: pinyinStyle
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router