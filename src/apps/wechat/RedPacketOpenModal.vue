<script setup>
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { grabRedPacket } from '../../services/api.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  groupId: { type: String, required: true },
  packetId: { type: String, default: '' },
  packet: { type: Object, default: null },
  currentUserId: { type: String, default: 'user' },
  currentUserName: { type: String, default: '我' },
  currentUserAvatar: { type: String, default: '' },
  personaId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'opened', 'viewDetail'])

// 状态: 'ready' | 'opening' | 'opened' | 'already_grabbed' | 'finished' | 'expired'
const status = ref('ready')
const isGrabbing = ref(false)
const grabbedAmount = ref(0)
const isBestLuck = ref(false)
const errorMessage = ref('')

// 红包信息
const senderName = computed(() => props.packet?.sender_name || '好友')
const senderAvatar = computed(() => props.packet?.sender_avatar || '')
const wishes = computed(() => props.packet?.wishes || '恭喜发财，大吉大利')

// 自己的领取记录
const myRecord = computed(() => {
  if (!props.packet) return null
  return props.packet.records?.find(r => r.user_id === props.currentUserId)
})

// 监听弹窗显示，检查状态
watch(() => props.visible, (val) => {
  if (val && props.packet) {
    errorMessage.value = ''

    // 检查是否已领取
    if (myRecord.value) {
      status.value = 'already_grabbed'
      grabbedAmount.value = myRecord.value.amount
      isBestLuck.value = myRecord.value.is_best
      return
    }

    // 检查是否已抢完
    if (props.packet.remain_num <= 0) {
      status.value = 'finished'
      return
    }

    // 检查是否过期
    if (Date.now() > props.packet.expired_at) {
      status.value = 'expired'
      return
    }

    // 可以领取
    status.value = 'ready'
  }
})

