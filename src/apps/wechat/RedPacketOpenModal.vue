<script setup>
import { ref, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, default: false },
  message: { type: Object, default: null },
  senderName: { type: String, default: '' },
  senderAvatar: { type: String, default: '' }
})

const emit = defineEmits(['close', 'open'])

// 状态: 'ready' | 'opening' | 'opened'
const status = ref('ready')
const redpacketData = computed(() => props.message?.redpacketData || {})
const amount = computed(() => redpacketData.value.amount || '0.00')
const note = computed(() => redpacketData.value.note || '恭喜发财，大吉大利')

// 监听弹窗显示，重置或设置状态
watch(() => props.visible, (val) => {
  if (val && props.message) {
    if (props.message.redpacketData?.status === 'opened') {
      status.value = 'opened'
    } else {
      status.value = 'ready'
    }
  }
})

function handleOpen() {
  if (status.value !== 'ready') return

  status.value = 'opening'

  // 动画完成后显示结果
  setTimeout(() => {
    status.value = 'opened'
    emit('open', props.message)
  }, 1200)
}

function handleClose() {
  emit('close')
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
          <div v-if="status !== 'opened'" key="card" class="redpacket-card" :class="{ opening: status === 'opening' }">
            <!-- 关闭按钮 -->
            <button class="close-btn" @click="handleClose">
              <X :size="28" />
            </button>

            <!-- 顶部装饰 -->
            <div class="card-top-deco">
              <div class="deco-line"></div>
            </div>

            <!-- 发送者头像和信息 -->
            <div class="sender-section">
              <div class="sender-avatar">
                <img v-if="senderAvatar" :src="senderAvatar" />
                <span v-else>{{ senderName?.[0] || '?' }}</span>
              </div>
              <div class="sender-name">{{ senderName || '好友' }}的红包</div>
            </div>

            <!-- 祝福语 -->
            <div class="wish-text">{{ note }}</div>

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

            <!-- 底部弧形 -->
            <div class="card-bottom">
              <div class="bottom-curve"></div>
              <span class="view-luck">看看大家的手气</span>
            </div>
          </div>

          <!-- 已开状态 - 结果页 -->
          <div v-else key="result" class="result-card">
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
              <div class="result-sender">{{ senderName || '好友' }}的红包</div>
            </div>

            <!-- 金额显示 -->
            <div class="amount-display">
              <span class="currency">¥</span>
              <span class="amount-value">{{ amount }}</span>
            </div>

            <!-- 提示文字 -->
            <div class="tip-text">
              <span class="tip-icon">💰</span>
              已存入零钱，可用于发红包
            </div>

            <!-- 底部链接 -->
            <div class="result-footer">
              <div class="divider"></div>
              <span class="footer-link">看看大家的手气 ></span>
            </div>
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

/* ==================== 红包卡片 ==================== */
.redpacket-card {
  width: 300px;
  background: linear-gradient(180deg, #e84e3d 0%, #d63e2f 30%, #c43328 60%, #b32d24 100%);
  border-radius: 16px 16px 50% 50% / 16px 16px 20% 20%;
  padding: 20px 24px 60px;
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
  height: 6px;
  background: linear-gradient(90deg, #ffd700 0%, #ffb700 50%, #ffd700 100%);
}

.deco-line {
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  margin-top: 2px;
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
  margin-bottom: 20px;
}

.sender-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 3px solid rgba(255, 215, 0, 0.5);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  margin-bottom: 12px;
}

.sender-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sender-avatar span {
  font-size: 24px;
  color: #fff;
  font-weight: 500;
}

.sender-name {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 500;
}

/* 祝福语 */
.wish-text {
  font-size: 24px;
  font-weight: 600;
  color: #ffd700;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin-bottom: 30px;
  letter-spacing: 2px;
}

/* 開按钮容器 */
.open-btn-container {
  position: relative;
  margin-bottom: 30px;
}

.open-btn {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #ffd700 0%, #ffb700 50%, #ff9500 100%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 8px 25px rgba(255, 183, 0, 0.5),
    inset 0 2px 10px rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 2;
}

.open-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow:
    0 12px 35px rgba(255, 183, 0, 0.6),
    inset 0 2px 10px rgba(255, 255, 255, 0.3);
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
    box-shadow: 0 15px 50px rgba(255, 215, 0, 0.8);
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
  font-size: 40px;
  font-weight: bold;
  color: #c43328;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.4);
}

/* 按钮光晕 */
.btn-glow {
  position: absolute;
  inset: -15px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
  z-index: 1;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

.redpacket-card.opening .btn-glow {
  animation: none;
  opacity: 0;
}

/* 底部弧形 */
.card-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 15px;
}

.bottom-curve {
  position: absolute;
  bottom: 30px;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.view-luck {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* ==================== 结果卡片 ==================== */
.result-card {
  width: 320px;
  background: #fff;
  border-radius: 16px;
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
  margin-bottom: 30px;
}

.result-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 10px;
}

.result-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-avatar span {
  font-size: 20px;
  color: #999;
}

.result-sender {
  font-size: 15px;
  color: #333;
}

.amount-display {
  display: flex;
  align-items: baseline;
  margin-bottom: 15px;
}

.currency {
  font-size: 36px;
  color: #e84e3d;
  font-weight: 500;
}

.amount-value {
  font-size: 72px;
  font-weight: 700;
  color: #e84e3d;
  line-height: 1;
  letter-spacing: -3px;
}

.tip-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #999;
  padding: 12px 20px;
  background: #f9f9f9;
  border-radius: 25px;
  margin-bottom: 35px;
}

.tip-icon {
  font-size: 16px;
}

.result-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, #eee, transparent);
}

.footer-link {
  font-size: 14px;
  color: #576b95;
  cursor: pointer;
}

.footer-link:hover {
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
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-leave-active {
  transition: all 0.4s ease-in;
}
.card-enter-from {
  opacity: 0;
  transform: translateY(50px) scale(0.9);
}
.card-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-30px);
}
</style>
