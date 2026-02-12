<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ChevronLeft, ChevronRight, Heart, Sparkles, Users } from 'lucide-vue-next'
import { getMyCharacters, getCharacterForChat, getPersonas } from '../../services/api.js'
import { getAllAffections, getAffectionLevels } from './affectionApi.js'
import { useWebSocketStore } from '../../stores/websocketStore.js'

const characters = ref([])
const affections = ref({})
const levels = ref([])
const currentIndex = ref(0)
const loading = ref(true)

// 用户切换相关
const personas = ref([])  // 人设列表
const currentSessionId = ref('player')
const showUserSelector = ref(false)

// 计算所有可选身份（默认身份 + 所有人设）
const allSessions = computed(() => {
  const list = [{ id: 'player', name: '默认身份', avatar: null }]
  for (const p of personas.value) {
    list.push({ id: p.id, name: p.name, avatar: p.avatar })
  }
  return list
})

// 特效状态
const showRipple = ref(false)
const showParticles = ref(false)
const lastChange = ref(null)

// WebSocket store
const wsStore = useWebSocketStore()

// 所有可显示的角色（我的角色 + 有好感度数据的广场角色）
const allCharacters = computed(() => {
  return characters.value
})

// 当前选中的角色
const currentCharacter = computed(() => {
  if (allCharacters.value.length === 0) return null
  return allCharacters.value[currentIndex.value]
})

// 当前角色的好感度
const currentAffection = computed(() => {
  if (!currentCharacter.value) return { score: 0, level: 1, level_title: '陌生人', history: [] }
  return affections.value[currentCharacter.value.id] || { score: 0, level: 1, level_title: '陌生人', history: [] }
})

// 当前等级配置
const currentLevelConfig = computed(() => {
  const level = currentAffection.value.level
  return levels.value.find(l => l.level === level) || { min: 0, max: 50, level: 1, title: '陌生人' }
})

// 下一等级配置
const nextLevelConfig = computed(() => {
  const level = currentAffection.value.level
  return levels.value.find(l => l.level === level + 1) || null
})

// 当前等级进度 (0-100)
const levelProgress = computed(() => {
  const config = currentLevelConfig.value
  const score = currentAffection.value.score
  const range = config.max - config.min
  const progress = ((score - config.min) / range) * 100
  return Math.max(0, Math.min(100, progress))
})

// 距下一等级分数
const pointsToNextLevel = computed(() => {
  if (!nextLevelConfig.value) return 0
  return nextLevelConfig.value.min - currentAffection.value.score
})

// 心跳动画速度 (基于分数)
const heartbeatDuration = computed(() => {
  const score = currentAffection.value.score
  // 分数越高，心跳越快 (1.5s -> 0.5s)
  const duration = 1.5 - (score / 1000) * 1.0
  return Math.max(0.5, duration)
})

// 水位高度 (基于等级进度)
const waterLevel = computed(() => {
  return levelProgress.value
})

// 默认头像
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#ff6b9d" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)

// 切换角色
function prevCharacter() {
  if (allCharacters.value.length <= 1) return
  if (currentIndex.value > 0) {
    currentIndex.value--
  } else {
    currentIndex.value = allCharacters.value.length - 1
  }
  console.log('[LoveSpark] 切换到角色:', currentIndex.value, allCharacters.value[currentIndex.value]?.name)
}

function nextCharacter() {
  if (allCharacters.value.length <= 1) return
  if (currentIndex.value < allCharacters.value.length - 1) {
    currentIndex.value++
  } else {
    currentIndex.value = 0
  }
  console.log('[LoveSpark] 切换到角色:', currentIndex.value, allCharacters.value[currentIndex.value]?.name)
}

// 触发特效
function triggerEffect(change) {
  lastChange.value = change

  if (change > 0) {
    showParticles.value = true
    setTimeout(() => showParticles.value = false, 1500)
  }

  showRipple.value = true
  setTimeout(() => showRipple.value = false, 800)
}

// 格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

