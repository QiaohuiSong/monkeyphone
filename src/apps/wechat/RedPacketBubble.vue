<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  packet: { type: Object, default: null }, // 群红包数据（从缓存获取）
  currentUserId: { type: String, default: 'user' },
  isOwn: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

// 判断是否为群红包（有 packet 数据）
const isGroupPacket = computed(() => !!props.packet)

// 红包祝福语
const wishes = computed(() => {
  // 优先从消息文本中提取
  const text = props.message.text || ''
  const match = text.match(/\[红包\]\s*(.+)/)
  if (match) return match[1]

  // 群红包使用 packet.wishes
  if (isGroupPacket.value) {
    return props.packet?.wishes || '恭喜发财，大吉大利'
  }

  // 私聊红包使用 redpacketData.note
  return props.message.redpacketData?.note || '恭喜发财，大吉大利'
})

// 红包状态（区分群红包和私聊红包）
const packetStatus = computed(() => {
  // 群红包逻辑
  if (isGroupPacket.value) {
    // 检查是否已被抢光
    if (props.packet.remain_num <= 0) return 'finished'

    // 检查是否过期
    if (Date.now() > props.packet.expired_at) return 'expired'

    // 检查自己是否已领取
    const myRecord = props.packet.records?.find(r => r.user_id === props.currentUserId)
    if (myRecord) return 'grabbed'

    return 'available'
  }

  // 私聊红包逻辑
  const status = props.message.redpacketData?.status
  if (status === 'opened') return 'opened'
  if (status === 'unclaimed') return 'available'

  return 'available'
})

// 是否显示为已领取/不可领状态（半透明）
const isInactive = computed(() => {
  if (isGroupPacket.value) {
    return ['finished', 'expired', 'grabbed'].includes(packetStatus.value)
  }
  // 私聊红包：已打开状态
  return packetStatus.value === 'opened'
})

// 状态文字
const statusText = computed(() => {
  if (isGroupPacket.value) {
    switch (packetStatus.value) {
      case 'grabbed': return '已领取'
      case 'finished': return '已被领完'
      case 'expired': return '已过期'
      default: return ''
    }
  }
  // 私聊红包
  if (packetStatus.value === 'opened') return '已领取'
  return ''
})

function handleClick() {
  emit('click', props.message)
}
</script>

<template>
  <div
    class="redpacket-bubble"
    :class="{ inactive: isInactive, own: isOwn }"
    @click="handleClick"
  >
    <!-- 顶部金边装饰 -->
    <div class="gold-border"></div>

    <!-- 主体内容 -->
    <div class="redpacket-main">
      <!-- 左侧红包图标 -->
      <div class="redpacket-icon">
        <div class="icon-inner">
          <span v-if="!isInactive" class="kai-text">開</span>
          <span v-else class="opened-icon">🧧</span>
        </div>
      </div>

      <!-- 右侧文本区域 -->
      <div class="redpacket-content">
        <div class="redpacket-note">{{ wishes }}</div>
        <div v-if="statusText" class="redpacket-status">{{ statusText }}</div>
      </div>
    </div>

    <!-- 底部标签 -->
    <div class="redpacket-footer">
      <span class="wechat-icon"></span>
      <span>微信红包</span>
    </div>
  </div>
</template>

<style scoped>
.redpacket-bubble {
  width: 240px;
  max-width: 100%;
  background: linear-gradient(180deg, #fa9d3b 0%, #e76d3b 50%, #cf5735 100%);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  position: relative;
}

.redpacket-bubble:active {
  transform: scale(0.98);
}

/* 已领取/不可领状态 - 颜色变浅 */
.redpacket-bubble.inactive {
  background: linear-gradient(180deg, #e8d5c0 0%, #d4bda5 50%, #c4a88a 100%);
  cursor: default;
}

.redpacket-bubble.inactive:active {
  transform: none;
}

/* 顶部金边 */
.gold-border {
  height: 3px;
  background: linear-gradient(90deg, #ffeaa7, #fdcb6e, #ffeaa7);
}

.redpacket-bubble.inactive .gold-border {
  background: linear-gradient(90deg, #d4bda5, #c4a88a, #d4bda5);
}

.redpacket-main {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  gap: 10px;
}

.redpacket-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.icon-inner {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.redpacket-bubble.inactive .icon-inner {
  background: rgba(255, 255, 255, 0.4);
  box-shadow: none;
}

.kai-text {
  font-size: 18px;
  font-weight: bold;
  color: #cf5735;
}

.opened-icon {
  font-size: 18px;
  opacity: 0.7;
}

.redpacket-content {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.redpacket-note {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  line-height: 1.4;
  word-break: break-word;
}

.redpacket-bubble.inactive .redpacket-note {
  color: rgba(90, 60, 40, 0.9);
}

.redpacket-status {
  font-size: 12px;
  color: rgba(90, 60, 40, 0.7);
  margin-top: 4px;
}

.redpacket-footer {
  padding: 6px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 4px;
}

.redpacket-bubble.inactive .redpacket-footer {
  border-top-color: rgba(0, 0, 0, 0.05);
  background: rgba(0, 0, 0, 0.02);
}

.wechat-icon {
  width: 12px;
  height: 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23fff' fill-opacity='0.7' d='M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}

.redpacket-bubble.inactive .wechat-icon {
  opacity: 0.5;
}

.redpacket-footer span:last-child {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.redpacket-bubble.inactive .redpacket-footer span:last-child {
  color: rgba(90, 60, 40, 0.5);
}
</style>
