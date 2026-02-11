<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Play, Pause, RotateCw, ChevronLeft, ChevronRight, ChevronDown, ChevronsDown } from 'lucide-vue-next'

// 游戏配置
const COLS = 10
const ROWS = 20

// 7种标准方块定义 (I, J, L, O, S, T, Z)
const TETROMINOES = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00f5ff' // 青色霓虹
  },
  J: {
    shape: [[1, 0, 0], [1, 1, 1]],
    color: '#0066ff' // 蓝色霓虹
  },
  L: {
    shape: [[0, 0, 1], [1, 1, 1]],
    color: '#ff9500' // 橙色霓虹
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: '#ffff00' // 黄色霓虹
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: '#00ff66' // 绿色霓虹
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: '#cc00ff' // 紫色霓虹
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: '#ff0066' // 粉红霓虹
  }
}

const TETROMINO_KEYS = Object.keys(TETROMINOES)

// 游戏状态
const gameState = ref('ready') // ready, playing, paused, gameover
const score = ref(0)
const highScore = ref(0)
const level = ref(1)
const lines = ref(0)

// 游戏网格
const grid = ref([])
const currentPiece = ref(null)
const nextPiece = ref(null)
const pieceX = ref(0)
const pieceY = ref(0)

// 游戏循环
let gameLoop = null
let lastTime = 0
let dropCounter = 0
let dropInterval = 1000 // 初始下落间隔

// 初始化网格
function initGrid() {
  grid.value = Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
}

// 随机生成方块
function randomPiece() {
  const key = TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)]
  return {
    type: key,
    shape: TETROMINOES[key].shape.map(row => [...row]),
    color: TETROMINOES[key].color
  }
}

// 旋转方块
function rotatePiece(piece) {
  const rows = piece.shape.length
  const cols = piece.shape[0].length
  const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0))

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rotated[x][rows - 1 - y] = piece.shape[y][x]
    }
  }

  return { ...piece, shape: rotated }
}

// 碰撞检测
function checkCollision(piece, offsetX, offsetY) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = pieceX.value + x + offsetX
        const newY = pieceY.value + y + offsetY

        // 边界检测
        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true
        }

        // 与已放置方块碰撞
        if (newY >= 0 && grid.value[newY][newX]) {
          return true
        }
      }
    }
  }
  return false
}

// 放置方块到网格
function placePiece() {
  for (let y = 0; y < currentPiece.value.shape.length; y++) {
    for (let x = 0; x < currentPiece.value.shape[y].length; x++) {
      if (currentPiece.value.shape[y][x]) {
        const gridY = pieceY.value + y
        const gridX = pieceX.value + x
        if (gridY >= 0) {
          grid.value[gridY][gridX] = currentPiece.value.color
        }
      }
    }
  }
}

// 消除完整行
function clearLines() {
  let linesCleared = 0

  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid.value[y].every(cell => cell !== null)) {
      // 移除该行
      grid.value.splice(y, 1)
      // 在顶部添加新行
      grid.value.unshift(Array(COLS).fill(null))
      linesCleared++
      y++ // 重新检查当前行
    }
  }

  if (linesCleared > 0) {
    // 计分：1行=100, 2行=300, 3行=500, 4行=800
    const points = [0, 100, 300, 500, 800][linesCleared] * level.value
    score.value += points
    lines.value += linesCleared

    // 每10行升一级
    level.value = Math.floor(lines.value / 10) + 1
    dropInterval = Math.max(100, 1000 - (level.value - 1) * 100)
  }
}

// 生成新方块
function spawnPiece() {
  currentPiece.value = nextPiece.value || randomPiece()
  nextPiece.value = randomPiece()
  pieceX.value = Math.floor((COLS - currentPiece.value.shape[0].length) / 2)
  pieceY.value = 0

  // 检查游戏结束
  if (checkCollision(currentPiece.value, 0, 0)) {
    gameOver()
  }
}

// 移动方块
function movePiece(dx, dy) {
  if (gameState.value !== 'playing') return

  if (!checkCollision(currentPiece.value, dx, dy)) {
    pieceX.value += dx
    pieceY.value += dy
    return true
  }
  return false
}

// 旋转当前方块
function rotate() {
  if (gameState.value !== 'playing' || !currentPiece.value) return

  const rotated = rotatePiece(currentPiece.value)
  const originalX = pieceX.value

  // 尝试旋转，如果碰撞则尝试墙踢
  const kicks = [0, -1, 1, -2, 2]
  for (const kick of kicks) {
    pieceX.value = originalX + kick
    if (!checkCollision(rotated, 0, 0)) {
      currentPiece.value = rotated
      return
    }
  }

  pieceX.value = originalX
}

