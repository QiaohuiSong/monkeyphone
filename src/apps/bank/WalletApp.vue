<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowLeft, Receipt, Send, Plus, TrendingUp, TrendingDown, User, ChevronDown } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { getPersonas } from '../../services/api.js'
import BillDetail from './BillDetail.vue'

const router = useRouter()

// 视图状态
const currentView = ref('main') // main, bill

// 人设相关
const personas = ref([])
const currentPersonaId = ref('default')
const showPersonaSelector = ref(false)

// 当前人设信息
const currentPersona = computed(() => {
  if (currentPersonaId.value === 'default') {
    return { id: 'default', name: '默认身份', avatar: null }
  }
  return personas.value.find(p => p.id === currentPersonaId.value) || { id: 'default', name: '默认身份', avatar: null }
})

// 状态
const loading = ref(false)
const balance = ref(0)
const transactions = ref([])

// 格式化金额
function formatAmount(amount) {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化日期
function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  // 今天
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  // 其他
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 获取交易图标
function getTransactionIcon(tx) {
  if (tx.note && tx.note.includes('红包')) return '🧧'
  if (tx.type === 'income') return '💰'
  if (tx.note && tx.note.includes('购物')) return '🛍️'
  if (tx.note && tx.note.includes('游戏')) return '🎮'
  return tx.type === 'expense' ? '💸' : '📥'
}

// 获取交易标题（来自谁）
function getTransactionTitle(tx) {
  const charName = tx.source_name || '未知'
  if (tx.note && tx.note.includes('红包')) {
    return tx.type === 'income' ? `${charName}的红包` : `发给${charName}的红包`
  }
  if (tx.type === 'income') {
    return `${charName}转入`
  }
  return `转账给${charName}`
}

// 获取余额数据
async function fetchBalance() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/bank/balance?personaId=${currentPersonaId.value}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    if (data.success) {
      balance.value = data.data.balance
      transactions.value = data.data.transactions || []
    }
  } catch (e) {
    console.error('获取余额失败:', e)
  } finally {
    loading.value = false
  }
}

// 加载人设列表
async function loadPersonas() {
  try {
    personas.value = await getPersonas()
  } catch (e) {
    console.error('加载人设失败:', e)
  }
}

// 切换人设
function selectPersona(personaId) {
  currentPersonaId.value = personaId
  showPersonaSelector.value = false
}

// 监听人设变化，重新加载数据
watch(currentPersonaId, () => {
  fetchBalance()
})

// 模拟操作提示
function showComingSoon(action) {
  alert(`${action}功能开发中，敬请期待~`)
}

// 打开账单
function openBill() {
  currentView.value = 'bill'
}

// 返回
function goBack() {
  if (currentView.value !== 'main') {
    currentView.value = 'main'
  } else {
    router.push('/')
  }
}

onMounted(() => {
  loadPersonas()
  fetchBalance()
})
</script>

