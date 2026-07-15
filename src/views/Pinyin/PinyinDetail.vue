<script setup>
import { ref, watch, nextTick } from 'vue'
import { formatRichText } from "../../utils/textFormatter.js";
import LoadingIcon from "../../components/Status/LoadingIcon.vue";
import audioIcon from "../../assets/icons/audio.svg"

const props = defineProps({
  show: Boolean,
  dialect: String,
  language: String,
  pinyinKey: String
})

const emit = defineEmits(['close'])

const loading = ref(false)
const detail = ref(null)

const audioRef = ref(null)
const currentAudio = ref('')

/**
 * ⭐ 用 Map 做音频缓存
 * key -> boolean
 */
const audioMap = ref(new Map())

/* =========================
   1. HEAD 检测（带缓存）
========================= */
async function checkAudioExists(item)
{
  try
  {
    const res = await fetch(`/api/audio/pinyin/exists?dialect=${props.dialect}&pinyinKey=${item.key}`)
    return await res.json()
  }
  catch
  {
    return false
  }
}
/* =========================
   2. 拉取 detail + 音频检测
========================= */
async function fetchDetail() {
  if (!props.pinyinKey) return

  try {
    loading.value = true
    audioMap.value.clear()

    const res = await fetch(
        `/api/pinyin/pinyin-detail/${props.dialect}/${props.language}?key=${props.pinyinKey}`
    )

    const data = await res.json()

    if (data.empty) {
      detail.value = null
      return
    }

    detail.value = data.value

    const list = detail.value?.info || []

    // ⭐ 并发检测（比 for-await 快很多）
    await Promise.all(
        detail.value.info.map(async (item) =>
        {
          item.hasAudio = await checkAudioExists(item)
        })
    )

  } catch (e) {
    console.error(e)
    detail.value = null
  }
  finally {
    loading.value = false
  }
}

/* =========================
   3. 播放
========================= */
function playAudio(item)
{
  currentAudio.value =
      `/api/audio/pinyin/play?dialect=${props.dialect}&key=${item.key}`

  nextTick(async () =>
  {
    audioRef.value.load()

    try
    {
      await audioRef.value.play()
    }
    catch(e)
    {
      console.error(e)
    }
  })
}

/* =========================
   4. 自动加载
========================= */
watch(() => [props.pinyinKey, props.show], () => {
  if (props.show) fetchDetail()
})
</script>


<template>
  <div v-if="show" class="overlay" @click.self="emit('close')">
    <div class="modal">

      <button class="close-btn" @click="emit('close')">
        ✕
      </button>

      <LoadingIcon v-if="loading"/>

      <!-- content -->
      <div v-else-if="detail">

        <div v-for="item in detail.info" :key="item.key" class="block">

          <div class="standard-row">
            <h2 class="standard" v-formatted-text="item.standard"/>

            <button
                v-if="item.hasAudio"
                class="play-btn btn-settings"
                @click="playAudio(item)"
                aria-label="play audio"
            >
              <img :src="audioIcon" class="audio-icon" />
            </button>
          </div>

          <div class="label" v-formatted-text="item.note"/>

          <!--          辞书国际音标-->
          <!--          &lt;!&ndash; ipa &ndash;&gt;-->
          <!--          <table class="table">-->
          <!--            <tr v-for="(value, key) in item.ipa" :key="key">-->
          <!--              <td class="ipa-key">{{ key }}</td>-->
          <!--              <td class="ipa-value" v-formatted-text="value"/>-->
          <!--            </tr>-->
          <!--          </table>-->


        </div>
      </div>

      <div v-else class="no-results-high">
        無資料
      </div>

    </div>
    <audio
        ref="audioRef"
        :src="currentAudio"
        preload="auto"
    />
  </div>
</template>


<style>
/* 遮罩 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

/* 彈窗 */
.modal {
  position: relative;

  width: 90%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;

  background: #fff;
  border-radius: 14px;
  padding: 20px;
}

.close-btn {
  position: sticky;
  top: 8px;

  float: right;

  z-index: 20;

  border: none;
  background: rgba(255, 255, 255, 0.95);

  width: 32px;
  height: 32px;
  border-radius: 50%;

  cursor: pointer;
  font-size: 20px;
}

.close-btn:hover {
  color: #000;
}

/* 區塊 */
.block {
  margin-bottom: 20px;
}

.standard-row {
  display: flex;
  align-items: center;
  gap: 20px; /* 控制文字和图标距离 */
}

.standard {
  margin: 0; /* 去掉默认 margin，避免错位 */
  font-size: 30px;
  line-height: 1.2;
}

.play-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;

  display: flex;
  align-items: center;
}

.audio-icon {
  width: 18px;
  height: 18px;
  display: block;
}
/* standard */
.standard {
  margin: 0 0 10px;
  font-size: 30px;
}

/* notation */
.notation-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;

  table-layout: fixed; /* ⭐關鍵 */
}

.table td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}

.ipa-key {
  background: #f7f7f7;
  width: 75%; /* 3 */
}

.ipa-value {
  width: 25%; /* 1 */
}

.empty {
  text-align: center;
  padding: 20px;
}

.block {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #9a9a9a;
}

.block:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
</style>