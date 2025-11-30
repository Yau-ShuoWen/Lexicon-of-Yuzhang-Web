<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">首页</h1>
      <p class="page-subtitle">方言是我们能听见的历史</p>
    </div>

    <div class="links-section">
      <h2 class="links-title">新功能实验室🧪</h2>
      <div class="links-container">
        <router-link :to="{ name: 'Reference' }" class="text-link">
          参考资料编辑功能测试
        </router-link>
        <router-link :to="{ name: 'Test' }" class="text-link">
          简繁体转换编辑功能测试
        </router-link>
        <router-link :to="{ name: 'Filter' }" class="text-link">
          新增汉字测试
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView'
}
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-title {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 10px;
}

.page-subtitle {
  font-size: 1.2rem;
  color: #666;
  font-style: italic;
}

.links-section {
  margin-top: 40px;
  text-align: center;
}

.links-title {
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 20px;
}

.links-container {
  display: flex;
  gap: 30px;
  justify-content: center;
}

.text-link {
  color: #007bff;
  text-decoration: none;
  font-size: 1.1rem;
  padding: 8px 16px;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.text-link:hover {
  color: #0056b3;
  border-bottom-color: #007bff;
}

.text-link.router-link-active {
  color: #0056b3;
  border-bottom-color: #007bff;
}

@media (max-width: 768px) {
  .links-container {
    flex-direction: column;
    gap: 15px;
  }
}
</style>