<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, ChevronDown, User } from 'lucide-vue-next'

const props = defineProps({
  personaId: { type: String, default: 'default' },
  personaName: { type: String, default: '默认身份' }
})

const emit = defineEmits(['back'])

// 状态
const loading = ref(false)
const transactions = ref([])
const currentMonth = ref(new Date())
const filterType = ref('all') // all, income, expense

// 获取当前月份文字
const monthText = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth() + 1
  return `${year}年${month}月`
})

// 过滤后的交易记录
const filteredTransactions = computed(() => {
  let list = transactions.value

  // 按月份过滤
  const targetYear = currentMonth.value.getFullYear()
  const targetMonth = currentMonth.value.getMonth()
  list = list.filter(tx => {
    const date = new Date(tx.timestamp)
    return date.getFullYear() === targetYear && date.getMonth() === targetMonth
  })

  // 按类型过滤
  if (filterType.value === 'income') {
    list = list.filter(tx => tx.type === 'income')
  } else if (filterType.value === 'expense') {
    list = list.filter(tx => tx.type === 'expense')
  }

  return list
})

// 收入总计
const totalIncome = computed(() => {
  return filteredTransactions.value
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)
})

// 支出总计
const totalExpense = computed(() => {
  return filteredTransactions.value
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)
})

// 按日期分组的交易记录
const groupedTransactions = computed(() => {
  const groups = {}

  filteredTransactions.value.forEach(tx => {
    const date = new Date(tx.timestamp)
    const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
    const dayOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        dayOfWeek,
        displayDate: `${date.getMonth() + 1}月${date.getDate()}日`,
        transactions: [],
        dayIncome: 0,
        dayExpense: 0
      }
    }

    groups[dateKey].transactions.push(tx)
    if (tx.type === 'income') {
      groups[dateKey].dayIncome += tx.amount
    } else {
      groups[dateKey].dayExpense += tx.amount
    }
  })

  // 转换为数组并按日期倒序排列
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
})

