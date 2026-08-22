<!-- MainNav.vue -->

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// 路由
const route = useRoute()

// 语言、方言和路径
const language = computed(() => route.params.language)
const dialect = computed(() => route.params.dialect)
const getPath = (path) => `/${language.value}/${dialect.value}/${path}`

// 当前站点形态：normal（词典）/ dev（开发者）/ ysw（屋里），决定渲染哪一套导航
const navType = computed(() => {
  if (route.path.includes('/dict/')) return 'dict'
  if (route.path.includes('/ysw/')) return 'ysw'
  if (route.path.includes('/dev/')) return 'dev'
  else return 'normal'
})

// ===== 导航滑动指示条 =====
// 只有一个导航（normal/dev/ysw 之一）会被渲染，共用同一个 ref
const navRef = ref(null)
const indicator = ref({x: 0, width: 0})

// 读取当前激活链接的位置，驱动指示条滑动
function updateIndicator() {
  if (!navRef.value) return
  const active = navRef.value.querySelector('.nav-link.router-link-active')
  if (!active) {
    indicator.value = {x: 0, width: 0}
    return
  }
  indicator.value = {
    x: active.offsetLeft,
    width: active.offsetWidth,
  }
}

onMounted(() => {
  // 等 DOM 渲染完成后再定位指示条，避免首屏位置错误
  nextTick(updateIndicator)
  // 窗口尺寸变化（含字体加载完成后宽度变化）时重新对齐
  window.addEventListener('resize', updateIndicator)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateIndicator)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator)
})

// 路由切换（含 normal/dev/ysw 三种导航之间切换）后重新对齐指示条
watch(route, async () => {
  await nextTick()
  updateIndicator()
})
</script>

<template>
  <nav ref="navRef" v-if="navType === 'dict'" class="main-nav">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="getPath(`dict/home`)" class="nav-link" v-formatted-text="$t('nav.search')"/>
    <router-link :to="getPath(`dict/pinyin`)" class="nav-link" v-formatted-text="$t('nav.pinyin')"/>
    <router-link :to="getPath(`dict/about`)" class="nav-link" v-formatted-text="$t('nav.about')"/>
    <router-link :to="getPath(`dict/auth`)" class="nav-link" v-formatted-text="`登陆`"/>
  </nav>

  <nav ref="navRef" v-if="navType === 'dev'" class="main-nav">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="getPath(`dev/home`)" class="nav-link" v-formatted-text="`開發者首頁`"/>
    <router-link :to="getPath(`home`)" class="nav-link" v-formatted-text="`回到詞典↗`" target="_blank"/>
  </nav>

  <nav ref="navRef" v-if="navType === 'ysw'" class="main-nav">
    <span class="nav-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: `${indicator.width}px` }"/>
    <router-link :to="{ name: 'YswHome', params: { language: language } }"
                 class="nav-link" v-formatted-text="`屋里`"/>
    <router-link :to="getPath(`ysw/alphabet`)" class="nav-link"
                 v-formatted-text="$t('personal.alphabet_table.title_short')"
    />
    <router-link :to="getPath(`ysw/diary`)" class="nav-link"
                 v-formatted-text="language === 'tc' ? '日記' : '日记'"
    />
    <router-link :to="getPath(`about`)" class="nav-link" v-formatted-text="`词典↗`"/>
  </nav>

  <!-- 顶部渐隐遮罩：内容滚动到导航下方之前先慢慢模糊淡出 -->
  <div class="nav-fade" aria-hidden="true"></div>
</template>

<style scoped>
/*
 * 主导航：悬浮玻璃胶囊导航
 * 设计要点：
 * - 居中的毛玻璃胶囊，贴合站点绿色古典主题，视觉上更精致
 * - 当前页（router-link-active）以绿色渐变胶囊 + 白色文字高亮
 * - 悬停时文字染绿 + 淡绿底，过渡平滑
 */
.main-nav {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);

  z-index: 1000;

  display: flex;
  align-items: center;
  gap: 4px;

  padding: 6px;
  user-select: none;
  -webkit-user-select: none;

  /* 毛玻璃效果 */
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  backdrop-filter: blur(14px) saturate(1.4);

  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;

  box-shadow: 0 4px 6px rgba(46, 125, 50, 0.06),
  0 12px 28px rgba(46, 125, 50, 0.14);

  transition: box-shadow var(--transition-base);
}

.main-nav:hover {
  box-shadow: 0 4px 6px rgba(46, 125, 50, 0.08),
  0 16px 36px rgba(46, 125, 50, 0.2);
}

.nav-link {
  position: relative;
  z-index: 1;
  text-decoration: none;
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.02em;

  padding: 7px 18px;
  border-radius: 999px;
  white-space: nowrap;

  transition: color var(--transition-base),
  background-color var(--transition-base);
}

.nav-link:hover {
  color: var(--color-primary);
  background-color: rgba(46, 125, 50, 0.08);
}

/* 当前页：文字保持白色，绿色渐变底由滑动指示条呈现 */
.nav-link.router-link-active {
  color: #ffffff;
}

.nav-link.router-link-active:hover {
  color: #ffffff;
  background-color: transparent;
}

/*
 * 滑动指示条：跟随激活链接移动的绿色渐变胶囊
 * 位置由 MainNav.vue 根据激活链接的 offsetLeft / offsetWidth 计算
 */
.nav-indicator {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;

  border-radius: 999px;
  background: var(--gradient-primary);
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.35);

  /* 滑动 + 宽度变化使用同一条缓动曲线，实现“吸附”到目标的效果 */
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
  width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, width;
}


/*
 * 顶部渐隐遮罩：内容滚动到导航下方之前先慢慢模糊淡出
 * - 背景渐变（与页面背景同色）实现“淡出”
 * - 淡出在导航底边之前就完全结束，内容到达导航栏时已不可见
 * - backdrop-filter + mask 控制模糊强度，从顶部强模糊渐变到无
 * https://chatgpt.com/c/6a71b999-b2f4-83ee-8e86-fb5720e0fae7
 */
.nav-fade {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;

  height: 100px;

  z-index: 990;

  pointer-events: none;

  background: rgba(233, 246, 233, 0.9);

  mask-image: linear-gradient(
      to bottom,
      black 0,
      black 65px,
      transparent 100px
  );

  -webkit-mask-image: linear-gradient(
      to bottom,
      black 0,
      black 65px,
      transparent 100px
  );
}

@media (max-width: 768px) {
  .main-nav {
    top: 10px;
    gap: 2px;
    padding: 5px;
  }

  .nav-link {
    padding: 6px 12px;
  }

  .nav-indicator {
    top: 5px;
    bottom: 5px;
  }

  .nav-fade {
    height: 70px;

    background: rgba(233, 246, 233, 0.92);

    -webkit-mask-image: linear-gradient(
        to bottom,
        #000 0px,
        #000 55px,
        transparent 70px
    );

    mask-image: linear-gradient(
        to bottom,
        #000 0px,
        #000 55px,
        transparent 70px
    );
  }
}
</style>
