<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@vueuse/head";
import {
  ArrowRight,
  Collection,
  Connection,
  CopyDocument,
  DataLine,
  Document,
  EditPen,
  Files,
  MagicStick,
  Memo,
  Setting,
  Tools,
  Upload,
} from "@element-plus/icons-vue";
import DialectSelector from "../../components/Select/DialectSelector.vue";

const route = useRoute();

const language = computed(() => route.params.language);
const dialect = computed(() => route.params.dialect);
const getPath = (path) => `/${language.value}/${dialect.value}/dev/${path}`;

const sections = [
  {
    title: "工具箱",
    subtitle: "快速驗證轉換、文字與檔案處理流程",
    icon: Tools,
    tone: "blue",
    items: [
      { path: "test/sc-tc", title: "繁體轉簡體", description: "檢查繁簡字轉換結果", icon: Connection },
      { path: "test/pinyin-ipa", title: "富文本展示框", description: "測試拼音與 IPA 顯示效果", icon: Document },
      { path: "test/oss", title: "OSS／音頻上傳測試", description: "驗證檔案與音頻上傳流程", icon: Upload },
      { path: "tool/special-symbol", title: "特殊符號複製", description: "瀏覽並複製常用特殊符號", icon: CopyDocument },
      { path: "tool/text-diff", title: "字符串差異工具", description: "比較兩段文字的內容差異", icon: DataLine },
    ],
  },
  {
    title: "內容工作區",
    subtitle: "管理字詞資料、學習內容與輔助設定",
    icon: Collection,
    tone: "green",
    items: [
      { path: "hanzi-filter", title: "編輯漢字", description: "查找與維護方言漢字資料", icon: EditPen },
      { path: "ciyu-filter", title: "編輯詞語", description: "整理方言詞語與相關內容", icon: Memo },
      { path: "study-word-card", title: "編輯學習詞卡", description: "維護學習模式使用的詞卡", icon: Files },
      { path: "streak-admin", title: "用戶連勝管理", description: "查看與調整學習連勝資料", icon: Setting },
      { path: "loading-text", title: "編輯加載提示語", description: "管理頁面載入時的提示文字", icon: MagicStick },
      { path: "pinyin-editor", title: "編輯拼音", description: "維護字詞的拼音註記", icon: Document },
      { path: "ref-filter", title: "編輯資料", description: "管理字典與參考資料", icon: Collection },
    ],
  },
];

useHead({
  title: () => `開發者模式`,
});
</script>

