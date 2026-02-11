<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Calendar, Heart, Droplets, Moon, Sun, Sparkles } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()

// 状态
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageType = ref('info')

// 周期配置
const lastPeriodDate = ref('')
const cycleLength = ref(28)
const periodDuration = ref(5)

// 当前状态
const status = ref({
  phase: 'unknown',
  days_until_next: null,
  current_day: null,
  next_period_date: null
})

// 计算显示文本
const statusText = computed(() => {
  if (status.value.phase === 'unknown' || !lastPeriodDate.value) {
    return '请设置经期信息'
  }
  if (status.value.phase === 'period') {
    return `经期第 ${status.value.current_day} 天`
  }
  if (status.value.phase === 'pms') {
    return `经期将在 ${status.value.days_until_next} 天后到来`
  }
  if (status.value.phase === 'ovulation') {
    return `排卵期 · 距经期 ${status.value.days_until_next} 天`
  }
  return `距离下次经期还有 ${status.value.days_until_next} 天`
})

// 计算副标题
const statusSubtext = computed(() => {
  if (status.value.phase === 'period') {
    return '注意保暖，多喝热水'
  }
  if (status.value.phase === 'pms') {
    return '经期即将到来，请做好准备'
  }
  if (status.value.phase === 'ovulation') {
    return '排卵期，注意身体变化'
  }
  if (status.value.phase === 'unknown') {
    return '记录周期，关爱自己'
  }
  return '一切正常，保持好心情'
})

// 背景样式
const headerStyle = computed(() => {
  if (status.value.phase === 'period') {
    return 'background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);'
  }
  if (status.value.phase === 'pms') {
    return 'background: linear-gradient(135deg, #ffa07a 0%, #ff6b6b 100%);'
  }
  if (status.value.phase === 'ovulation') {
    return 'background: linear-gradient(135deg, #a8e6cf 0%, #88d8b0 100%);'
  }
  return 'background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);'
})

// 状态图标
const statusIcon = computed(() => {
  if (status.value.phase === 'period') return Droplets
  if (status.value.phase === 'pms') return Moon
  if (status.value.phase === 'ovulation') return Sparkles
  return Sun
})

// 获取状态
async function fetchStatus() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch('/api/health/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.cycle_config) {
      lastPeriodDate.value = data.cycle_config.last_period_date || ''
      cycleLength.value = data.cycle_config.cycle_length || 28
      periodDuration.value = data.cycle_config.period_duration || 5
    }
    if (data.status) {
      status.value = data.status
    }
  } catch (e) {
    console.error('获取状态失败:', e)
  } finally {
    loading.value = false
  }
}

// 保存设置
async function saveSettings() {
  if (!lastPeriodDate.value) {
    showMessage('请选择上次经期日期', 'error')
    return
  }

  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch('/api/health/cycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        last_period_date: lastPeriodDate.value,
        cycle_length: cycleLength.value,
        period_duration: periodDuration.value
      })
    })

    const data = await res.json()
    if (data.success) {
      status.value = data.status
      showMessage('保存成功', 'success')
    } else {
      showMessage('保存失败', 'error')
    }
  } catch (e) {
    console.error('保存失败:', e)
    showMessage('保存失败: ' + e.message, 'error')
  } finally {
    saving.value = false
  }
}

// 显示消息
function showMessage(text, type = 'info') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 2000)
}

// 返回
function goBack() {
  router.push('/')
}

// 生成日历数据
const calendarDays = computed(() => {
  if (!status.value.next_period_date) return []

  const today = new Date()
  const days = []

  // 显示当前月份
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 填充前面的空白
  const startPadding = firstDay.getDay()
  for (let i = 0; i < startPadding; i++) {
    days.push({ day: '', type: 'empty' })
  }

  // 填充日期
  const nextPeriod = new Date(status.value.next_period_date)
  const periodEnd = new Date(nextPeriod)
  periodEnd.setDate(periodEnd.getDate() + periodDuration.value - 1)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    let type = 'normal'

    if (date.toDateString() === today.toDateString()) {
      type = 'today'
    } else if (date >= nextPeriod && date <= periodEnd) {
      type = 'period'
    } else if (date >= new Date(nextPeriod.getTime() - 3 * 24 * 60 * 60 * 1000) && date < nextPeriod) {
      type = 'pms'
    }

    days.push({ day: d, type })
  }

  return days
})

onMounted(() => {
  fetchStatus()
})
</script>