// 硬掉落
function hardDrop() {
  if (gameState.value !== 'playing') return

  while (!checkCollision(currentPiece.value, 0, 1)) {
    pieceY.value++
    score.value += 2 // 硬掉落加分
  }

  placePiece()
  clearLines()
  spawnPiece()
}

// 软掉落
function softDrop() {
  if (gameState.value !== 'playing') return

  if (movePiece(0, 1)) {
    score.value += 1 // 软掉落加分
    dropCounter = 0
  }
}

// 游戏循环
function update(time = 0) {
  if (gameState.value !== 'playing') return

  const deltaTime = time - lastTime
  lastTime = time
  dropCounter += deltaTime

  if (dropCounter > dropInterval) {
    if (!movePiece(0, 1)) {
      placePiece()
      clearLines()
      spawnPiece()
    }
    dropCounter = 0
  }

  gameLoop = requestAnimationFrame(update)
}

// 开始游戏
function startGame() {
  initGrid()
  score.value = 0
  level.value = 1
  lines.value = 0
  dropInterval = 1000
  dropCounter = 0

  nextPiece.value = randomPiece()
  spawnPiece()

  gameState.value = 'playing'
  lastTime = performance.now()
  gameLoop = requestAnimationFrame(update)
}

// 暂停/继续
function togglePause() {
  if (gameState.value === 'playing') {
    gameState.value = 'paused'
    cancelAnimationFrame(gameLoop)
  } else if (gameState.value === 'paused') {
    gameState.value = 'playing'
    lastTime = performance.now()
    gameLoop = requestAnimationFrame(update)
  }
}

// 游戏结束
async function gameOver() {
  gameState.value = 'gameover'
  cancelAnimationFrame(gameLoop)

  // 提交分数
  if (score.value > 0) {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/games/tetris/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score: score.value })
      })
      const data = await res.json()
      if (data.newRecord) {
        highScore.value = data.highScore
      }
    } catch (e) {
      console.error('提交分数失败:', e)
    }
  }
}

// 加载最高分
async function loadHighScore() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/games/tetris/score', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const data = await res.json()
    highScore.value = data.highScore || 0
  } catch (e) {
    console.error('加载最高分失败:', e)
  }
}

// 键盘控制
function handleKeydown(e) {
  if (gameState.value !== 'playing') {
    if (e.code === 'Space' && (gameState.value === 'ready' || gameState.value === 'gameover')) {
      startGame()
    }
    return
  }

  switch (e.code) {
    case 'ArrowLeft':
      movePiece(-1, 0)
      break
    case 'ArrowRight':
      movePiece(1, 0)
      break
    case 'ArrowDown':
      softDrop()
      break
    case 'ArrowUp':
      rotate()
      break
    case 'Space':
      hardDrop()
      break
    case 'KeyP':
    case 'Escape':
      togglePause()
      break
  }

  e.preventDefault()
}

// 计算渲染网格（包含当前方块）
const renderGrid = computed(() => {
  const display = grid.value.map(row => [...row])

  if (currentPiece.value && gameState.value === 'playing') {
    // 绘制幽灵方块（预览落点）
    let ghostY = pieceY.value
    while (!checkCollision(currentPiece.value, 0, ghostY - pieceY.value + 1)) {
      ghostY++
    }

    for (let y = 0; y < currentPiece.value.shape.length; y++) {
      for (let x = 0; x < currentPiece.value.shape[y].length; x++) {
        if (currentPiece.value.shape[y][x]) {
          const gridY = ghostY + y
          const gridX = pieceX.value + x
          if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
            if (!display[gridY][gridX]) {
              display[gridY][gridX] = currentPiece.value.color + '40' // 半透明
            }
          }
        }
      }
    }

    // 绘制当前方块
    for (let y = 0; y < currentPiece.value.shape.length; y++) {
      for (let x = 0; x < currentPiece.value.shape[y].length; x++) {
        if (currentPiece.value.shape[y][x]) {
          const gridY = pieceY.value + y
          const gridX = pieceX.value + x
          if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
            display[gridY][gridX] = currentPiece.value.color
          }
        }
      }
    }
  }

  return display
})

// 生命周期
onMounted(() => {
  loadHighScore()
  initGrid()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (gameLoop) {
    cancelAnimationFrame(gameLoop)
  }
  // 自动暂停
  if (gameState.value === 'playing') {
    gameState.value = 'paused'
  }
})
</script>

