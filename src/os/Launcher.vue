<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { installedApps } from '../apps/registry.js'
import { useSystemStore } from '../stores/system.js'
import { useChatStore } from '../stores/chatStore.js'
import { CloudSun, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Wind } from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const systemStore = useSystemStore()
const chatStore = useChatStore()

// Dock 栏应用（前4个）
const dockApps = computed(() => installedApps.value.slice(0, 4))

// 其他应用（第5个开始）
const gridApps = computed(() => installedApps.value.slice(4))

// 获取应用未读数（目前仅微信有）
function getAppUnread(appId) {
  if (appId === 'wechat') {
    return chatStore.getTotalUnread()
  }
  return 0
}

function openApp(appId) {
  router.push(`/app/${appId}`)
}

// 时间
const currentTime = ref(dayjs().format('HH:mm'))
const currentDate = computed(() => dayjs().format('M月D日 dddd'))

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
  fetchWeather()
})

onUnmounted(() => {
  stopTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// 天气数据
const weather = ref({
  temp: '--',
  condition: '加载中',
  humidity: '--',
  wind: '--',
  icon: 'CloudSun'
})

// 天气图标映射
const weatherIcons = {
  'Sun': Sun,
  'Cloud': Cloud,
  'CloudSun': CloudSun,
  'CloudRain': CloudRain,
  'CloudSnow': CloudSnow,
  'CloudLightning': CloudLightning,
  'CloudFog': CloudFog
}

const currentWeatherIcon = computed(() => weatherIcons[weather.value.icon] || CloudSun)

// 获取真实天气（使用 wttr.in 免费 API）
async function fetchWeather() {
  try {
    // 先获取用户位置
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('不支持定位'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        enableHighAccuracy: false
      })
    }).catch(() => null)

    let url = 'https://wttr.in/?format=j1'
    if (position) {
      const { latitude, longitude } = position.coords
      url = `https://wttr.in/${latitude},${longitude}?format=j1`
    }

    const response = await fetch(url)
    const data = await response.json()

    const current = data.current_condition[0]
    const tempC = parseInt(current.temp_C)
    const humidity = current.humidity
    const windSpeed = current.windspeedKmph
    const weatherCode = parseInt(current.weatherCode)

    // 根据天气代码映射图标和描述
    const { icon, condition } = mapWeatherCode(weatherCode)

    weather.value = {
      temp: tempC,
      condition: condition,
      humidity: humidity,
      wind: windSpeed,
      icon: icon
    }
  } catch (error) {
    console.error('获取天气失败:', error)
    weather.value = {
      temp: '--',
      condition: '获取失败',
      humidity: '--',
      wind: '--',
      icon: 'CloudSun'
    }
  }
}

function mapWeatherCode(code) {
  // wttr.in 天气代码映射
  if (code === 113) return { icon: 'Sun', condition: '晴' }
  if (code === 116) return { icon: 'CloudSun', condition: '多云' }
  if (code === 119 || code === 122) return { icon: 'Cloud', condition: '阴' }
  if ([143, 248, 260].includes(code)) return { icon: 'CloudFog', condition: '雾' }
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(code)) {
    return { icon: 'CloudRain', condition: '雨' }
  }
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(code)) {
    return { icon: 'CloudSnow', condition: '雪' }
  }
  if ([200, 386, 389, 392, 395].includes(code)) {
    return { icon: 'CloudLightning', condition: '雷暴' }
  }
  return { icon: 'CloudSun', condition: '多云' }
}
</script>

