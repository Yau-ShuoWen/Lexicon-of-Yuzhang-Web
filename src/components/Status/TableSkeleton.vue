<script setup>
const props = defineProps({
  groups: { type: Number, default: 3 },
  rows: { type: Number, default: 2 },
  cols: { type: Number, default: 6 }
})

function colCount(groupIndex) {
  const base = props.cols
  return Math.max(3, base - (groupIndex % 2))
}
</script>

<template>
  <div class="table-skeleton" aria-hidden="true">
    <div
      v-for="groupIndex in groups"
      :key="groupIndex"
      class="skeleton-group"
      :class="'accent-' + ((groupIndex - 1) % 3)"
    >
      <div class="skeleton-header">
        <div class="skeleton-title shimmer" />
      </div>

      <div
        v-for="rowIndex in rows"
        :key="rowIndex"
        class="skeleton-line"
      >
        <div class="skeleton-items-grid">
          <div
            v-for="colIndex in colCount(groupIndex)"
            :key="colIndex"
            class="skeleton-item shimmer"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.skeleton-group {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  padding: 22px 20px;
  box-shadow: var(--shadow-sm);
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.skeleton-header::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.18);
}

.accent-0 .skeleton-header::before {
  background: var(--color-primary);
}

.accent-1 .skeleton-header::before {
  background: var(--color-secondary);
}

.accent-2 .skeleton-header::before {
  background: var(--color-accent);
}

.skeleton-title {
  height: 22px;
  width: 140px;
  border-radius: 999px;
}

.skeleton-line {
  margin-bottom: 26px;
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.skeleton-items-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 76px;
  gap: 6px;
  width: max-content;
}

.skeleton-item {
  height: 52px;
  border-radius: 10px;
}

.shimmer {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #eef3ee 0%, #e4ece4 100%);
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
  animation: skeleton-shimmer 1.35s infinite;
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 750px) {
  .skeleton-line {
    display: flex;
    justify-content: center;
  }
}

@media (max-width: 500px) {
  .skeleton-items-grid {
    width: 100%;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }
}
</style>
