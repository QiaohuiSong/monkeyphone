<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { getRedPacket } from '../../services/api.js'

const props = defineProps({
  groupId: { type: String, required: true },
  packetId: { type: String, required: true },
  currentUserId: { type: String, default: 'user' }
})

const emit = defineEmits(['back'])

const packet = ref(null)
const isLoading = ref(false)

// 计算属性
const isExpired = computed(() => {
  if (!packet.value) return false
  return Date.now() > packet.value.expired_at
})

const isFinished = computed(() => {
  if (!packet.value) return false
  return packet.value.remain_num <= 0
})

const myRecord = computed(() => {
  if (!packet.value) return null
  return packet.value.records.find(r => r.user_id === props.currentUserId)
})

const isBestLuck = computed(() => {
  return myRecord.value?.is_best || false
})

const grabbedCount = computed(() => {
  if (!packet.value) return 0
  return packet.value.total_num - packet.value.remain_num
})

const grabbedAmount = computed(() => {
  if (!packet.value) return '0.00'
  return (packet.value.total_amount - packet.value.remain_amount).toFixed(2)
})

// 按领取时间排序的记录
const sortedRecords = computed(() => {
  if (!packet.value?.records) return []
  return [...packet.value.records].sort((a, b) => a.time - b.time)
})

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

onMounted(async () => {
  isLoading.value = true
  console.log('[RedPacketDetail] 加载红包详情, groupId:', props.groupId, 'packetId:', props.packetId)
  try {
    const data = await getRedPacket(props.groupId, props.packetId)
    console.log('[RedPacketDetail] 获取到的红包数据:', data)
    packet.value = data
  } catch (e) {
    console.error('获取红包详情失败:', e)
  } finally {
    isLoading.value = false
  }
})

function goBack() {
  emit('back')
}
</script>

<template>
  <div class="red-packet-detail">
    <!-- 顶部红色区域 -->
    <div class="header-section">
      <!-- 返回按钮 -->
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="24" />
      </button>

      <!-- 弧形背景装饰 -->
      <div class="header-curve"></div>

      <!-- 发送者信息 -->
      <div class="sender-info" v-if="packet">
        <div class="sender-avatar">
          <img v-if="packet.sender_avatar" :src="packet.sender_avatar" />
          <span v-else>{{ packet.sender_name?.[0] || '?' }}</span>
        </div>
        <div class="sender-name">{{ packet.sender_name }}的红包</div>
        <div class="wishes">{{ packet.wishes }}</div>
      </div>

      <!-- 金额显示区域 -->
      <div class="amount-section" v-if="packet">
        <!-- 自己已领取：显示金额 -->
        <template v-if="myRecord">
          <div class="amount-row">
            <span class="amount-value">{{ myRecord.amount.toFixed(2) }}</span>
            <span class="amount-unit">元</span>
          </div>
          <div v-if="isBestLuck" class="best-luck-badge">
            <span class="crown">👑</span>
            手气最佳
          </div>
        </template>

        <!-- 未领取状态 -->
        <template v-else>
          <div class="not-grabbed-text">
            <template v-if="isFinished">手慢了，红包派完了</template>
            <template v-else-if="isExpired">红包已过期</template>
            <template v-else>尚未领取</template>
          </div>
        </template>
      </div>
    </div>

    <!-- 记录列表区域 -->
    <div class="records-section">
      <!-- 统计信息栏 -->
      <div class="stats-bar" v-if="packet">
        已领取 {{ grabbedCount }}/{{ packet.total_num }} 个，共 {{ grabbedAmount }}/{{ packet.total_amount.toFixed(2) }} 元
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="loading-tip">加载中...</div>

      <!-- 记录列表 -->
      <div v-else-if="packet && sortedRecords.length > 0" class="records-list">
        <div
          v-for="record in sortedRecords"
          :key="record.user_id"
          class="record-item"
          :class="{ 'is-me': record.user_id === currentUserId }"
        >
          <!-- 左侧：头像 + 信息 -->
          <div class="record-left">
            <div class="record-avatar">
              <img v-if="record.user_avatar" :src="record.user_avatar" />
              <span v-else>{{ record.user_name?.[0] || '?' }}</span>
            </div>
            <div class="record-info">
              <div class="record-name">{{ record.user_name }}</div>
              <div class="record-time">{{ formatTime(record.time) }}</div>
            </div>
          </div>

          <!-- 右侧：金额 + 手气最佳 -->
          <div class="record-right">
            <div class="record-amount">{{ record.amount.toFixed(2) }}元</div>
            <div v-if="record.is_best" class="best-luck-tag">
              <span class="crown-small">👑</span>
              <span>手气最佳</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 无记录 -->
      <div v-else-if="packet" class="empty-records">
        暂无人领取
      </div>
    </div>
  </div>
</template>

<style scoped>
.red-packet-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* ==================== 顶部红色区域 ==================== */
.header-section {
  position: relative;
  background: linear-gradient(180deg, #e76d3b 0%, #cf5735 50%, #b84730 100%);
  padding: 56px 24px 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 300px;
}

.header-curve {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 50px;
  background: #f5f5f5;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
}

.back-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 10;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

/* 发送者信息 */
.sender-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
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
  border: 2px solid rgba(255, 215, 0, 0.4);
  margin-bottom: 10px;
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
  font-size: 15px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 6px;
}

.wishes {
  font-size: 18px;
  font-weight: 600;
  color: #ffeaa7;
}

/* 金额区域 */
.amount-section {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.amount-row {
  display: flex;
  align-items: baseline;
}

.amount-value {
  font-size: 52px;
  font-weight: 600;
  color: #fff;
  line-height: 1;
}

.amount-unit {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 4px;
}

.best-luck-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ffeaa7, #fdcb6e);
  padding: 5px 12px;
  border-radius: 14px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #b84730;
}

.crown {
  font-size: 14px;
}

.not-grabbed-text {
  margin-top: 10px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
}

/* ==================== 记录列表区域 ==================== */
.records-section {
  flex: 1;
  overflow-y: auto;
  margin-top: -30px;
  position: relative;
  z-index: 2;
}

.stats-bar {
  padding: 14px 16px;
  font-size: 13px;
  color: #999;
  text-align: center;
  background: #f5f5f5;
}

.loading-tip {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.records-list {
  background: #fff;
  margin: 0 12px;
  border-radius: 10px;
  overflow: hidden;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f5f5f5;
}

.record-item:last-child {
  border-bottom: none;
}

.record-item.is-me {
  background: #fffaf5;
}

.record-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-avatar {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.record-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.record-avatar span {
  font-size: 17px;
  color: #999;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.record-name {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.record-time {
  font-size: 12px;
  color: #999;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.record-amount {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.best-luck-tag {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #e76d3b;
  font-weight: 500;
}

.crown-small {
  font-size: 12px;
}

.empty-records {
  text-align: center;
  color: #999;
  padding: 40px 0;
  background: #fff;
  margin: 0 12px;
  border-radius: 10px;
}

/* 滚动条 */
.records-section::-webkit-scrollbar {
  width: 0;
}
</style>
