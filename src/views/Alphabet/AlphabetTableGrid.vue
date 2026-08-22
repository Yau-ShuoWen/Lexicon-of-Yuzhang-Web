<script setup>
import { formatRichText } from '../../utils/textFormatter.js'

defineProps({
  grid: { type: Object, required: true },
  gridIndex: { type: Number, default: 0 }
})

function formatDisplay(item) {
  if (!item.exist) return ''
  const s = item.standard?.trim() || ''

  try {
    return formatRichText(` ${s} `)
  } catch {
    return s
  }
}
</script>

<template>
  <div
    class="attribute-group"
    :class="'accent-' + (gridIndex % 3)"
    :style="{ animationDelay: (gridIndex * 120) + 'ms' }"
  >
    <div class="group-header">
      <h3>{{ grid.name }}</h3>
    </div>

    <div v-for="line in grid.line" :key="line.id" class="pinyin-line">
      <div v-for="group in line.group" :key="group.id" class="pinyin-group">
        <div class="items-grid">
          <div
            v-for="(item, itemIndex) in group.item"
            :key="item.id"
            class="item-box"
            :class="{ invalid: !item.exist }"
            :style="{ animationDelay: (itemIndex * 35) + 'ms' }"
          >
            <div class="main-display" v-html="formatDisplay(item)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attribute-group {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xl);
  padding: 22px 20px;
  box-shadow: var(--shadow-sm);
  animation: fadeInUp 0.55s ease both;
  transition: box-shadow var(--transition-base);
}

.attribute-group:hover {
  box-shadow: var(--shadow-md);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.group-header::before {
  content: '';
  width: 6px;
  height: 22px;
  border-radius: 4px;
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

.accent-0 .group-header::before {
  background: var(--color-primary);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.3);
}

.accent-1 .group-header::before {
  background: var(--color-secondary);
  box-shadow: 0 2px 6px rgba(74, 111, 200, 0.3);
}

.accent-2 .group-header::before {
  background: var(--color-accent);
  box-shadow: 0 2px 6px rgba(243, 96, 72, 0.3);
}

.group-header h3 {
  margin: 0;
  font-size: 19px;
  color: #34495e;
  font-weight: 700;
  letter-spacing: 1px;
}

.pinyin-line {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  margin-bottom: 26px;
}

.pinyin-line:last-child {
  margin-bottom: 0;
}

.pinyin-group {
  flex: 0 0 auto;
  display: inline-block;
}

.items-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 76px;
  gap: 6px;
}

.item-box {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f2f9f0 100%);
  border: 1.5px solid #d6e6d2;
  border-radius: 10px;
  padding: 12px 6px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: itemIn 0.45s ease forwards;
  transition: transform 0.25s ease, box-shadow 0.25s ease,
    border-color 0.25s ease, background 0.25s ease;
}

.item-box:not(.invalid):hover {
  transform: translateY(-4px) scale(1.05);
  border-color: var(--color-primary);
  background: linear-gradient(180deg, #ffffff 0%, #e6f4e2 100%);
  box-shadow: 0 8px 18px rgba(46, 125, 50, 0.18);
  z-index: 2;
}

.item-box:not(.invalid):active {
  transform: translateY(-1px) scale(0.98);
  box-shadow: 0 3px 8px rgba(46, 125, 50, 0.15);
}

.item-box.invalid {
  background: #f0f2f4;
  border: 1px dashed #d3d9df;
  box-shadow: none;
  pointer-events: none;
}

.item-box.invalid .main-display {
  color: #b6bec7;
}

.main-display {
  font-size: 22px;
  text-align: center;
  color: var(--color-text);
  line-height: 1;
  user-select: none;
  -webkit-user-select: none;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes itemIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 750px) {
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }

  .pinyin-group {
    width: 70%;
  }

  .item-box {
    width: auto;
  }
}

@media (max-width: 500px) {
  .pinyin-line {
    flex-direction: column;
    gap: 14px;
  }

  .pinyin-group {
    width: 100%;
  }

  .items-grid {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }
}
</style>
