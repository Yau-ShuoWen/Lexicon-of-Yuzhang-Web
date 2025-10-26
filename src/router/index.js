// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from "../views/HelloWorld.vue";
import Logo from "../views/SponsorLogo.vue";
import pinyinStyle from "../views/PinyinStyle.vue";
import login from "../views/UserLogin.vue";
import Contact from "../views/ContactPage.vue";
import Search from "../views/SearchPage.vue";
import Home from "../views/HomePage.vue";
import Register from "../views/UserRegister.vue";
import Profile from "../views/UserProfile.vue"; // 新增导入

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
    },
    {
        path: '/style',
        name: 'pinyinStyle',
        component: pinyinStyle
    },
    {
        path: '/login',
        name: 'login',
        component: login
    },
    {
        path: '/register',
        name: 'register',
        component: Register
    },
    {
        path: '/profile', // 新增个人信息路由
        name: 'profile',
        component: Profile
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router