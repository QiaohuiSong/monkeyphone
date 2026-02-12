<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ArrowLeft, Trophy, Play, RotateCcw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()

// ==================== 游戏配置 ====================
const GRID_SIZE = 20
const GAME_SPEED = 150 // ms per frame
const INITIAL_SNAKE_LENGTH = 3

// ==================== 游戏状态 ====================
const snake = ref([])
const food = ref({ x: 0, y: 0 })
const direction = ref('RIGHT')
const nextDirection = ref('RIGHT')
const score = ref(0)
const bestScore = ref(0)
const status = ref('IDLE') // 'IDLE' | 'PLAYING' | 'GAME_OVER'

let gameLoop = null

// ==================== 计算属性 ====================
const gridCells = computed(() => {
  const cells = []
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      cells.push({ x, y })
    }
  }
  return cells
})

// ==================== 初始化游戏 ====================
function initGame() {
  // 初始化蛇（从中间开始，向右）
  // 蛇头在前（x最大），尾巴在后（x最小）
  const startX = Math.floor(GRID_SIZE / 2)
  const startY = Math.floor(GRID_SIZE / 2)
  snake.value = []
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.value.push({ x: startX - i, y: startY })
  }

  direction.value = 'RIGHT'
  nextDirection.value = 'RIGHT'
  score.value = 0
  spawnFood()
}

// ==================== 生成食物 ====================
function spawnFood() {
  let newFood
  do {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    }
  } while (isSnakeCell(newFood.x, newFood.y))
  food.value = newFood
}

// ==================== 检查是否是蛇身 ====================
function isSnakeCell(x, y) {
  return snake.value.some(seg => seg.x === x && seg.y === y)
}

// ==================== 获取单元格类型 ====================
function getCellType(x, y) {
  // 蛇头
  if (snake.value.length > 0 && snake.value[0].x === x && snake.value[0].y === y) {
    return 'snake-head'
  }
  // 蛇身
  if (isSnakeCell(x, y)) {
    return 'snake-body'
  }
  // 食物
  if (food.value.x === x && food.value.y === y) {
    return 'food'
  }
  return 'empty'
}

// ==================== 游戏主循环 ====================
function gameStep() {
  if (status.value !== 'PLAYING') return

  // 应用缓存的方向
  direction.value = nextDirection.value

  // 计算新蛇头位置
  const head = snake.value[0]
  let newHead = { x: head.x, y: head.y }

  switch (direction.value) {
    case 'UP':
      newHead.y -= 1
      break
    case 'DOWN':
      newHead.y += 1
      break
    case 'LEFT':
      newHead.x -= 1
      break
    case 'RIGHT':
      newHead.x += 1
      break
  }

  // 碰撞检测 - 撞墙
  if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
    gameOver()
    return
  }

  // 碰撞检测 - 撞自己
  if (isSnakeCell(newHead.x, newHead.y)) {
    gameOver()
    return
  }

  // 移动蛇
  snake.value.unshift(newHead)

  // 检查是否吃到食物
  if (newHead.x === food.value.x && newHead.y === food.value.y) {
    score.value += 10
    spawnFood()
    // 不移除尾部，蛇变长
  } else {
    // 移除尾部
    snake.value.pop()
  }
}

// ==================== 开始游戏 ====================
function startGame() {
  initGame()
  status.value = 'PLAYING'
  gameLoop = setInterval(gameStep, GAME_SPEED)
}

// ==================== 游戏结束 ====================
function gameOver() {
  status.value = 'GAME_OVER'
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }
  // 更新最高分
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('snake_best_score', bestScore.value.toString())
  }
}

// ==================== 重新开始 ====================
function restartGame() {
  if (status.value === 'GAME_OVER') {
    startGame()
  }
}

// ==================== 键盘控制 ====================
function handleKeydown(e) {
  if (status.value !== 'PLAYING') return

  const key = e.key.toLowerCase()
  let newDirection = null

  // 方向键和WASD
  if (key === 'arrowup' || key === 'w') {
    newDirection = 'UP'
  } else if (key === 'arrowdown' || key === 's') {
    newDirection = 'DOWN'
  } else if (key === 'arrowleft' || key === 'a') {
    newDirection = 'LEFT'
  } else if (key === 'arrowright' || key === 'd') {
    newDirection = 'RIGHT'
  }

  if (!newDirection) return

  // 禁止180度掉头
  const opposites = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT'
  }

  if (opposites[newDirection] !== direction.value) {
    nextDirection.value = newDirection
  }
}

// ==================== 触摸控制 ====================
let touchStartX = 0
let touchStartY = 0

function handleTouchStart(e) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function handleTouchEnd(e) {
  if (status.value !== 'PLAYING') return

  const touchEndX = e.changedTouches[0].clientX
  const touchEndY = e.changedTouches[0].clientY

  const dx = touchEndX - touchStartX
  const dy = touchEndY - touchStartY

  // 判断滑动方向（需要滑动距离大于30px）
  if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return

  let newDirection = null

  if (Math.abs(dx) > Math.abs(dy)) {
    // 水平滑动
    newDirection = dx > 0 ? 'RIGHT' : 'LEFT'
  } else {
    // 垂直滑动
    newDirection = dy > 0 ? 'DOWN' : 'UP'
  }

  // 禁止180度掉头
  const opposites = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT'
  }

  if (opposites[newDirection] !== direction.value) {
    nextDirection.value = newDirection
  }
}

// ==================== 返回 ====================
function goBack() {
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }
  router.push('/')
}