<template>
  <div class="cycle-app">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="nav-title">经期助手</span>
      <div style="width: 36px"></div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" :class="['toast', messageType]">
      {{ message }}
    </div>

    <!-- 状态卡片 -->
    <div class="status-card" :style="headerStyle">
      <div class="status-icon">
        <component :is="statusIcon" :size="48" />
      </div>
      <div class="status-main">{{ statusText }}</div>
      <div class="status-sub">{{ statusSubtext }}</div>
      <div v-if="status.next_period_date" class="status-date">
        <Calendar :size="14" />
        <span>预计 {{ status.next_period_date }}</span>
      </div>
    </div>

    <!-- 主内容 -->
    <div class="content">
      <!-- 设置区域 -->
      <div class="settings-section">
        <div class="section-title">
          <Heart :size="18" />
          <span>周期设置</span>
        </div>

        <div class="setting-item">
          <label>上次经期开始日期</label>
          <input
            type="date"
            v-model="lastPeriodDate"
            class="date-input"
          />
        </div>

        <div class="setting-row">
          <div class="setting-item half">
            <label>平均周期 (天)</label>
            <input
              type="number"
              v-model.number="cycleLength"
              min="21"
              max="45"
              class="number-input"
            />
          </div>
          <div class="setting-item half">
            <label>持续天数</label>
            <input
              type="number"
              v-model.number="periodDuration"
              min="2"
              max="10"
              class="number-input"
            />
          </div>
        </div>

        <button
          class="save-btn"
          @click="saveSettings"
          :disabled="saving"
        >
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>

      <!-- 日历预览 -->
      <div v-if="status.next_period_date" class="calendar-section">
        <div class="section-title">
          <Calendar :size="18" />
          <span>本月预览</span>
        </div>

        <div class="calendar-header">
          <span>日</span>
          <span>一</span>
          <span>二</span>
          <span>三</span>
          <span>四</span>
          <span>五</span>
          <span>六</span>
        </div>

        <div class="calendar-grid">
          <div
            v-for="(item, idx) in calendarDays"
            :key="idx"
            :class="['calendar-day', item.type]"
          >
            {{ item.day }}
          </div>
        </div>

        <div class="calendar-legend">
          <div class="legend-item">
            <span class="legend-dot today"></span>
            <span>今天</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot pms"></span>
            <span>经前期</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot period"></span>
            <span>经期</span>
          </div>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="tips-section">
        <div class="tip-card" v-if="status.phase === 'pms'">
          <Moon :size="20" />
          <div class="tip-content">
            <div class="tip-title">经前期提醒</div>
            <div class="tip-text">注意休息，避免剧烈运动，保持心情愉悦</div>
          </div>
        </div>
        <div class="tip-card" v-else-if="status.phase === 'period'">
          <Droplets :size="20" />
          <div class="tip-content">
            <div class="tip-title">经期关怀</div>
            <div class="tip-text">多喝温水，注意保暖，避免生冷食物</div>
          </div>
        </div>
        <div class="tip-card" v-else>
          <Sparkles :size="20" />
          <div class="tip-content">
            <div class="tip-title">健康提示</div>
            <div class="tip-text">记录周期有助于更好地了解自己的身体</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cycle-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff5f5;
  color: #333;
  overflow: hidden;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #ffe0e6;
}

.nav-title {
  font-size: 17px;
  font-weight: 500;
  color: #e91e63;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #e91e63;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 消息提示 */
.toast {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 100;
  animation: fadeIn 0.3s ease;
}

.toast.info { background: #e3f2fd; color: #1976d2; }
.toast.success { background: #e8f5e9; color: #388e3c; }
.toast.error { background: #ffebee; color: #d32f2f; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 状态卡片 */
.status-card {
  margin: 12px;
  padding: 24px 20px;
  border-radius: 20px;
  color: #fff;
  text-align: center;
  box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);
}

.status-icon {
  margin-bottom: 12px;
  opacity: 0.9;
}

.status-main {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.status-sub {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 12px;
}

.status-date {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: rgba(255,255,255,0.2);
  padding: 6px 12px;
  border-radius: 20px;
}

/* 主内容 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 20px;
}

/* 设置区域 */
.settings-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #e91e63;
  margin-bottom: 16px;
}

.setting-item {
  margin-bottom: 14px;
}

.setting-item label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.setting-row {
  display: flex;
  gap: 12px;
}

.setting-item.half {
  flex: 1;
}

.date-input,
.number-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ffe0e6;
  border-radius: 10px;
  font-size: 15px;
  background: #fff;
  color: #333;
  box-sizing: border-box;
}

.date-input:focus,
.number-input:focus {
  outline: none;
  border-color: #e91e63;
}

.save-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #e91e63 0%, #f06292 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s;
}

.save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(233, 30, 99, 0.4);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 日历区域 */
.calendar-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border-radius: 50%;
  color: #333;
}

.calendar-day.empty {
  background: transparent;
}

.calendar-day.today {
  background: #e91e63;
  color: #fff;
  font-weight: 600;
}

.calendar-day.period {
  background: #ffcdd2;
  color: #c62828;
}

.calendar-day.pms {
  background: #ffe0b2;
  color: #e65100;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #666;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.today { background: #e91e63; }
.legend-dot.pms { background: #ffe0b2; }
.legend-dot.period { background: #ffcdd2; }

/* 提示区域 */
.tips-section {
  margin-bottom: 12px;
}

.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.tip-card svg {
  color: #e91e63;
  flex-shrink: 0;
  margin-top: 2px;
}

.tip-content {
  flex: 1;
}

.tip-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.tip-text {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}
</style>
