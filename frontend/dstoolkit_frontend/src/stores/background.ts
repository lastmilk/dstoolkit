/**
 * 背景管理 Store
 * 支持 4 种模式：
 *  - off       : 关闭背景，使用主题纯色
 *  - acg       : 随机二次元背景（API：https://blog.yeqing.net/acg-api/）
 *  - bing      : 随机必应壁纸（每日更新）
 *  - custom    : 用户自定义上传（≤5MB 图片，存 localStorage base64）
 *
 *  持久化：localStorage
 *  自动缓存：远程背景 URL（避免每次切换都请求新图）
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type BackgroundMode = 'off' | 'acg' | 'bing' | 'custom'

const STORAGE_KEY_MODE = 'dstoolkit_bg_mode'
const STORAGE_KEY_DATA = 'dstoolkit_bg_data'
const STORAGE_KEY_CACHED_URL = 'dstoolkit_bg_cached_url'
const STORAGE_KEY_CUSTOM = 'dstoolkit_bg_custom'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

// ACG API：https://acg.toubiec.cn/random.php 或 https://api.btstu.cn/sjbz/api.php?lx=dongman
// 按用户给的参考：https://blog.yeqing.net/acg-api/ 中推荐的接口
const ACG_API_URLS = [
  'https://acg.toubiec.cn/random.php',
  'https://api.btstu.cn/sjbz/api.php?lx=dongman',
  'https://api.vvhan.com/api/acgimg',
]
// Bing 每日壁纸（支持 idx 参数随机）
const BING_API_URL = 'https://bing.img.run/rand.php'

export const useBackgroundStore = defineStore('background', () => {
  // ========= 状态 =========
  const mode = ref<BackgroundMode>(
    (localStorage.getItem(STORAGE_KEY_MODE) as BackgroundMode) || 'off'
  )
  /** 当前生效的背景 URL（远程或自定义 base64），空字符串表示关闭 */
  const currentUrl = ref<string>('')
  /** 缓存的上次 URL，避免频繁请求 */
  const cachedUrl = ref<string>(localStorage.getItem(STORAGE_KEY_CACHED_URL) || '')
  /** 自定义背景的 base64（持久化） */
  const customBase64 = ref<string>(localStorage.getItem(STORAGE_KEY_CUSTOM) || '')
  /** 加载状态 */
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ========= 工具 =========
  function pickAcgApi(): string {
    const i = Math.floor(Math.random() * ACG_API_URLS.length)
    return ACG_API_URLS[i]!
  }

  function buildBingUrlWithCacheBust(): string {
    // 添加时间戳避免浏览器缓存，实现每次刷新换图
    return `${BING_API_URL}?_t=${Date.now()}`
  }

  function buildAcgUrlWithCacheBust(): string {
    return `${pickAcgApi()}?_t=${Date.now()}`
  }

  function applyToDom(url: string) {
    currentUrl.value = url
    if (typeof document === 'undefined') return
    const body = document.body
    if (url) {
      body.style.setProperty('--app-background-image', `url("${url}")`)
      body.setAttribute('data-bg-mode', mode.value)
    } else {
      body.style.removeProperty('--app-background-image')
      body.setAttribute('data-bg-mode', 'off')
    }
  }

  // ========= Actions =========

  /** 初始化：根据模式加载背景 */
  function init() {
    // 任何状态变化都持久化
    watch(mode, (v) => localStorage.setItem(STORAGE_KEY_MODE, v))
    watch(cachedUrl, (v) => v && localStorage.setItem(STORAGE_KEY_CACHED_URL, v))
    watch(customBase64, (v) => {
      if (v) localStorage.setItem(STORAGE_KEY_CUSTOM, v)
      else localStorage.removeItem(STORAGE_KEY_CUSTOM)
    })

    // 首次应用
    restoreBackground()
  }

  /** 恢复背景（打开页面时） */
  function restoreBackground() {
    switch (mode.value) {
      case 'off':
        applyToDom('')
        break
      case 'acg':
      case 'bing':
        // 使用缓存 URL，没有就重新获取
        if (cachedUrl.value) {
          applyToDom(cachedUrl.value)
        } else {
          void fetchRemoteBackground()
        }
        break
      case 'custom':
        if (customBase64.value) {
          applyToDom(customBase64.value)
        } else {
          // 用户清空或没上传过，回退到 off
          mode.value = 'off'
          applyToDom('')
        }
        break
    }
  }

  /** 切换模式 */
  function setMode(newMode: BackgroundMode) {
    if (mode.value === newMode && newMode !== 'acg' && newMode !== 'bing') return
    mode.value = newMode
    switch (newMode) {
      case 'off':
        applyToDom('')
        break
      case 'acg':
      case 'bing':
        void fetchRemoteBackground(true /* force refresh */)
        break
      case 'custom':
        if (customBase64.value) {
          applyToDom(customBase64.value)
        } else {
          error.value = '请先上传自定义背景图片'
        }
        break
    }
  }

  /** 获取远程背景（acg / bing） */
  async function fetchRemoteBackground(force = false): Promise<string | null> {
    if (loading.value) return null
    // 如果不强制刷新且缓存存在，直接使用
    if (!force && cachedUrl.value) {
      applyToDom(cachedUrl.value)
      return cachedUrl.value
    }
    loading.value = true
    error.value = null
    try {
      const url = mode.value === 'bing' ? buildBingUrlWithCacheBust() : buildAcgUrlWithCacheBust()
      // 远程图片直接使用 URL（不下载转 base64，减少存储占用）
      cachedUrl.value = url
      applyToDom(url)
      return url
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载背景失败'
      return null
    } finally {
      loading.value = false
    }
  }

  /** 换一张（只对 acg / bing 模式有效） */
  async function next() {
    if (mode.value === 'acg' || mode.value === 'bing') {
      cachedUrl.value = ''
      localStorage.removeItem(STORAGE_KEY_CACHED_URL)
      await fetchRemoteBackground(true)
    }
  }

  /** 上传自定义背景 */
  async function uploadCustom(file: File): Promise<boolean> {
    if (!file.type.startsWith('image/')) {
      error.value = '只支持图片文件'
      return false
    }
    if (file.size > MAX_SIZE_BYTES) {
      error.value = `图片大小不能超过 5MB（当前 ${(file.size / 1024 / 1024).toFixed(2)}MB）`
      return false
    }
    loading.value = true
    error.value = null
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        customBase64.value = dataUrl
        // 切换到 custom 模式
        mode.value = 'custom'
        applyToDom(dataUrl)
        loading.value = false
        resolve(true)
      }
      reader.onerror = () => {
        error.value = '图片读取失败'
        loading.value = false
        resolve(false)
      }
      reader.readAsDataURL(file)
    })
  }

  /** 清除自定义背景 */
  function clearCustom() {
    customBase64.value = ''
    localStorage.removeItem(STORAGE_KEY_CUSTOM)
    if (mode.value === 'custom') {
      mode.value = 'off'
      applyToDom('')
    }
  }

  return {
    // state
    mode,
    currentUrl,
    cachedUrl,
    customBase64,
    loading,
    error,
    // actions
    init,
    setMode,
    fetchRemoteBackground,
    next,
    uploadCustom,
    clearCustom,
    // constants
    MAX_SIZE_BYTES,
  }
})