// ==================== 生命周期 ====================
onMounted(() => {
  // 加载最高分
  const saved = localStorage.getItem('snake_best_score')
  if (saved) {
    bestScore.value = parseInt(saved) || 0
  }

  // 监听键盘
  window.addEventListener('keydown', handleKeydown)

  // 初始化游戏（但不开始）
  initGame()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }
})
</script>

<template>
  <div
    class="snake-app"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="nav-title">Retro Snake</span>
      <div style="width: 36px"></div>
    </div>

    <!-- 分数栏 -->
    <div class="score-bar">
      <div class="score-item">
        <span class="score-label">SCORE</span>
        <span class="score-value">{{ score }}</span>
      </div>
      <div class="score-divider"></div>
      <div class="score-item best">
        <Trophy :size="16" />
        <span class="score-label">BEST</span>
        <span class="score-value">{{ bestScore }}</span>
      </div>
    </div>

    <!-- 游戏区域 -->
    <div class="game-container">
      <div class="game-grid">
        <div
          v-for="cell in gridCells"
          :key="`${cell.x}-${cell.y}`"
          :class="['cell', getCellType(cell.x, cell.y)]"
        ></div>
      </div>

      <!-- 开始覆盖层 -->
      <div v-if="status === 'IDLE'" class="overlay" @click="startGame">
        <div class="overlay-content">
          <div class="overlay-icon">
            <Play :size="48" />
          </div>
          <div class="overlay-title">RETRO SNAKE</div>
          <div class="overlay-hint">点击开始游戏</div>
          <div class="overlay-controls">
            <span>PC: 方向键 / WASD</span>
            <span>移动端: 滑动屏幕</span>
          </div>
        </div>
      </div>

      <!-- 游戏结束覆盖层 -->
      <div v-if="status === 'GAME_OVER'" class="overlay game-over" @click="restartGame">
        <div class="overlay-content">
          <div class="overlay-icon">
            <RotateCcw :size="48" />
          </div>
          <div class="overlay-title">GAME OVER</div>
          <div class="final-score">得分: {{ score }}</div>
          <div class="overlay-hint">点击重新开始</div>
        </div>
      </div>
    </div>

    <!-- 虚拟方向键（移动端） -->
    <div class="virtual-controls">
      <div class="control-row">
        <button class="control-btn" @click="nextDirection = direction !== 'DOWN' ? 'UP' : direction">
          <span class="arrow up"></span>
        </button>
      </div>
      <div class="control-row">
        <button class="control-btn" @click="nextDirection = direction !== 'RIGHT' ? 'LEFT' : direction">
          <span class="arrow left"></span>
        </button>
        <div class="control-spacer"></div>
        <button class="control-btn" @click="nextDirection = direction !== 'LEFT' ? 'RIGHT' : direction">
          <span class="arrow right"></span>
        </button>
      </div>
      <div class="control-row">
        <button class="control-btn" @click="nextDirection = direction !== 'UP' ? 'DOWN' : direction">
          <span class="arrow down"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #fff;
  overflow: hidden;
  user-select: none;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
  color: #4ade80;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 分数栏 */
.score-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
}

.score-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-item.best {
  color: #fbbf24;
}

.score-label {
  font-size: 12px;
  opacity: 0.7;
  letter-spacing: 1px;
}

.score-value {
  font-size: 24px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.score-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
}

/* 游戏区域 */
.game-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  grid-template-rows: repeat(20, 1fr);
  gap: 1px;
  background: #0f0f1a;
  padding: 4px;
  border-radius: 8px;
  aspect-ratio: 1;
  width: 100%;
  max-width: min(calc(100vw - 32px), calc(100vh - 280px));
  box-shadow:
    0 0 20px rgba(74, 222, 128, 0.2),
    inset 0 0 20px rgba(0, 0, 0, 0.5);
}

.cell {
  background: #1e1e2e;
  border-radius: 2px;
  transition: background 0.1s;
}

.cell.snake-head {
  background: #22c55e;
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
}

.cell.snake-body {
  background: #4ade80;
  border-radius: 3px;
}

.cell.food {
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  animation: pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from { transform: scale(0.8); }
  to { transform: scale(1); }
}

/* 覆盖层 */
.overlay {
  position: absolute;
  inset: 16px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.overlay-content {
  text-align: center;
}

.overlay-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: rgba(74, 222, 128, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4ade80;
}

.game-over .overlay-icon {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.overlay-title {
  font-size: 28px;
  font-weight: 700;
  color: #4ade80;
  letter-spacing: 4px;
  margin-bottom: 12px;
}

.game-over .overlay-title {
  color: #ef4444;
}

.final-score {
  font-size: 20px;
  color: #fff;
  margin-bottom: 16px;
}

.overlay-hint {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 20px;
}

.overlay-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 虚拟方向键 */
.virtual-controls {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.control-btn:active {
  background: rgba(74, 222, 128, 0.3);
  transform: scale(0.95);
}

.control-spacer {
  width: 56px;
  height: 56px;
}

.arrow {
  width: 0;
  height: 0;
  border: 10px solid transparent;
}

.arrow.up {
  border-bottom: 14px solid #fff;
  border-top: none;
  margin-bottom: 4px;
}

.arrow.down {
  border-top: 14px solid #fff;
  border-bottom: none;
  margin-top: 4px;
}

.arrow.left {
  border-right: 14px solid #fff;
  border-left: none;
  margin-right: 4px;
}

.arrow.right {
  border-left: 14px solid #fff;
  border-right: none;
  margin-left: 4px;
}

/* 响应式 - 大屏隐藏虚拟按键 */
@media (min-width: 768px) {
  .virtual-controls {
    display: none;
  }

  .game-container {
    flex: 1;
  }
}
</style>
