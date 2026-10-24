<script setup>
import { ref, watch, nextTick } from 'vue'
import UnifiedModal from "../../components/Window/UnifiedModal.vue";
import audioIcon from "../../assets/icons/audio.svg"
import { HTTP_CODE, request } from '../../services/request.js'

const props = defineProps({
  show: Boolean,
  dialect: String,
  language: String,
  pinyinKey: String,
  documentChildren: {type: Array, default: null}
})

const emit = defineEmits(['close'])

const loading = ref(false)
const detail = ref(null)

const audioRef = ref(null)
const currentAudio = ref('')

function closeModal() {
  emit('close')
}

/* =========================
   2. 拉取 detail + 批量音频映射（并行）
========================= */
async function fetchDetail() {
  if (!props.pinyinKey) return

  try {
    loading.value = true

    // ⭐ detail 与音频映射并行请求，互不依赖，缩短总等待时间
    const params = new URLSearchParams({key: props.pinyinKey})
    const [data, audioMap] = await Promise.all([
      props.documentChildren
        ? Promise.resolve({info: props.documentChildren.map(child => ({
            key: child.audioKey || child.key,
            standard: child.title ? `[${child.title}]` : '',
            notes: child.notes || []
          }))})
        : request(`/api/pinyin/pinyin-detail/${props.dialect}/${props.language}?${params}`),
      request(`/api/pinyin/audio/batch?dialect=${props.dialect}`).catch(() => ({}))
    ])
    detail.value = data

    // 用批量结果给每个 item 标记 hasAudio / 缓存签名 url
    const urlMap = audioMap || {}

    detail.value.info.forEach((item) =>
    {
      const url = urlMap[item.key]
      item.hasAudio = !!url
      item.audioUrl = url || ''
    })

  } catch (e) {
    if (e.code !== HTTP_CODE.NOT_FOUND) console.error(e)
    detail.value = null
  }
  finally {
    loading.value = false
  }
}

/* =========================
   3. 播放（直接使用后端返回的签名 url）
========================= */
function playAudio(item)
{
  currentAudio.value = item.audioUrl

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
  <UnifiedModal
      :model-value="show"
      :title="$t('pinyin_table.detail_title')"
      size="medium"
      :loading="loading"
      :loading-text="$t('status.loading')"
      @update:model-value="value => !value && closeModal()"
  >
    <div v-if="detail" class="pinyin-detail-content">
      <div v-for="item in detail.info" :key="item.key" class="pinyin-detail-block">
        <div class="standard-row">
          <h2 class="standard" v-formatted-text="item.standard"/>

          <button
              v-if="item.hasAudio"
              class="play-btn btn-settings"
              type="button"
              :aria-label="$t('pinyin_table.play_audio')"
              @click="playAudio(item)"
          >
            <img :src="audioIcon" class="audio-icon" alt="" />
          </button>
        </div>

        <div v-if="item.notes" class="explanation-list">
          <div v-for="note in item.notes" :key="note.id" class="explanation-row">
            <strong v-formatted-text="note.label?.[language] || note.label?.sc || ''" />
            <span v-formatted-text="note.value?.[language] || note.value?.sc || ''" />
          </div>
        </div>
        <div v-else class="label" v-formatted-text="item.note"/>
      </div>
    </div>

    <div v-else class="no-results-high">
      {{ $t('status.no_data') }}
    </div>
  </UnifiedModal>

  <audio ref="audioRef" :src="currentAudio" preload="auto" />
</template>


<style scoped>
.pinyin-detail-content {
  display: grid;
  gap: 30px;
}

.explanation-list {
  display: grid;
  border: 1px solid #b9cdbb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.explanation-row {
  display: grid;
  grid-template-columns: minmax(72px, 21%) 1fr;
  align-items: center;
  gap: 12px;
  padding: 13px 12px;
  border-bottom: 1px solid #d7e2d8;
  line-height: 1.5;
}

.explanation-row:last-child {
  border-bottom: 0;
}

.explanation-row strong {
  font-weight: 600;
}
.standard-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: 5px;
}

.standard {
  margin: 0;
  font-size: 30px;
  line-height: 1;
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

.pinyin-detail-block {
  min-width: 0;
}

.no-results-high {
  display: grid;
  min-height: 120px;
  place-items: center;
  color: var(--color-text-light);
}
</style>