// 处理好感度更新
function handleAffectionUpdate(data) {
  const { charId, newScore, level, level_title, change, reason, sessionId } = data

  // 只处理当前选中的 session 的更新
  if (sessionId && sessionId !== currentSessionId.value) {
    return
  }

  // 更新好感度数据
  if (!affections.value[charId]) {
    affections.value[charId] = { score: 0, level: 1, level_title: '陌生人', history: [] }
  }

  affections.value[charId].score = newScore
  affections.value[charId].level = level
  affections.value[charId].level_title = level_title

  // 添加历史记录
  affections.value[charId].history.unshift({
    date: new Date().toISOString(),
    change,
    reason
  })

  // 只保留最近50条
  if (affections.value[charId].history.length > 50) {
    affections.value[charId].history = affections.value[charId].history.slice(0, 50)
  }

  // 如果是当前角色，触发特效
  if (currentCharacter.value && currentCharacter.value.id === charId) {
    triggerEffect(change)
  }
}

// 获取 session 显示名称
function getSessionDisplayName(sessionId) {
  const session = allSessions.value.find(s => s.id === sessionId)
  return session?.name || sessionId
}

// 切换用户
async function switchSession(sessionId) {
  currentSessionId.value = sessionId
  showUserSelector.value = false
  currentIndex.value = 0
  await loadAffectionData()
}

// 加载好感度数据
async function loadAffectionData() {
  try {
    const affs = await getAllAffections(currentSessionId.value)
    affections.value = affs

    // 更新角色列表（只显示有好感度数据的角色）
    const charList = [...characters.value]
    const myCharIds = new Set(characters.value.map(c => c.id))

    const affectionCharIds = Object.keys(affs)
    for (const charId of affectionCharIds) {
      if (!myCharIds.has(charId)) {
        try {
          const charData = await getCharacterForChat(charId)
          if (charData) {
            charList.push({
              id: charData.id,
              name: charData.name,
              avatar: charData.avatar,
              isPlazaChar: true
            })
            myCharIds.add(charId)
          }
        } catch (e) {
          console.warn(`广场角色 ${charId} 加载失败`)
        }
      }
    }

    characters.value = charList
  } catch (e) {
    console.error('加载好感度数据失败:', e)
  }
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [myChars, personaList, lvls] = await Promise.all([
      getMyCharacters(),
      getPersonas(),
      getAffectionLevels()
    ])

    characters.value = [...myChars]
    personas.value = personaList
    levels.value = lvls

    // 加载当前 session 的好感度数据
    await loadAffectionData()

    console.log('[LoveSpark] 加载完成，角色数量:', characters.value.length, '身份数量:', allSessions.value.length)
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadData()

  // 连接 WebSocket 并监听好感度更新
  wsStore.connect()
  wsStore.on('affection_update', handleAffectionUpdate)
})

onUnmounted(() => {
  // 移除监听器（不断开连接，其他组件可能还在用）
  wsStore.off('affection_update', handleAffectionUpdate)
})
</script>