// 点击开红包
async function handleOpen() {
  if (status.value !== 'ready' || isGrabbing.value) return

  isGrabbing.value = true
  status.value = 'opening'

  try {
    // 调用 API 领红包
    const result = await grabRedPacket(props.groupId, props.packetId, {
      user_id: props.currentUserId,
      user_name: props.currentUserName,
      user_avatar: props.currentUserAvatar
    })

    // 延迟显示结果（等待动画）
    setTimeout(() => {
      grabbedAmount.value = result.amount
      isBestLuck.value = result.is_best
      status.value = 'opened'
      emit('opened', result)
    }, 1200)

  } catch (e) {
    console.error('领红包失败:', e)

    // 检查错误类型
    if (e.message?.includes('已经抢过')) {
      status.value = 'already_grabbed'
    } else if (e.message?.includes('抢完')) {
      status.value = 'finished'
    } else if (e.message?.includes('过期')) {
      status.value = 'expired'
    } else {
      errorMessage.value = e.message || '领取失败'
      status.value = 'ready'
    }
  } finally {
    isGrabbing.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleViewDetail() {
  emit('viewDetail')
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="redpacket-modal-overlay" @click="handleOverlayClick">
        <!-- 金币雨动画 -->
        <div v-if="status === 'opening'" class="coin-rain">
          <div v-for="i in 30" :key="i" class="coin" :style="{
            left: Math.random() * 100 + '%',
            animationDelay: Math.random() * 0.6 + 's',
            animationDuration: (0.8 + Math.random() * 0.6) + 's'
          }">💰</div>
        </div>

        <!-- 未开/开启中状态 - 红包卡片 -->
        <Transition name="card" mode="out-in">
          <div v-if="status === 'ready' || status === 'opening'" key="card" class="redpacket-card" :class="{ opening: status === 'opening' }">
            <!-- 关闭按钮 -->
            <button class="close-btn" @click="handleClose">
              <X :size="28" />
            </button>

            <!-- 顶部装饰 -->
            <div class="card-top-deco"></div>

            <!-- 发送者头像和信息 -->
            <div class="sender-section">
              <div class="sender-avatar">
                <img v-if="senderAvatar" :src="senderAvatar" />
                <span v-else>{{ senderName?.[0] || '?' }}</span>
              </div>
              <div class="sender-name">{{ senderName }}的红包</div>
            </div>

            <!-- 祝福语 -->
            <div class="wish-text">{{ wishes }}</div>

            <!-- 错误提示 -->
            <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

            <!-- 中间金色圆形"開"按钮 -->
            <div class="open-btn-container">
              <button
                class="open-btn"
                :class="{ spinning: status === 'opening' }"
                @click="handleOpen"
                :disabled="status === 'opening'"
              >
                <span class="open-text">開</span>
              </button>
              <div class="btn-glow"></div>
            </div>

            <!-- 底部链接 -->
            <div class="card-bottom">
              <span class="view-luck" @click="handleViewDetail">查看领取详情 ></span>
            </div>
          </div>

          <!-- 已领取状态 - 显示金额 -->
          <div v-else-if="status === 'opened' || status === 'already_grabbed'" key="result" class="result-card">
            <!-- 关闭按钮 -->
            <button class="close-btn light" @click="handleClose">
              <X :size="24" />
            </button>

            <!-- 发送者信息 -->
            <div class="result-header">
              <div class="result-avatar">
                <img v-if="senderAvatar" :src="senderAvatar" />
                <span v-else>{{ senderName?.[0] || '?' }}</span>
              </div>
              <div class="result-sender">{{ senderName }}的红包</div>
            </div>

            <!-- 金额显示 -->
            <div class="amount-display">
              <span class="amount-value">{{ grabbedAmount.toFixed(2) }}</span>
              <span class="amount-unit">元</span>
            </div>

            <!-- 手气最佳标记 -->
            <div v-if="isBestLuck" class="best-luck-banner">
              <span class="crown">👑</span>
              <span>手气最佳</span>
            </div>

            <!-- 提示文字 -->
            <div class="tip-text">
              已存入零钱
            </div>

            <!-- 底部链接 -->
            <div class="result-footer">
              <span class="footer-link" @click="handleViewDetail">查看领取详情 ></span>
            </div>
          </div>

          <!-- 已抢完/过期状态 -->
          <div v-else key="empty" class="empty-card">
            <!-- 关闭按钮 -->
            <button class="close-btn light" @click="handleClose">
              <X :size="24" />
            </button>

            <div class="empty-icon">🧧</div>
            <div class="empty-text">
              {{ status === 'finished' ? '手慢了，红包派完了' : '红包已过期' }}
            </div>
            <div class="empty-link" @click="handleViewDetail">查看领取详情 ></div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.redpacket-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

/* ==================== 红包卡片 ==================== */
.redpacket-card {
  width: 280px;
  background: linear-gradient(180deg, #e76d3b 0%, #cf5735 40%, #b84730 100%);
  border-radius: 12px 12px 60% 60% / 12px 12px 15% 15%;
  padding: 20px 24px 70px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  transition: all 0.5s ease;
}

.redpacket-card.opening {
  transform: scale(1.05);
}

/* 顶部装饰 */
.card-top-deco {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, #ffeaa7 0%, #fdcb6e 50%, #ffeaa7 100%);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.close-btn.light {
  color: #999;
}

.close-btn.light:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #666;
}

/* 发送者区域 */
.sender-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 30px;
  margin-bottom: 16px;
}

.sender-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid rgba(255, 215, 0, 0.4);
  margin-bottom: 10px;
}

.sender-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sender-avatar span {
  font-size: 22px;
  color: #fff;
  font-weight: 500;
}

.sender-name {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.9);
}

/* 祝福语 */
.wish-text {
  font-size: 22px;
  font-weight: 600;
  color: #ffeaa7;
  text-align: center;
  margin-bottom: 24px;
  letter-spacing: 1px;
}

.error-message {
  font-size: 13px;
  color: #ffeaa7;
  margin-bottom: 12px;
}

/* 開按钮容器 */
.open-btn-container {
  position: relative;
  margin-bottom: 20px;
}

