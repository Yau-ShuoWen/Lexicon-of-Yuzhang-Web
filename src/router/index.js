// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from "../components/HelloWorld.vue";
import Logo from "../views/logo.vue";

// 导入页面组件
const Home = () => import('../views/Home.vue')
const About = () => import('../views/About.vue')
const Contact = () => import('../views/Contact.vue')

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/about',
        name: 'About',
        component: About
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
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router