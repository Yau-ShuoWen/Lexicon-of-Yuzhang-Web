<script setup/>

<template>
  <div id="app">
    <nav class="main-nav">
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link to="/search" class="nav-link">查询</router-link>
      <router-link to="/about" class="nav-link">关于</router-link>
    </nav>

    <main class="page-container">
      <router-view/>
    </main>
  </div>
</template>

<style scoped/>