<template>
  <div class="tetris-app">
    <!-- 顶部信息栏 -->
    <div class="header">
      <div class="title">
        <span class="neon-text">TETRIS</span>
      </div>
    </div>

    <!-- 游戏主体 -->
    <div class="game-container">
      <!-- 左侧信息面板 -->
      <div class="side-panel left">
        <div class="info-box">
          <div class="info-label">SCORE</div>
          <div class="info-value neon-text">{{ score }}</div>
        </div>
        <div class="info-box">
          <div class="info-label">BEST</div>
          <div class="info-value neon-text gold">{{ highScore }}</div>
        </div>
        <div class="info-box">
          <div class="info-label">LEVEL</div>
          <div class="info-value neon-text cyan">{{ level }}</div>
        </div>
        <div class="info-box">
          <div class="info-label">LINES</div>
          <div class="info-value neon-text green">{{ lines }}</div>
        </div>
      </div>

      <!-- 游戏网格 -->
      <div class="game-board">
        <div class="grid">
          <div
            v-for="(row, y) in renderGrid"
            :key="y"
            class="grid-row"
          >
            <div
              v-for="(cell, x) in row"
              :key="x"
              class="grid-cell"
              :style="cell ? {
                backgroundColor: cell,
                boxShadow: `0 0 10px ${cell}, inset 0 0 5px rgba(255,255,255,0.3)`
              } : {}"
            />
          </div>
        </div>

        <!-- 游戏状态覆盖层 -->
        <div v-if="gameState !== 'playing'" class="overlay">
          <div v-if="gameState === 'ready'" class="overlay-content">
            <div class="overlay-title neon-text">TETRIS</div>
            <div class="overlay-subtitle">Press SPACE or tap START</div>
            <button class="start-btn" @click="startGame">
              <Play :size="24" />
              START
            </button>
          </div>

          <div v-else-if="gameState === 'paused'" class="overlay-content">
            <div class="overlay-title neon-text cyan">PAUSED</div>
            <button class="start-btn" @click="togglePause">
              <Play :size="24" />
              RESUME
            </button>
          </div>

          <div v-else-if="gameState === 'gameover'" class="overlay-content">
            <div class="overlay-title neon-text red">GAME OVER</div>
            <div class="final-score">
              <span>Score: {{ score }}</span>
              <span v-if="score >= highScore && score > 0" class="new-record">NEW RECORD!</span>
            </div>
            <button class="start-btn" @click="startGame">
              <RotateCw :size="24" />
              RETRY
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧预览面板 -->
      <div class="side-panel right">
        <div class="info-box next-box">
          <div class="info-label">NEXT</div>
          <div class="next-preview">
            <div v-if="nextPiece" class="preview-grid">
              <div
                v-for="(row, y) in nextPiece.shape"
                :key="y"
                class="preview-row"
              >
                <div
                  v-for="(cell, x) in row"
                  :key="x"
                  class="preview-cell"
                  :style="cell ? {
                    backgroundColor: nextPiece.color,
                    boxShadow: `0 0 8px ${nextPiece.color}`
                  } : {}"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 虚拟按键 -->
    <div class="controls">
      <div class="control-row">
        <button
          class="control-btn"
          @touchstart.prevent="rotate"
          @mousedown="rotate"
        >
          <RotateCw :size="22" />
        </button>
      </div>
      <div class="control-row main-controls">
        <button
          class="control-btn"
          @touchstart.prevent="movePiece(-1, 0)"
          @mousedown="movePiece(-1, 0)"
        >
          <ChevronLeft :size="26" />
        </button>
        <button
          class="control-btn"
          @touchstart.prevent="softDrop"
          @mousedown="softDrop"
        >
          <ChevronDown :size="26" />
        </button>
        <button
          class="control-btn"
          @touchstart.prevent="movePiece(1, 0)"
          @mousedown="movePiece(1, 0)"
        >
          <ChevronRight :size="26" />
        </button>
      </div>
      <div class="control-row">
        <button
          class="control-btn drop-btn"
          @touchstart.prevent="hardDrop"
          @mousedown="hardDrop"
        >
          <ChevronsDown :size="22" />
          <span>DROP</span>
        </button>
        <button
          class="control-btn pause-btn"
          @touchstart.prevent="togglePause"
          @mousedown="togglePause"
        >
          <Pause v-if="gameState === 'playing'" :size="20" />
          <Play v-else :size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tetris-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
  color: #fff;
  overflow: hidden;
  font-family: 'Orbitron', 'Courier New', monospace;
}