<template>
  <div class="love-spark-app">
    <!-- 粒子背景 -->
    <div class="particles-bg">
      <div v-for="i in 20" :key="i" class="particle" :style="{ '--delay': i * 0.5 + 's', '--x': Math.random() * 100 + '%' }"></div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading">
      <Heart class="loading-heart" :size="48" />
      <span>加载中...</span>
    </div>

    <!-- 无角色 -->
    <div v-else-if="allCharacters.length === 0" class="empty">
      <Sparkles :size="64" />
      <p>还没有创建角色</p>
      <p class="hint">先去创建一个角色开始攻略吧~</p>
    </div>

    <!-- 主界面 -->
    <template v-else>
      <!-- 头部：角色切换 -->
      <div class="header">
        <button class="nav-btn" @click="prevCharacter" :disabled="allCharacters.length <= 1">
          <ChevronLeft :size="24" />
        </button>

        <div class="character-info">
          <div class="avatar-wrapper">
            <img :src="currentCharacter?.avatar || defaultAvatar" class="avatar" alt="" />
            <div class="avatar-glow"></div>
          </div>
          <div class="character-name">{{ currentCharacter?.name || '未知' }}</div>
          <div class="character-count">{{ currentIndex + 1 }} / {{ allCharacters.length }}</div>
        </div>

        <button class="nav-btn" @click="nextCharacter" :disabled="allCharacters.length <= 1">
          <ChevronRight :size="24" />
        </button>

        <!-- 右上角用户切换按钮 -->
        <button class="user-switch-btn" @click="showUserSelector = true">
          <Users :size="18" />
        </button>
      </div>

      <!-- 核心：心形展示 -->
      <div class="heart-container">
        <!-- 波纹特效 -->
        <div v-if="showRipple" class="ripple-effect" :class="{ positive: lastChange > 0, negative: lastChange < 0 }"></div>

        <!-- 粒子爆炸特效 -->
        <div v-if="showParticles" class="particles-burst">
          <div v-for="i in 12" :key="i" class="burst-particle" :style="{ '--angle': i * 30 + 'deg' }">💖</div>
        </div>

        <!-- SVG 心形 -->
        <svg class="heart-svg" viewBox="0 0 200 180" :style="{ '--heartbeat': heartbeatDuration + 's' }">
          <defs>
            <!-- 水位渐变 -->
            <linearGradient id="waterGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#ff1493" />
              <stop offset="50%" stop-color="#ff69b4" />
              <stop offset="100%" stop-color="#ffb6c1" />
            </linearGradient>

            <!-- 心形遮罩 -->
            <clipPath id="heartClip">
              <path d="M100,170 C35,120 0,75 0,50 C0,20 25,0 50,0 C70,0 90,15 100,35 C110,15 130,0 150,0 C175,0 200,20 200,50 C200,75 165,120 100,170 Z" />
            </clipPath>

            <!-- 发光滤镜 -->
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- 心形背景 -->
          <path
            class="heart-bg"
            d="M100,170 C35,120 0,75 0,50 C0,20 25,0 50,0 C70,0 90,15 100,35 C110,15 130,0 150,0 C175,0 200,20 200,50 C200,75 165,120 100,170 Z"
            fill="rgba(255,182,193,0.3)"
            filter="url(#glow)"
          />

          <!-- 水位填充 -->
          <g clip-path="url(#heartClip)">
            <rect
              class="water-fill"
              x="0"
              :y="170 - (waterLevel * 1.7)"
              width="200"
              :height="waterLevel * 1.7 + 10"
              fill="url(#waterGradient)"
            />
            <!-- 水波动画 -->
            <path
              class="water-wave"
              :d="`M0,${170 - (waterLevel * 1.7)} Q50,${165 - (waterLevel * 1.7)} 100,${170 - (waterLevel * 1.7)} T200,${170 - (waterLevel * 1.7)} V180 H0 Z`"
              fill="rgba(255,105,180,0.5)"
            />
          </g>

          <!-- 心形边框 -->
          <path
            class="heart-outline"
            d="M100,170 C35,120 0,75 0,50 C0,20 25,0 50,0 C70,0 90,15 100,35 C110,15 130,0 150,0 C175,0 200,20 200,50 C200,75 165,120 100,170 Z"
            fill="none"
            stroke="#ff1493"
            stroke-width="3"
            filter="url(#glow)"
          />
        </svg>

        <!-- 分数显示 -->
        <div class="score-display">
          <div class="score-number">{{ currentAffection.score }}</div>
          <div class="score-label">好感度</div>
        </div>
      </div>

      <!-- 称号 -->
      <div class="title-display">
        <span class="title-emoji">💖</span>
        <span class="title-text">{{ currentAffection.level_title }}</span>
        <span class="title-emoji">💖</span>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: levelProgress + '%' }"></div>
          <div class="progress-glow" :style="{ left: levelProgress + '%' }"></div>
        </div>
        <div class="progress-info">
          <span v-if="nextLevelConfig">
            距离「{{ nextLevelConfig.title }}」还需 <strong>{{ pointsToNextLevel }}</strong> 点
          </span>
          <span v-else class="max-level">
            <Sparkles :size="14" /> 已达最高等级 <Sparkles :size="14" />
          </span>
        </div>
      </div>

      <!-- 心动日记 -->
      <div class="diary-section">
        <div class="diary-header">
          <Heart :size="16" />
          <span>心动日记</span>
        </div>

        <div class="diary-list">
          <div v-if="!currentAffection.history || currentAffection.history.length === 0" class="diary-empty">
            还没有互动记录~
          </div>
          <div
            v-for="(item, index) in currentAffection.history?.slice(0, 20)"
            :key="index"
            class="diary-item"
            :class="{ positive: item.change > 0, negative: item.change < 0 }"
          >
            <span class="diary-date">{{ formatDate(item.date) }}</span>
            <span class="diary-reason">{{ item.reason }}</span>
            <span class="diary-change">
              {{ item.change > 0 ? '+' : '' }}{{ item.change }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- 用户切换选择器 -->
    <Teleport to="body">
      <div v-if="showUserSelector" class="user-selector-overlay" @click.self="showUserSelector = false">
        <div class="user-selector-modal">
          <div class="user-selector-header">
            <span>切换身份</span>
            <span class="current-user">当前: {{ getSessionDisplayName(currentSessionId) }}</span>
          </div>
          <div class="user-selector-list">
            <div
              v-for="session in allSessions"
              :key="session.id"
              class="user-selector-item"
              :class="{ active: session.id === currentSessionId }"
              @click="switchSession(session.id)"
            >
              <div class="user-avatar">
                <img v-if="session.avatar" :src="session.avatar" />
                <span v-else>{{ session.name[0] }}</span>
              </div>
              <div class="user-name">{{ session.name }}</div>
              <div v-if="session.id === currentSessionId" class="user-check">✓</div>
            </div>
          </div>
          <button class="user-selector-close" @click="showUserSelector = false">关闭</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.love-spark-app {
  height: 100%;
  background: linear-gradient(135deg, #1a0a14 0%, #2d0a1e 50%, #1a0a14 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 粒子背景 */
.particles-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #ff69b4;
  border-radius: 50%;
  left: var(--x);
  animation: floatUp 8s linear infinite;
  animation-delay: var(--delay);
  opacity: 0.4;
}

@keyframes floatUp {
  0% {
    transform: translateY(100vh) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 0.4;
  }
  90% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(-20px) scale(1);
    opacity: 0;
  }
}

/* 加载和空状态 */
.loading, .empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ff69b4;
  gap: 12px;
}

