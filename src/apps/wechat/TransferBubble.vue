<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  isOwn: { type: Boolean, default: false }
})

// 获取转账数据
const transferData = computed(() => {
  if (props.message.transferData) {
    return props.message.transferData
  }
  if (props.message.redpacketData) {
    return props.message.redpacketData
  }
  if (props.message.content && typeof props.message.content === 'object') {
    return props.message.content
  }
  return {}
})

const amount = computed(() => transferData.value.amount || '0.00')

// 状态：pending (待收款) | accepted (已接收) | received_confirm (收款确认)
const status = computed(() => transferData.value.status || 'accepted')

// 待收款状态（仅右侧/自己发的转账才显示深橙色）
const isPending = computed(() => status.value === 'pending')

// 收款确认状态（左侧 Char 发的"已收款"气泡）
const isReceivedConfirm = computed(() => status.value === 'received_confirm')

// 是否已完成（已被接收 或 收款确认）
const isCompleted = computed(() => !isPending.value)

// 状态文字
const statusText = computed(() => {
  if (isPending.value) {
    return '待收款'
  }
  if (isReceivedConfirm.value) {
    return '已收款'
  }
  // 已接收状态：自己发的显示"已被接收"，对方发的显示"已收款"
  return props.isOwn ? '已被接收' : '已收款'
})
</script>

<template>
  <div class="transfer-bubble" :class="{ pending: isPending, accepted: isCompleted }">
    <!-- 主体内容 -->
    <div class="transfer-main">
      <!-- 左侧图标 -->
      <div class="transfer-icon">
        <!-- 待收款：双向箭头图标 -->
        <svg v-if="isPending" viewBox="0 0 24 24" class="icon-svg">
          <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" fill="currentColor"/>
        </svg>
        <!-- 已接收：对勾图标 -->
        <svg v-else viewBox="0 0 24 24" class="icon-svg">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
        </svg>
      </div>

      <!-- 右侧文本区域 -->
      <div class="transfer-content">
        <div class="transfer-amount">¥{{ amount }}</div>
        <div class="transfer-status">{{ statusText }}</div>
      </div>
    </div>

    <!-- 底部分割线和标签 -->
    <div class="transfer-footer">
      <span class="footer-label">微信转账</span>
    </div>
  </div>
</template>

<style scoped>
.transfer-bubble {
  width: 200px;
  max-width: 100%;
  border-radius: 6px;
  overflow: hidden;
  cursor: default;
  user-select: none;
  transition: all 0.3s ease;
}

/* 待收款状态 - 深橙色 */
.transfer-bubble.pending {
  background: linear-gradient(135deg, #f5a623 0%, #e8940c 100%);
}

/* 已接收状态 - 浅橙色 */
.transfer-bubble.accepted {
  background: linear-gradient(135deg, #f9d5a0 0%, #f5c78e 100%);
}

.transfer-main {
  display: flex;
  align-items: center;
  padding: 12px 10px;
  gap: 10px;
}

.transfer-icon {
  width: 38px;
  height: 38px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.3s ease;
}

/* 待收款状态图标背景更亮 */
.transfer-bubble.pending .transfer-icon {
  background: rgba(255, 255, 255, 0.45);
}

.icon-svg {
  width: 20px;
  height: 20px;
  color: #fff;
}

.transfer-content {
  flex: 1;
  min-width: 0;
}

.transfer-amount {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.transfer-status {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 2px;
}

/* 待收款状态文字更醒目 */
.transfer-bubble.pending .transfer-status {
  color: #fff;
  font-weight: 500;
}

.transfer-footer {
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.02);
}

/* 待收款状态底部稍深 */
.transfer-bubble.pending .transfer-footer {
  background: rgba(0, 0, 0, 0.05);
  border-top-color: rgba(255, 255, 255, 0.3);
}

.footer-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}
</style>