/* 霓虹文字效果 */
.neon-text {
  color: #ff00ff;
  text-shadow:
    0 0 5px #ff00ff,
    0 0 10px #ff00ff,
    0 0 20px #ff00ff,
    0 0 40px #ff00ff;
}

.neon-text.gold {
  color: #ffd700;
  text-shadow:
    0 0 5px #ffd700,
    0 0 10px #ffd700,
    0 0 20px #ffd700;
}

.neon-text.cyan {
  color: #00f5ff;
  text-shadow:
    0 0 5px #00f5ff,
    0 0 10px #00f5ff,
    0 0 20px #00f5ff;
}

.neon-text.green {
  color: #00ff66;
  text-shadow:
    0 0 5px #00ff66,
    0 0 10px #00ff66,
    0 0 20px #00ff66;
}

.neon-text.red {
  color: #ff0066;
  text-shadow:
    0 0 5px #ff0066,
    0 0 10px #ff0066,
    0 0 20px #ff0066;
}

/* 顶部标题 */
.header {
  padding: 4px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 0, 255, 0.3);
}

.title {
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 6px;
}

/* 游戏容器 */
.game-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 4px;
  min-height: 0;
}

/* 侧边面板 */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 65px;
}

.info-box {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 0, 255, 0.4);
  border-radius: 4px;
  padding: 4px;
  text-align: center;
}

.info-label {
  font-size: 8px;
  color: #888;
  letter-spacing: 1px;
  margin-bottom: 1px;
}

.info-value {
  font-size: 13px;
  font-weight: bold;
}

/* 下一个方块预览 */
.next-box {
  padding: 6px;
}

.next-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40px;
}

.preview-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-row {
  display: flex;
  gap: 2px;
}

.preview-cell {
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

/* 游戏面板 */
.game-board {
  position: relative;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 0, 255, 0.6);
  border-radius: 4px;
  box-shadow:
    0 0 20px rgba(255, 0, 255, 0.3),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
  padding: 4px;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.grid-row {
  display: flex;
  gap: 1px;
}

.grid-cell {
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 2px;
  transition: background-color 0.1s;
}

/* 覆盖层 */
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.overlay-content {
  text-align: center;
  padding: 20px;
}

.overlay-title {
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 4px;
  margin-bottom: 16px;
}

.overlay-subtitle {
  font-size: 12px;
  color: #888;
  margin-bottom: 20px;
}

.final-score {
  font-size: 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.new-record {
  color: #ffd700;
  font-size: 14px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #ff00ff 0%, #00f5ff 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(255, 0, 255, 0.8);
}

.start-btn:active {
  transform: scale(0.95);
}

/* 虚拟按键 */
.controls {
  padding: 6px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 0, 255, 0.3);
}

.control-row {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.main-controls {
  gap: 16px;
}

.control-btn {
  width: 44px;
  height: 44px;
  border: 2px solid rgba(255, 0, 255, 0.5);
  border-radius: 10px;
  background: rgba(255, 0, 255, 0.1);
  color: #ff00ff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.control-btn:active {
  background: rgba(255, 0, 255, 0.3);
  transform: scale(0.95);
  box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
}

.control-btn span {
  font-size: 9px;
  font-weight: bold;
}

.drop-btn {
  width: 80px;
  background: rgba(0, 245, 255, 0.1);
  border-color: rgba(0, 245, 255, 0.5);
  color: #00f5ff;
}

.drop-btn:active {
  background: rgba(0, 245, 255, 0.3);
  box-shadow: 0 0 15px rgba(0, 245, 255, 0.5);
}

.pause-btn {
  width: 44px;
  background: rgba(255, 153, 0, 0.1);
  border-color: rgba(255, 153, 0, 0.5);
  color: #ff9900;
}

.pause-btn:active {
  background: rgba(255, 153, 0, 0.3);
  box-shadow: 0 0 15px rgba(255, 153, 0, 0.5);
}

/* 响应式调整 */
@media (max-height: 600px) {
  .header {
    padding: 4px 16px;
  }

  .title {
    font-size: 18px;
  }

  .game-container {
    padding: 4px;
    gap: 4px;
  }

  .side-panel {
    width: 60px;
  }

  .info-box {
    padding: 4px;
  }

  .info-value {
    font-size: 12px;
  }

  .grid-cell {
    width: 15px;
    height: 15px;
  }

  .controls {
    padding: 4px 8px 6px;
    gap: 3px;
  }

  .control-btn {
    width: 40px;
    height: 40px;
  }

  .drop-btn {
    width: 70px;
  }
}
</style>
