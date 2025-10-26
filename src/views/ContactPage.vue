<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">联系我们</h1>
    </div>

    <div class="card text-center">
      <div class="card-body">
        <a href="https://github.com/Yau-ShuoWen" target="_blank" class="btn btn-ghost">
          <img src="../assets/icons/github.svg" alt="GitHub" class="icon">
          GitHub 账号
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ContactView'
}
</script>

<style scoped>
.icon {
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin-right: var(--spacing-sm);
}
</style>