<template>
  <div class="launcher os-launcher">
    <!-- 顶部 Widget 区域 -->
    <div class="widget-area os-widget-area">
      <div class="widget-row">
        <!-- 时间日期 Widget -->
        <div class="widget time-widget os-widget os-time-widget">
          <div class="time-display os-time-display">{{ currentTime }}</div>
          <div class="date-display os-date-display">{{ currentDate }}</div>
        </div>

        <!-- 天气 Widget -->
        <div class="widget weather-widget os-widget os-weather-widget">
          <div class="weather-main">
            <component :is="currentWeatherIcon" :size="32" class="weather-icon os-weather-icon" />
            <span class="temp os-temp">{{ weather.temp }}°</span>
          </div>
          <div class="weather-condition os-weather-condition">{{ weather.condition }}</div>
          <div class="weather-details">
            <div class="detail-item">
              <Droplets :size="12" />
              <span>{{ weather.humidity }}%</span>
            </div>
            <div class="detail-item">
              <Wind :size="12" />
              <span>{{ weather.wind }}km/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中间应用网格区域 -->
    <div class="app-area os-app-area">
      <div class="app-grid os-app-grid" v-if="gridApps.length > 0">
        <div
          v-for="app in gridApps"
          :key="app.id"
          class="app-icon os-launcher-item"
          :data-app-id="app.id"
          @click="openApp(app.id)"
        >
          <div class="icon os-launcher-icon" :style="{ background: app.color || '#333' }">
            <component :is="app.icon" v-if="app.icon" :size="28" />
            <!-- 未读红点 -->
            <div v-if="getAppUnread(app.id) > 0" class="app-badge">
              {{ getAppUnread(app.id) > 99 ? '99+' : getAppUnread(app.id) }}
            </div>
          </div>
          <span class="name os-launcher-name">{{ app.name }}</span>
        </div>
      </div>
    </div>

    <!-- 底部 Dock 栏 -->
    <div class="dock-container os-dock-container">
      <div class="dock os-dock">
        <div
          v-for="app in dockApps"
          :key="app.id"
          class="dock-icon os-dock-item"
          :data-app-id="app.id"
          @click="openApp(app.id)"
        >
          <div class="icon os-dock-icon" :style="{ background: app.color || '#333' }">
            <component :is="app.icon" v-if="app.icon" :size="28" />
            <!-- 未读红点 -->
            <div v-if="getAppUnread(app.id) > 0" class="app-badge">
              {{ getAppUnread(app.id) > 99 ? '99+' : getAppUnread(app.id) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.launcher {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-top: 10px;
  overflow: hidden;
}

/* Widget 区域 */
.widget-area {
  padding: 0 16px;
  margin-bottom: 20px;
}

.widget-row {
  display: flex;
  gap: 12px;
}

.widget {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 时间 Widget */
.time-widget {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.time-display {
  font-size: 42px;
  font-weight: 200;
  color: #fff;
  line-height: 1;
  letter-spacing: -2px;
}

.date-display {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 6px;
}

/* 天气 Widget */
.weather-widget {
  width: 110px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.weather-icon {
  color: #ffd54f;
}

.temp {
  font-size: 28px;
  font-weight: 300;
  color: #fff;
}

.weather-condition {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
}

.weather-details {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

/* 应用网格区域 */
.app-area {
  flex: 1;
  padding: 8px 22px 0 16px;
  overflow-y: auto;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.app-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  overflow: visible;
}

.app-icon .icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: transform 0.2s;
  position: relative;
  overflow: visible;
}

.icon.os-launcher-icon,
.icon.os-dock-icon {
  overflow: visible !important;
}

.app-icon:active .icon {
  transform: scale(0.9);
}

/* 应用未读徽标 */
.app-badge {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(42%, -42%);
  min-width: 18px;
  height: 18px;
  background: #f44336;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-sizing: border-box;
  border: 2px solid rgba(0, 0, 0, 0.45);
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.app-icon .name {
  margin-top: 6px;
  font-size: 11px;
  color: #fff;
  text-align: center;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Dock 栏 */
.dock-container {
  padding: 16px 0 20px;
  display: flex;
  justify-content: center;
  overflow: visible;
}

.dock {
  width: 90%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  overflow: visible;
}

.dock-icon {
  cursor: pointer;
  overflow: visible;
}

.dock-icon .icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: transform 0.2s;
  position: relative;
  overflow: visible;
}

.dock-icon:active .icon {
  transform: scale(0.9);
}
</style>