.loading-heart {
  animation: heartPulse 1s ease-in-out infinite;
}

@keyframes heartPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.empty .hint {
  font-size: 12px;
  color: #ff69b480;
}

/* 头部 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(180deg, rgba(255,20,147,0.15) 0%, transparent 100%);
  position: relative;
}

/* 右上角用户切换按钮 */
.user-switch-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255,105,180,0.3);
  color: #ff69b4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 10;
}

.user-switch-btn:active {
  transform: scale(0.9);
  background: rgba(255,105,180,0.5);
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255,105,180,0.2);
  color: #ff69b4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  position: relative;
  z-index: 10;
}

.nav-btn:active {
  transform: scale(0.9);
  background: rgba(255,105,180,0.4);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn:disabled:active {
  transform: none;
  background: rgba(255,105,180,0.2);
}

.character-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #ff69b4;
  box-shadow: 0 0 20px rgba(255,105,180,0.5);
}

.avatar-glow {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,105,180,0.4) 0%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

.character-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 0 10px rgba(255,105,180,0.5);
}

.character-count {
  font-size: 11px;
  color: #ff69b480;
}

/* 心形容器 */
.heart-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 200px;
}

.heart-svg {
  width: 180px;
  height: auto;
  animation: heartbeat var(--heartbeat) ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.1); }
  30% { transform: scale(1); }
  45% { transform: scale(1.08); }
  60% { transform: scale(1); }
}

.heart-outline {
  animation: outlineGlow 2s ease-in-out infinite;
}

@keyframes outlineGlow {
  0%, 100% { stroke-opacity: 0.8; }
  50% { stroke-opacity: 1; }
}

.water-wave {
  animation: waveMove 3s ease-in-out infinite;
}

@keyframes waveMove {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-10px); }
}

/* 分数显示 */
.score-display {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.score-number {
  font-size: 42px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 20px rgba(255,20,147,0.8), 0 0 40px rgba(255,105,180,0.4);
  line-height: 1;
}

.score-label {
  font-size: 12px;
  color: #ffb6c1;
  margin-top: 4px;
}

/* 波纹特效 */
.ripple-effect {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  animation: rippleExpand 0.8s ease-out forwards;
}

.ripple-effect.positive {
  border: 3px solid #ff69b4;
  box-shadow: 0 0 30px rgba(255,105,180,0.6);
}

.ripple-effect.negative {
  border: 3px solid #8b0000;
  box-shadow: 0 0 30px rgba(139,0,0,0.6);
}

@keyframes rippleExpand {
  0% {
    transform: scale(0.5);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* 粒子爆炸 */
.particles-burst {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.burst-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: 20px;
  animation: burstOut 1.5s ease-out forwards;
  transform-origin: center;
}

@keyframes burstOut {
  0% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(0);
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-100px) scale(1);
    opacity: 0;
  }
}

/* 称号 */
.title-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
}