.open-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #ffeaa7 0%, #fdcb6e 50%, #f9a825 100%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 6px 20px rgba(253, 203, 110, 0.5),
    inset 0 2px 8px rgba(255, 255, 255, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 2;
}

.open-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow:
    0 10px 30px rgba(253, 203, 110, 0.6),
    inset 0 2px 8px rgba(255, 255, 255, 0.4);
}

.open-btn:active:not(:disabled) {
  transform: scale(0.95);
}

/* 按钮旋转动画 */
.open-btn.spinning {
  animation: spinOpen 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  pointer-events: none;
}

@keyframes spinOpen {
  0% {
    transform: perspective(800px) rotateY(0deg) scale(1);
  }
  25% {
    transform: perspective(800px) rotateY(180deg) scale(1.15);
  }
  50% {
    transform: perspective(800px) rotateY(360deg) scale(1.2);
  }
  75% {
    transform: perspective(800px) rotateY(540deg) scale(1.1);
  }
  100% {
    transform: perspective(800px) rotateY(720deg) scale(0);
    opacity: 0;
  }
}

.open-text {
  font-size: 36px;
  font-weight: bold;
  color: #b84730;
}

/* 按钮光晕 */
.btn-glow {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(253, 203, 110, 0.4) 0%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
  z-index: 1;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

.redpacket-card.opening .btn-glow {
  animation: none;
  opacity: 0;
}

/* 底部 */
.card-bottom {
  position: absolute;
  bottom: 25px;
  left: 0;
  right: 0;
  text-align: center;
}

.view-luck {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.view-luck:hover {
  color: rgba(255, 255, 255, 0.9);
}

/* ==================== 结果卡片 ==================== */
.result-card {
  width: 300px;
  background: #fff;
  border-radius: 12px;
  padding: 50px 24px 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.result-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.result-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 8px;
}

.result-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-avatar span {
  font-size: 18px;
  color: #999;
}

.result-sender {
  font-size: 14px;
  color: #666;
}

.amount-display {
  display: flex;
  align-items: baseline;
  margin-bottom: 12px;
}

.amount-value {
  font-size: 64px;
  font-weight: 600;
  color: #e76d3b;
  line-height: 1;
}

.amount-unit {
  font-size: 20px;
  color: #e76d3b;
  margin-left: 4px;
}

.best-luck-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #ffeaa7, #fdcb6e);
  padding: 6px 16px;
  border-radius: 16px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
  color: #b84730;
}

.crown {
  font-size: 16px;
}

.tip-text {
  font-size: 14px;
  color: #999;
  margin-bottom: 30px;
}

.result-footer {
  width: 100%;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
}

.footer-link {
  font-size: 14px;
  color: #576b95;
  cursor: pointer;
}

.footer-link:hover {
  text-decoration: underline;
}

/* ==================== 空状态卡片 ==================== */
.empty-card {
  width: 280px;
  background: #fff;
  border-radius: 12px;
  padding: 50px 24px 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 16px;
  color: #666;
  margin-bottom: 24px;
}

.empty-link {
  font-size: 14px;
  color: #576b95;
  cursor: pointer;
}

.empty-link:hover {
  text-decoration: underline;
}

/* ==================== 金币雨 ==================== */
.coin-rain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 10;
}

.coin {
  position: absolute;
  top: -60px;
  font-size: 28px;
  animation: coinDrop linear forwards;
}

@keyframes coinDrop {
  0% {
    transform: translateY(0) rotate(0deg) scale(0);
    opacity: 0;
  }
  15% {
    opacity: 1;
    transform: translateY(15vh) rotate(90deg) scale(1.2);
  }
  100% {
    transform: translateY(110vh) rotate(720deg) scale(0.6);
    opacity: 0;
  }
}

/* ==================== 过渡动画 ==================== */
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.card-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-leave-active {
  transition: all 0.3s ease-in;
}
.card-enter-from {
  opacity: 0;
  transform: translateY(40px) scale(0.9);
}
.card-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