<template>
  <div class="dev-home">
    <header class="dev-home__hero">
      <div class="dev-home__hero-copy">
        <h1 v-formatted-text="`開發者工作台`" />
      </div>

      <div class="dev-home__context">
        <span class="dev-home__context-label">目前環境</span>
        <DialectSelector />
      </div>
    </header>

    <main class="dev-home__content">
      <router-link :to="getPath(`admin`)" class="dev-home__admin-card">
        <span class="dev-home__admin-icon" aria-hidden="true">
          <el-icon><Setting /></el-icon>
        </span>
        <span class="dev-home__card-copy">
          <strong v-formatted-text="`管理員後台`" />
          <span>管理帳號、權限與系統層級設定</span>
        </span>
        <el-icon class="dev-home__arrow" aria-hidden="true"><ArrowRight /></el-icon>
      </router-link>

      <section
        v-for="section in sections"
        :key="section.title"
        class="dev-home__section"
        :class="`dev-home__section--${section.tone}`"
      >
        <div class="dev-home__section-heading">
          <span class="dev-home__section-icon" aria-hidden="true">
            <el-icon><component :is="section.icon" /></el-icon>
          </span>
          <div>
            <h2 v-formatted-text="section.title" />
            <p>{{ section.subtitle }}</p>
          </div>
        </div>

        <div class="dev-home__grid">
          <router-link
            v-for="item in section.items"
            :key="item.path"
            :to="getPath(item.path)"
            class="dev-home__tool-card"
          >
            <span class="dev-home__tool-icon" aria-hidden="true">
              <el-icon><component :is="item.icon" /></el-icon>
            </span>
            <span class="dev-home__tool-copy">
              <strong v-formatted-text="item.title" />
              <span>{{ item.description }}</span>
            </span>
            <el-icon class="dev-home__tool-arrow" aria-hidden="true"><ArrowRight /></el-icon>
          </router-link>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.dev-home {
  --dev-ink: #1f3027;
  --dev-muted: #6e7e73;
  --dev-line: rgba(42, 86, 54, 0.14);
  --dev-surface: rgba(255, 255, 255, 0.76);
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

.dev-home__eyebrow,
.dev-home__card-kicker {
  display: block;
  color: var(--color-primary);
  font-family: var(--font-family-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.dev-home__eyebrow {
  margin-bottom: 12px;
}

.dev-home h1,
.dev-home h2,
.dev-home p {
  margin: 0;
}

.dev-home h1 {
  color: var(--dev-ink);
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.04em;
}

.dev-home__hero-copy p {
  margin-top: 12px;
  color: var(--dev-muted);
  font-size: 0.95rem;
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

.dev-home__content {
  display: flex;
  flex-direction: column;
  gap: 38px;
}

.dev-home__admin-card,
.dev-home__tool-card {
  text-decoration: none;
}

.dev-home__admin-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 128px;
  padding: 24px 28px;
  overflow: hidden;
  border: 1px solid rgba(46, 125, 50, 0.28);
  border-radius: 22px;
  background: linear-gradient(118deg, #285d35 0%, #367b46 62%, #4b9257 100%);
  color: #fff;
  box-shadow: 0 16px 34px rgba(38, 92, 51, 0.2);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.dev-home__admin-card::after {
  position: absolute;
  right: 70px;
  bottom: -80px;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 50%;
  content: "";
}

.dev-home__admin-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 42px rgba(38, 92, 51, 0.28);
}

.dev-home__admin-icon,
.dev-home__section-icon,
.dev-home__tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.dev-home__admin-icon {
  width: 58px;
  height: 58px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.15);
  font-size: 28px;
}

.dev-home__card-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dev-home__admin-card .dev-home__card-kicker {
  color: rgba(255, 255, 255, 0.7);
}

.dev-home__admin-card strong {
  font-size: 1.28rem;
  font-weight: 650;
}

.dev-home__admin-card .dev-home__card-copy > span:last-child {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.86rem;
}

.dev-home__arrow {
  position: relative;
  z-index: 1;
  margin-left: auto;
  font-size: 23px;
  transition: transform var(--transition-base);
}

.dev-home__admin-card:hover .dev-home__arrow,
.dev-home__tool-card:hover .dev-home__tool-arrow {
  transform: translateX(4px);
}

.dev-home__section-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 17px;
}

.dev-home__section-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  font-size: 21px;
}

.dev-home__section--blue .dev-home__section-icon {
  background: #e9f2ff;
  color: #3973b8;
}

.dev-home__section--green .dev-home__section-icon {
  background: #e8f4e9;
  color: var(--color-primary);
}

.dev-home__section-heading h2 {
  font-size: 1.28rem;
  letter-spacing: -0.02em;
}

.dev-home__section-heading p {
  margin-top: 3px;
  color: var(--dev-muted);
  font-size: 0.82rem;
}

.dev-home__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}

.dev-home__tool-card {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  min-height: 112px;
  padding: 17px;
  border: 1px solid var(--dev-line);
  border-radius: 16px;
  background: var(--dev-surface);
  box-shadow: 0 5px 18px rgba(41, 72, 48, 0.045);
  transition: border-color var(--transition-base), background var(--transition-base),
    box-shadow var(--transition-base), transform var(--transition-base);
}

.dev-home__tool-card:hover {
  transform: translateY(-3px);
  border-color: rgba(46, 125, 50, 0.38);
  background: #fff;
  box-shadow: 0 13px 25px rgba(41, 72, 48, 0.11);
}

.dev-home__tool-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f0f5f0;
  color: var(--color-primary);
  font-size: 18px;
}

.dev-home__tool-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.dev-home__tool-copy strong {
  color: var(--dev-ink);
  font-size: 0.97rem;
  font-weight: 650;
  line-height: 1.35;
}

.dev-home__tool-copy span {
  color: var(--dev-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.dev-home__tool-arrow {
  margin-top: 3px;
  color: #9aac9d;
  font-size: 16px;
  transition: transform var(--transition-base), color var(--transition-base);
}

.dev-home__tool-card:hover .dev-home__tool-arrow {
  color: var(--color-primary);
}

@media (max-width: 900px) {
  .dev-home__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .dev-home {
    padding: 36px 16px 52px;
  }

  .dev-home__hero {
    align-items: stretch;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
  }

  .dev-home__context {
    width: 100%;
  }

  .dev-home__content {
    gap: 30px;
  }

  .dev-home__admin-card {
    min-height: 116px;
    padding: 20px;
    border-radius: 18px;
  }

  .dev-home__admin-icon {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    font-size: 22px;
  }

  .dev-home__grid {
    grid-template-columns: 1fr;
  }
}
</style>
