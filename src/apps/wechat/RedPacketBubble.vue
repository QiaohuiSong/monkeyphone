<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  isOwn: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const redpacketData = computed(() => props.message.redpacketData || {})
const isOpened = computed(() => redpacketData.value.status === 'opened')
const note = computed(() => redpacketData.value.note || '恭喜发财，大吉大利')

function handleClick() {
  emit('click', props.message)
}
</script>

<template>
  <div
    class="redpacket-bubble"
    :class="{ opened: isOpened, own: isOwn }"
    @click="handleClick"
  >
    <!-- 顶部金边装饰 -->
    <div class="gold-border"></div>

    <!-- 主体内容 -->
    <div class="redpacket-main">
      <!-- 左侧红包图标 -->
      <div class="redpacket-icon">
        <div class="icon-inner">
          <span v-if="!isOpened" class="kai-text">開</span>
          <span v-else class="opened-icon">🧧</span>
        </div>
      </div>

      <!-- 右侧文本区域 -->
      <div class="redpacket-content">
        <div class="redpacket-note">{{ note }}</div>
        <div v-if="isOpened" class="redpacket-status">已领取</div>
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
  width: 200px;
  max-width: 100%;
  background: linear-gradient(180deg, #fa6b5b 0%, #e84e3d 50%, #d63e2f 100%);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease;
  position: relative;
}

.redpacket-bubble:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.redpacket-bubble:active {
  transform: scale(0.98);
}

/* 已领取状态 - 颜色变浅 */
.redpacket-bubble.opened {
  background: linear-gradient(180deg, #e8c9b0 0%, #d4b499 50%, #c4a388 100%);
  cursor: default;
}

.redpacket-bubble.opened:hover {
  filter: none;
  transform: none;
}

/* 顶部金边 */
.gold-border {
  height: 4px;
  background: linear-gradient(90deg, #ffd700, #ffb700, #ffd700);
}

.redpacket-bubble.opened .gold-border {
  background: linear-gradient(90deg, #d4b499, #c4a388, #d4b499);
}

.redpacket-main {
  display: flex;
  align-items: center;
  padding: 14px 12px;
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
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.redpacket-bubble.opened .icon-inner {
  background: rgba(255, 255, 255, 0.3);
  box-shadow: none;
}

.kai-text {
  font-size: 18px;
  font-weight: bold;
  color: #d63e2f;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
}

.opened-icon {
  font-size: 20px;
}

.redpacket-content {
  flex: 1;
  min-width: 0;
}

.redpacket-note {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  line-height: 1.4;
  word-break: break-word;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

.redpacket-bubble.opened .redpacket-note {
  color: rgba(100, 70, 50, 0.9);
  text-shadow: none;
}

.redpacket-status {
  font-size: 12px;
  color: rgba(100, 70, 50, 0.7);
  margin-top: 2px;
}

.redpacket-footer {
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 4px;
}

.redpacket-bubble.opened .redpacket-footer {
  border-top-color: rgba(0, 0, 0, 0.05);
  background: rgba(0, 0, 0, 0.03);
}

.wechat-icon {
  width: 12px;
  height: 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23fff' fill-opacity='0.7' d='M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}

.redpacket-bubble.opened .wechat-icon {
  opacity: 0.5;
}

.redpacket-footer span:last-child {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.redpacket-bubble.opened .redpacket-footer span:last-child {
  color: rgba(100, 70, 50, 0.6);
}
</style>
