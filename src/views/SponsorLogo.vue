<script setup>
</script>

<template>
  <div class="page-container text-center">
    <div class="page-header">
      <h1 class="page-title">技术支持</h1>
      <p class="page-subtitle">感谢以下技术提供的支持</p>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="flex justify-center gap-5">

          <a href="https://vuejs.org/" target="_blank" class="tech-logo">
            <img src="/src/assets/icons/vue.svg" class="logo vue" alt="Vue logo" />
            <span>Vue.js</span>
          </a>

          <a href="https://vite.dev" target="_blank" class="tech-logo">
            <img src="/src/assets/icons/vite.svg" class="logo vite" alt="Vite logo" />
            <span>Vite</span>
          </a>

          <a href="https://hanlp.hankcs.com/" target="_blank" class="tech-logo">
            <img src="/src/assets/icons/hanlp.png" class="logo hanlp" alt="Hanlp logo" />
            <span>Hanlp</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: var(--color-text);
  transition: transform var(--transition-base);
}

.tech-logo:hover {
  transform: translateY(-4px);
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter var(--transition-base);
}

.logo.vite:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.tech-logo span {
  margin-top: var(--spacing-sm);
  font-weight: 500;
}
</style>