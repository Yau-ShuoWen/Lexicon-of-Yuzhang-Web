<template>
  <router-view v-slot="{ Component }">
    <KeepAlive include="SearchResult">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
</template>
