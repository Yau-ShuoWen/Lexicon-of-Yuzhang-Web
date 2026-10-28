<script setup>
import { useHead } from "@vueuse/head";
import { useI18n } from 'vue-i18n';
import DialectSelector from "../../components/Select/DialectSelector.vue";

const {t} = useI18n();

useHead({
  title: () => t('devhome.title'),
});
</script>

<template>
  <div class="dev-home">
    <header class="dev-home__hero">
      <div class="dev-home__hero-copy">
        <h1 v-formatted-text="$t('devhome.heading')" />
      </div>

      <div class="dev-home__context">
        <span class="dev-home__context-label">{{ $t('devhome.environment') }}</span>
        <DialectSelector />
      </div>
    </header>

    <main class="dev-home__content" aria-label="工作台内容">
      <p>仪表板尚未设计，功能入口请使用左侧导航。</p>
    </main>
  </div>
</template>

<style scoped>
.dev-home {
  --dev-ink: #1f3027;
  --dev-muted: #6e7e73;
  --dev-line: rgba(42, 86, 54, 0.14);
  max-width: 1120px;
  margin: 0 auto;
  padding: 46px 24px 72px;
  color: var(--dev-ink);
}

.dev-home__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 40px;
}

.dev-home__hero-copy {
  max-width: 640px;
}

.dev-home h1,
.dev-home p {
  margin: 0;
}

.dev-home h1 {
  color: var(--dev-ink);
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.04em;
}

.dev-home__context {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 190px;
  padding: 12px 14px;
  border: 1px solid var(--dev-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.46);
}

.dev-home__context-label {
  color: var(--dev-muted);
  font-size: 0.78rem;
  white-space: nowrap;
}

.dev-home__context :deep(.dialect-selector) {
  margin-left: auto;
}

.dev-home__content { color: var(--dev-muted); }

@media (max-width: 620px) {
  .dev-home { padding: 36px 16px 52px; }
  .dev-home__hero { align-items: stretch; flex-direction: column; gap: 20px; margin-bottom: 30px; }
  .dev-home__context { width: 100%; }
}
</style>
