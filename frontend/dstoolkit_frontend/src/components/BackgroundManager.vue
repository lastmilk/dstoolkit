<script setup lang="ts">
/**
 * 背景管理面板（Element Plus 组件）
 * 功能：切换 4 种模式 + 换一张 + 自定义上传
 */
import { computed, ref } from 'vue'
import { useBackgroundStore, type BackgroundMode } from '@/stores/background'
import { toast } from '@/utils/toast'
import { confirm } from '@/utils/sweetalert'
import {
  CircleClose, PictureFilled, Sunny, UploadFilled,
  Check, RefreshRight, Delete,
} from '@element-plus/icons-vue'

const bgStore = useBackgroundStore()
// 显式保留引用以避免 tree-shaking 丢失
void CircleClose; void PictureFilled; void Sunny; void UploadFilled
void Check; void RefreshRight; void Delete

const modeOptions: { label: string; value: BackgroundMode; icon: string; desc: string }[] = [
  { label: '关闭背景', value: 'off', icon: 'CircleClose', desc: '使用主题默认背景色' },
  { label: '二次元随机', value: 'acg', icon: 'PictureFilled', desc: '随机动漫风格壁纸' },
  { label: '必应每日', value: 'bing', icon: 'Sunny', desc: '必应精美高清壁纸' },
  { label: '自定义上传', value: 'custom', icon: 'UploadFilled', desc: '上传本地图片（≤5MB）' },
]

const dragActive = ref(false)
const uploadInputRef = ref<HTMLInputElement | null>(null)
function triggerUpload() { uploadInputRef.value?.click() }

async function handleFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const ok = await bgStore.uploadCustom(file)
  if (ok) toast.success('自定义背景设置成功！')
  else if (bgStore.error) toast.error(bgStore.error)
  // 重置 input，允许重复选择同一文件
  input.value = ''
}

async function handleDrop(e: DragEvent) {
  dragActive.value = false
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  const ok = await bgStore.uploadCustom(file)
  if (ok) toast.success('自定义背景设置成功！')
  else if (bgStore.error) toast.error(bgStore.error)
}

async function handleClearCustom() {
  const ok = await confirm('确认清除自定义背景？', '清除后将恢复默认主题背景。')
  if (!ok) return
  bgStore.clearCustom()
  toast.success('已清除自定义背景')
}

const maxMB = computed(() => (bgStore.MAX_SIZE_BYTES / 1024 / 1024).toFixed(0))
</script>

<template>
  <div class="bg-manager">
    <div class="bg-modes-grid">
      <div
        v-for="opt in modeOptions"
        :key="opt.value"
        class="bg-mode-card"
        :class="{ active: bgStore.mode === opt.value }"
        @click="bgStore.setMode(opt.value)"
      >
        <div class="bg-mode-icon">
          <el-icon :size="20"><component :is="opt.icon" /></el-icon>
        </div>
        <div class="bg-mode-meta">
          <div class="bg-mode-title">{{ opt.label }}</div>
          <div class="bg-mode-desc">{{ opt.desc }}</div>
        </div>
        <div v-if="bgStore.mode === opt.value" class="bg-mode-check">
          <el-icon :size="16"><Check /></el-icon>
        </div>
      </div>
    </div>

    <!-- 换一张：仅 ACG / Bing -->
    <div
      v-if="bgStore.mode === 'acg' || bgStore.mode === 'bing'"
      class="bg-action-row"
    >
      <el-button
        type="primary"
        plain
        :icon="RefreshRight"
        :loading="bgStore.loading"
        @click="bgStore.next()"
      >
        换一张
      </el-button>
      <span class="bg-action-tip">
        每次刷新都会请求一张全新的{{ bgStore.mode === 'acg' ? '二次元' : '必应' }}壁纸
      </span>
    </div>

    <!-- 自定义上传面板 -->
    <div
      v-if="bgStore.mode === 'custom'"
      class="bg-upload-wrap"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop="handleDrop"
    >
      <div
        class="bg-upload-dropzone glass"
        :class="{ 'drag-active': dragActive }"
        @click="triggerUpload"
      >
        <input
          ref="uploadInputRef"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handleFileSelected"
        />
        <div class="upload-illustration">
          <el-icon :size="40" color="var(--primary)"><UploadFilled /></el-icon>
        </div>
        <div class="upload-title">
          {{ dragActive ? '松开即可上传' : '点击选择或拖拽图片到此' }}
        </div>
        <div class="upload-tip">支持 JPG / PNG / WEBP，不超过 {{ maxMB }}MB</div>
      </div>

      <div v-if="bgStore.customBase64" class="bg-preview-wrap">
        <div class="bg-preview-label">当前自定义背景预览：</div>
        <div class="bg-preview-img">
          <img :src="bgStore.customBase64" alt="custom bg preview" />
        </div>
        <el-button
          type="danger"
          plain
          size="small"
          :icon="Delete"
          @click.stop="handleClearCustom"
        >
          删除此背景
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="bgStore.error"
      type="error"
      show-icon
      :closable="false"
      :title="bgStore.error"
      style="margin-top: 12px"
    />
  </div>
</template>

<style scoped>
.bg-manager { padding: 4px; }
.bg-modes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.bg-mode-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}
.bg-mode-card:hover {
  border-color: var(--primary-soft);
  background: var(--bg-2);
  transform: translateY(-1px);
}
.bg-mode-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.bg-mode-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-2);
  color: var(--primary);
  flex-shrink: 0;
}
.bg-mode-card.active .bg-mode-icon {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 2px 6px var(--primary-soft);
}
.bg-mode-meta { flex: 1; min-width: 0; }
.bg-mode-title {
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  line-height: 1.25;
}
.bg-mode-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.35;
}
.bg-mode-check {
  color: var(--primary);
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  flex-shrink: 0;
}

.bg-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-2);
  border-radius: 12px;
  margin-bottom: 8px;
}
.bg-action-tip { font-size: 12px; color: var(--text-muted); }

.bg-upload-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bg-upload-dropzone {
  padding: 28px 18px;
  border: 2px dashed var(--border-strong);
  border-radius: 14px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.bg-upload-dropzone:hover,
.bg-upload-dropzone.drag-active {
  border-color: var(--primary);
  background: var(--primary-soft);
  border-style: solid;
}
.upload-illustration {
  width: 64px; height: 64px;
  border-radius: 16px;
  background: var(--primary-soft);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 10px;
}
.upload-title {
  font-size: 14px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  margin-bottom: 4px;
}
.upload-tip { font-size: 12px; color: var(--text-muted); }

.bg-preview-wrap {
  background: var(--bg-2);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bg-preview-label { font-size: 12px; color: var(--text-muted); font-weight: var(--font-weight-medium); }
.bg-preview-img {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.bg-preview-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
</style>