// 格式化金额
function formatAmount(amount) {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 获取交易图标
function getTransactionIcon(tx) {
  if (tx.note && tx.note.includes('红包')) return '🧧'
  if (tx.type === 'income') return '💰'
  if (tx.note && tx.note.includes('购物')) return '🛍️'
  if (tx.note && tx.note.includes('游戏')) return '🎮'
  if (tx.note && tx.note.includes('转账')) return '💸'
  return tx.type === 'expense' ? '💳' : '📥'
}

// 获取交易标题（来自谁）
function getTransactionTitle(tx) {
  // 优先显示来源名称（角色名）
  const charName = tx.source_name || '未知'
  // 用户身份名称
  const userName = tx.personaName || props.personaName || '我'

  if (tx.note && tx.note.includes('红包')) {
    return tx.type === 'income' ? `${charName}的红包` : `发给${charName}的红包`
  }
  if (tx.type === 'income') {
    return `${charName}转入`
  }
  return `转账给${charName}`
}

// 获取交易副标题
function getTransactionSubtitle(tx) {
  let parts = []

  // 交易类型
  if (tx.note && tx.note.includes('红包')) {
    parts.push(tx.type === 'income' ? '红包收入' : '红包支出')
  } else {
    parts.push(tx.type === 'income' ? '零钱收入' : '零钱支出')
  }

  // 备注信息
  if (tx.note && !tx.note.includes('红包')) {
    parts.push(tx.note)
  }

  return parts.join(' · ')
}

// 切换月份
function changeMonth(delta) {
  const newDate = new Date(currentMonth.value)
  newDate.setMonth(newDate.getMonth() + delta)
  currentMonth.value = newDate
}

// 获取交易记录
async function fetchTransactions() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/bank/transactions?limit=100&personaId=${props.personaId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      transactions.value = data.data.transactions || []
    }
  } catch (e) {
    console.error('获取交易记录失败:', e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  emit('back')
}

onMounted(() => {
  fetchTransactions()
})
</script>

<template>
  <div class="bill-detail">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <div class="nav-center">
        <span class="nav-title">账单</span>
        <span class="nav-persona">{{ personaName }}</span>
      </div>
      <div style="width: 36px"></div>
    </div>

    <!-- 月份选择器 -->
    <div class="month-selector">
      <button class="month-btn" @click="changeMonth(-1)">
        <ChevronDown :size="18" style="transform: rotate(90deg)" />
      </button>
      <div class="month-display">
        <Calendar :size="16" />
        <span>{{ monthText }}</span>
      </div>
      <button class="month-btn" @click="changeMonth(1)">
        <ChevronDown :size="18" style="transform: rotate(-90deg)" />
      </button>
    </div>

    <!-- 收支统计卡片 -->
    <div class="summary-card">
      <div class="summary-item income">
        <div class="summary-icon">
          <TrendingUp :size="20" />
        </div>
        <div class="summary-info">
          <div class="summary-label">收入</div>
          <div class="summary-value">+{{ formatAmount(totalIncome) }}</div>
        </div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item expense">
        <div class="summary-icon">
          <TrendingDown :size="20" />
        </div>
        <div class="summary-info">
          <div class="summary-label">支出</div>
          <div class="summary-value">-{{ formatAmount(totalExpense) }}</div>
        </div>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-bar">
      <button
        :class="['filter-btn', { active: filterType === 'all' }]"
        @click="filterType = 'all'"
      >
        全部
      </button>
      <button
        :class="['filter-btn', { active: filterType === 'income' }]"
        @click="filterType = 'income'"
      >
        收入
      </button>
      <button
        :class="['filter-btn', { active: filterType === 'expense' }]"
        @click="filterType = 'expense'"
      >
        支出
      </button>
    </div>

    <!-- 交易列表 -->
    <div class="transaction-list">
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="groupedTransactions.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">本月暂无{{ filterType === 'all' ? '交易' : filterType === 'income' ? '收入' : '支出' }}记录</div>
      </div>

      <!-- 分组列表 -->
      <div v-else class="groups">
        <div v-for="group in groupedTransactions" :key="group.date" class="day-group">
          <!-- 日期头 -->
          <div class="day-header">
            <div class="day-date">
              <span class="date-text">{{ group.displayDate }}</span>
              <span class="day-week">{{ group.dayOfWeek }}</span>
            </div>
            <div class="day-summary">
              <span v-if="group.dayIncome > 0" class="day-income">收入 {{ formatAmount(group.dayIncome) }}</span>
              <span v-if="group.dayExpense > 0" class="day-expense">支出 {{ formatAmount(group.dayExpense) }}</span>
            </div>
          </div>

          <!-- 当日交易 -->
          <div class="day-transactions">
            <div
              v-for="tx in group.transactions"
              :key="tx.id"
              class="transaction-item"
            >
              <div class="tx-icon">{{ getTransactionIcon(tx) }}</div>
              <div class="tx-info">
                <div class="tx-title">{{ getTransactionTitle(tx) }}</div>
                <div class="tx-subtitle">
                  <span>{{ getTransactionSubtitle(tx) }}</span>
                  <span class="tx-time">{{ formatTime(tx.timestamp) }}</span>
                </div>
              </div>
              <div :class="['tx-amount', tx.type]">
                {{ tx.type === 'income' ? '+' : '-' }}{{ formatAmount(tx.amount) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bill-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
  overflow: hidden;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.nav-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 500;
  color: #333;
}

.nav-persona {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 月份选择器 */
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  background: #fff;
}

.month-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #f0f0f0;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.month-btn:active {
  background: #e0e0e0;
}

.month-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

/* 收支统计卡片 */
.summary-card {
  display: flex;
  margin: 12px 16px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.summary-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.summary-divider {
  width: 1px;
  background: #f0f0f0;
  margin: 12px 0;
}

.summary-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-item.income .summary-icon {
  background: rgba(207, 19, 34, 0.1);
  color: #cf1322;
}

.summary-item.expense .summary-icon {
  background: rgba(56, 158, 13, 0.1);
  color: #389e0d;
}

.summary-info {
  flex: 1;
}

.summary-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
}

.summary-item.income .summary-value {
  color: #cf1322;
}

.summary-item.expense .summary-value {
  color: #389e0d;
}

/* 筛选器 */
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.filter-btn {
  padding: 6px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  background: #fff;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}

/* 交易列表 */
.transaction-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: #999;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f0f0f0;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: #999;
}

/* 日期分组 */
.day-group {
  margin-bottom: 16px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.day-date {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.date-text {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.day-week {
  font-size: 12px;
  color: #999;
}

.day-summary {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.day-income {
  color: #cf1322;
}

.day-expense {
  color: #389e0d;
}

/* 当日交易 */
.day-transactions {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f5f5f5;
}

.transaction-item:last-child {
  border-bottom: none;
}

.tx-icon {
  width: 40px;
  height: 40px;
  background: #f8f8f8;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tx-info {
  flex: 1;
  min-width: 0;
}

.tx-title {
  font-size: 15px;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.tx-time {
  color: #bbb;
}

.tx-amount {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.tx-amount.income {
  color: #cf1322;
}

.tx-amount.expense {
  color: #389e0d;
}

/* 滚动条隐藏 */
.transaction-list::-webkit-scrollbar {
  display: none;
}

.transaction-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
