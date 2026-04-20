<!-- src/views/Tutorial.TutorialHome.vue -->
<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LoadingIcon from "../../components/Status/LoadingIcon.vue";

const router = useRouter()
const route = useRoute()

const catalog = ref([])
const loading = ref(false)
const activeChapterId = ref(null)

const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)

onMounted(async () => {
  loading.value = true
  const res = await fetch(
      `/api/course/catalog/${dialect.value}/${language.value}`
  )
  const data = await res.json()
  catalog.value = data.catalog
  loading.value = false
})

const toggleChapter = (id) => {
  activeChapterId.value =
      activeChapterId.value === id ? null : id
}
</script>

<template>
  <div class="middle-layout">

    <LoadingIcon v-if="loading"/>

    <div
        v-else
        class="pronunciation-block"
        v-for="chapter in catalog"
        :key="chapter.chapterId"
        @click="toggleChapter(chapter.chapterId)"
    >
      <!-- 标题 -->
      <h4
          class="chapter-title"
          v-formatted-text="chapter.title"
      />

      <!-- 折叠内容 -->
      <transition name="accordion">
        <div v-if="activeChapterId === chapter.chapterId">
          <p v-formatted-text="chapter.text"/>

          <ul class="section-list">
            <li
                v-for="sec in chapter.sections"
                :key="sec.id"
            >
              <!-- ⭐ 核心：让 router-link 成为整块 -->
              <router-link
                  class="result-item"
                  :to="{
                  name: 'Article',
                  params: { language, dialect,id: sec.id }
                }"
              >
                <span v-formatted-text="sec.title"></span>
              </router-link>
            </li>
          </ul>
        </div>
      </transition>
    </div>
  </div>
</template>

<style>
.chapter-title {
  cursor: pointer;
  user-select: none;
}

/* 列表去掉默认样式 */
.section-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* ⭐ 关键：router-link 本身就是卡片 */
.result-item {
  display: block; /* 关键 */
  width: 100%; /* 撑满 */
  padding: 12px;
  margin-bottom: 10px;

  border: 1px solid #bababa;
  border-radius: 6px;

  text-decoration: none;
  color: inherit;

  box-sizing: border-box; /* 防止 padding 撑爆 */
  cursor: pointer;
}

.result-item:hover {
  background-color: #f5f5f5;
}

/* 动画 */
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.2s ease;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>