<template>
  <div class="wallet-app">
    <!-- 账单详情页 -->
    <BillDetail
      v-if="currentView === 'bill'"
      :personaId="currentPersonaId"
      :personaName="currentPersona.name"
      @back="currentView = 'main'"
    />

    <!-- 主页面 -->
    <template v-else>
      <!-- 顶部导航 -->
      <div class="nav-bar">
        <button class="back-btn" @click="goBack">
          <ArrowLeft :size="22" />
        </button>
        <span class="nav-title">钱包</span>
        <button class="persona-btn" @click="showPersonaSelector = true">
          <div class="persona-avatar-small">
            <img v-if="currentPersona.avatar" :src="currentPersona.avatar" />
            <User v-else :size="14" />
          </div>
          <ChevronDown :size="14" />
        </button>
      </div>

      <!-- 当前身份提示 -->
      <div class="persona-hint" @click="showPersonaSelector = true">
        <span>当前身份：{{ currentPersona.name }}</span>
      </div>

      <!-- 主内容区 -->
      <div class="content">
        <!-- 资产卡片 -->
        <div class="asset-card">
          <div class="card-bg">
            <div class="card-pattern"></div>
          </div>
          <div class="card-content">
            <div class="card-label">总资产 (CNY)</div>
            <div class="card-balance">
              <span class="currency">¥</span>
              <span class="amount">{{ formatAmount(balance) }}</span>
            </div>
            <div class="card-decoration">
              <div class="chip"></div>
              <div class="card-type">VIRTUAL CARD</div>
            </div>
          </div>
        </div>

        <!-- 功能区 -->
        <div class="action-grid">
          <div class="action-item" @click="openBill">
            <div class="action-icon blue">
              <Receipt :size="22" />
            </div>
            <span class="action-label">账单</span>
          </div>
          <div class="action-item" @click="showComingSoon('转账')">
            <div class="action-icon orange">
              <Send :size="22" />
            </div>
            <span class="action-label">转账</span>
          </div>
          <div class="action-item" @click="showComingSoon('充值')">
            <div class="action-icon green">
              <Plus :size="22" />
            </div>
            <span class="action-label">充值</span>
          </div>
        </div>

        <!-- 交易记录 -->
        <div class="transaction-section">
          <div class="section-header">
            <span class="section-title">最近交易</span>
            <span class="section-more" v-if="transactions.length > 0" @click="openBill">查看全部</span>
          </div>

          <!-- Loading -->
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>

          <!-- 空状态 -->
          <div v-else-if="transactions.length === 0" class="empty-state">
            <div class="empty-icon">💳</div>
            <div class="empty-text">暂无交易记录</div>
            <div class="empty-sub">和角色互动可能会获得红包哦~</div>
          </div>

          <!-- 交易列表 -->
          <div v-else class="transaction-list">
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="transaction-item"
            >
              <div class="tx-icon">{{ getTransactionIcon(tx) }}</div>
              <div class="tx-info">
                <div class="tx-title">{{ getTransactionTitle(tx) }}</div>
                <div class="tx-date">{{ formatDate(tx.timestamp) }}</div>
              </div>
              <div :class="['tx-amount', tx.type]">
                {{ tx.type === 'income' ? '+' : '-' }}{{ formatAmount(tx.amount) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 人设选择器 -->
    <div v-if="showPersonaSelector" class="persona-overlay" @click.self="showPersonaSelector = false">
      <div class="persona-modal">
        <div class="persona-modal-header">
          <span>选择身份</span>
        </div>
        <div class="persona-list">
          <!-- 默认身份 -->
          <div
            class="persona-item"
            :class="{ active: currentPersonaId === 'default' }"
            @click="selectPersona('default')"
          >
            <div class="persona-item-avatar default">
              <User :size="20" />
            </div>
            <span class="persona-item-name">默认身份</span>
            <span v-if="currentPersonaId === 'default'" class="persona-check">✓</span>
          </div>

          <!-- 人设列表 -->
          <div
            v-for="persona in personas"
            :key="persona.id"
            class="persona-item"
            :class="{ active: currentPersonaId === persona.id }"
            @click="selectPersona(persona.id)"
          >
            <div class="persona-item-avatar">
              <img v-if="persona.avatar" :src="persona.avatar" />
              <span v-else>{{ persona.name?.[0] || '?' }}</span>
            </div>
            <span class="persona-item-name">{{ persona.name }}</span>
            <span v-if="currentPersonaId === persona.id" class="persona-check">✓</span>
          </div>

          <!-- 空状态 -->
          <div v-if="personas.length === 0" class="persona-empty">
            暂无其他人设
          </div>
        </div>
        <div class="persona-modal-footer">
          <button class="persona-cancel-btn" @click="showPersonaSelector = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  color: #fff;
  overflow: hidden;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: transparent;
}

.nav-title {
  font-size: 17px;
  font-weight: 500;
  color: #fff;
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
  transition: background 0.2s;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

/* 主内容 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 20px;
}

/* 资产卡片 */
.asset-card {
  position: relative;
  height: 180px;
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.card-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

.card-pattern {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 40%);
}

.card-content {
  position: relative;
  height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
}

.card-balance {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.currency {
  font-size: 24px;
  font-weight: 300;
}

.amount {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -1px;
}

.card-decoration {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chip {
  width: 40px;
  height: 30px;
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  border-radius: 6px;
  box-shadow: inset 0 -2px 4px rgba(0,0,0,0.2);
}

.card-type {
  font-size: 11px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.6);
}

/* 功能区 */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-item:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.1);
}

.action-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.action-icon.blue {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.action-icon.orange {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.action-icon.green {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.action-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

/* 交易记录区 */
.transaction-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
}

.section-more {
  font-size: 13px;
  color: #667eea;
  cursor: pointer;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
}

.empty-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

/* 交易列表 */
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.transaction-item:last-child {
  border-bottom: none;
}

.tx-icon {
  width: 42px;
  height: 42px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.tx-info {
  flex: 1;
  min-width: 0;
}

.tx-title {
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.tx-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.tx-amount {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.tx-amount.income {
  color: #ff4d4f;
}

.tx-amount.expense {
  color: #52c41a;
}

/* 人设切换按钮 */
.persona-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.persona-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.persona-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.persona-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 当前身份提示 */
.persona-hint {
  text-align: center;
  padding: 8px 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.persona-hint:active {
  color: rgba(255, 255, 255, 0.8);
}

/* 人设选择器弹窗 */
.persona-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.persona-modal {
  width: calc(100% - 48px);
  max-width: 320px;
  background: #1e1e2e;
  border-radius: 16px;
  overflow: hidden;
}

.persona-modal-header {
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.persona-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

.persona-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.persona-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.persona-item.active {
  background: rgba(102, 126, 234, 0.2);
}

.persona-item-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.persona-item-avatar.default {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.persona-item-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.persona-item-avatar span {
  font-size: 18px;
  color: #fff;
}

.persona-item-name {
  flex: 1;
  font-size: 15px;
  color: #fff;
}

.persona-check {
  color: #4ade80;
  font-size: 16px;
  font-weight: bold;
}

.persona-empty {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.persona-modal-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.persona-cancel-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.persona-cancel-btn:active {
  background: rgba(255, 255, 255, 0.2);
}
</style>
