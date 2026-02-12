<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSystemStore } from '../stores/system.js'
import dayjs from 'dayjs'

const systemStore = useSystemStore()
const currentTime = ref(dayjs().format('HH:mm'))

const screenStyle = computed(() => {
  if (systemStore.wallpaper) {
    return {
      backgroundImage: `url(${systemStore.wallpaper})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})

// 动态注入用户自定义 CSS
let styleElement = null

function updateCustomCSS(css) {
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'user-theme'
    document.head.appendChild(styleElement)
  }
  styleElement.textContent = css
}

// 监听 customCSS 变化
watch(
  () => systemStore.customCSS,
  (newCSS) => {
    updateCustomCSS(newCSS)
  },
  { immediate: true }
)

let timer = null

function startTimer() {
  if (timer) return
  timer = setInterval(() => {
    currentTime.value = dayjs().format('HH:mm')
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopTimer()
  } else {
    currentTime.value = dayjs().format('HH:mm')
    startTimer()
  }
}

onMounted(() => {
  startTimer()
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 初始化时应用自定义 CSS
  if (systemStore.customCSS) {
    updateCustomCSS(systemStore.customCSS)
  }
})

onUnmounted(() => {
  stopTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // 清理 style 标签
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement)
  }
})
</script>

<template>
  <div class="phone-shell os-shell">
    <div class="phone-screen os-screen" :style="screenStyle">
      <!-- 状态栏 -->
      <div class="status-bar os-statusbar">
        <span class="time">{{ currentTime }}</span>
        <div class="status-right">
          <svg class="signal-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <rect x="1" y="14" width="4" height="8" rx="1" />
            <rect x="7" y="10" width="4" height="12" rx="1" />
            <rect x="13" y="6" width="4" height="16" rx="1" />
            <rect x="19" y="2" width="4" height="20" rx="1" />
          </svg>
          <span class="battery">{{ systemStore.batteryLevel }}%</span>
        </div>
      </div>
      <!-- 内容区域 -->
      <div class="content os-content">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-shell {
  width: 375px;
  height: 812px;
  max-height: calc(100vh - 20px);
  max-height: calc(100dvh - 20px); /* 动态视口高度，适配移动端浏览器 */
  border: 8px solid #000;
  border-radius: 40px;
  overflow: hidden;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #000;
}

/* 移动端：去掉外框，全屏显示 */
@media (max-width: 400px) {
  .phone-shell {
    width: 100%;
    height: 100%;
    max-height: 100vh;
    max-height: 100dvh;
    border: none;
    border-radius: 0;
    top: 0;
    left: 0;
    transform: none;
  }
}

.phone-screen {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.status-bar {
  height: 44px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.signal-icon {
  opacity: 0.9;
}

.content {
  flex: 1;
  overflow: hidden;
}
</style>
