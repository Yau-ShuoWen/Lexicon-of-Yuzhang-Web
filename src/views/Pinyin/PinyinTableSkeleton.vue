<script setup>
const sections = [[3, 2], [2, 3, 3, 3]]
</script>

<template>
  <div class="pinyin-skeleton" aria-hidden="true">
    <section
      v-for="(lines, sectionIndex) in sections"
      :key="sectionIndex"
      class="skeleton-section"
      :class="'accent-' + (sectionIndex % 3)"
    >
      <div class="skeleton-heading">
        <span class="skeleton-title shimmer" />
      </div>
      <div v-for="(groupCount, lineIndex) in lines" :key="lineIndex" class="skeleton-line">
        <div v-for="groupIndex in groupCount" :key="groupIndex" class="skeleton-group">
          <span v-for="itemIndex in 4" :key="itemIndex" class="skeleton-item shimmer" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pinyin-skeleton {
  display: grid;
  gap: 18px;
}

.skeleton-section {
  padding: 22px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  background: #fff;
  box-shadow: var(--pinyin-card-shadow);
}

.skeleton-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.skeleton-heading::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
}

.accent-1 .skeleton-heading::before {
  background: var(--color-secondary);
}

.skeleton-title {
  width: 140px;
  height: 22px;
  border-radius: var(--border-radius-md);
}

.skeleton-line {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  margin-bottom: 26px;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.skeleton-group {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 76px;
  gap: 6px;
}

.skeleton-item {
  height: 52px;
  border-radius: var(--border-radius-md);
}

.shimmer {
  position: relative;
  overflow: hidden;
  background: #eaf0e9;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .6), transparent);
  animation: skeleton-shimmer 1.35s infinite;
}

@keyframes skeleton-shimmer {
  to { transform: translateX(100%); }
}

@media (max-width: 750px) {
  .skeleton-line {
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }

  .skeleton-group {
    width: 70%;
  }
}

@media (max-width: 500px) {
  .skeleton-section {
    padding: 22px 20px;
  }

  .skeleton-group {
    width: 100%;
    grid-auto-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shimmer::after { animation: none; }
}
</style>