.title-emoji {
  font-size: 18px;
  animation: sparkle 1.5s ease-in-out infinite;
}

.title-emoji:last-child {
  animation-delay: 0.75s;
}

@keyframes sparkle {
  0%, 100% { opacity: 0.6; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

.title-text {
  font-size: 20px;
  font-weight: 600;
  color: #ff69b4;
  text-shadow: 0 0 15px rgba(255,105,180,0.6);
}

/* 进度条 */
.progress-section {
  padding: 0 20px 12px;
}

.progress-bar {
  height: 8px;
  background: rgba(255,182,193,0.2);
  border-radius: 4px;
  overflow: visible;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff1493, #ff69b4, #ffb6c1);
  border-radius: 4px;
  transition: width 0.5s ease;
  box-shadow: 0 0 10px rgba(255,20,147,0.5);
}

.progress-glow {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 10px #ff69b4, 0 0 20px #ff1493;
  transition: left 0.5s ease;
}

.progress-info {
  text-align: center;
  font-size: 12px;
  color: #ffb6c1;
  margin-top: 8px;
}

.progress-info strong {
  color: #ff69b4;
  font-weight: 600;
}

.max-level {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #ffd700;
}

/* 心动日记 */
.diary-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,0.3);
  border-top: 1px solid rgba(255,105,180,0.2);
  border-radius: 20px 20px 0 0;
  overflow: hidden;
}

.diary-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  color: #ff69b4;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid rgba(255,105,180,0.15);
}

.diary-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.diary-empty {
  text-align: center;
  padding: 20px;
  color: #ff69b480;
  font-size: 13px;
}

.diary-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  margin-bottom: 6px;
  gap: 10px;
}

.diary-date {
  font-size: 11px;
  color: #888;
  flex-shrink: 0;
  padding-top: 1px;
}

.diary-reason {
  flex: 1;
  font-size: 13px;
  color: #ddd;
  line-height: 1.4;
  word-break: break-word;
}

.diary-change {
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
  padding-top: 1px;
}

.diary-item.positive .diary-change {
  color: #4caf50;
  text-shadow: 0 0 8px rgba(76,175,80,0.5);
}

.diary-item.negative .diary-change {
  color: #f44336;
  text-shadow: 0 0 8px rgba(244,67,54,0.5);
}

.diary-item.positive {
  border-left: 3px solid #4caf50;
}

.diary-item.negative {
  border-left: 3px solid #f44336;
}

/* 滚动条 */
.diary-list::-webkit-scrollbar {
  width: 4px;
}

.diary-list::-webkit-scrollbar-track {
  background: transparent;
}

.diary-list::-webkit-scrollbar-thumb {
  background: rgba(255,105,180,0.3);
  border-radius: 2px;
}

/* 用户选择器弹窗 */
.user-selector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.user-selector-modal {
  width: 280px;
  max-height: 400px;
  background: linear-gradient(135deg, #2d0a1e 0%, #1a0a14 100%);
  border-radius: 16px;
  border: 1px solid rgba(255,105,180,0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.user-selector-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255,105,180,0.2);
  color: #ff69b4;
  font-size: 16px;
  font-weight: 500;
}

.user-selector-header .current-user {
  display: block;
  font-size: 12px;
  color: #ff69b480;
  margin-top: 4px;
}

.user-selector-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.user-selector-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.user-selector-item:hover {
  background: rgba(255,105,180,0.15);
}

.user-selector-item.active {
  background: rgba(255,105,180,0.25);
  border: 1px solid rgba(255,105,180,0.4);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff1493, #ff69b4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar span {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.user-name {
  flex: 1;
  color: #fff;
  font-size: 14px;
}

.user-check {
  color: #ff69b4;
  font-size: 16px;
  font-weight: bold;
}

.user-selector-close {
  width: 100%;
  padding: 14px;
  border: none;
  border-top: 1px solid rgba(255,105,180,0.2);
  background: transparent;
  color: #ff69b480;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-selector-close:hover {
  background: rgba(255,105,180,0.1);
  color: #ff69b4;
}
</style>
