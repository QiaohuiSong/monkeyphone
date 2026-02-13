<script>
// 全局 AI 请求 Promise Map（组件卸载后继续执行）- 必须在 setup 外部定义
const pendingAIRequests = new Map()
</script>

<script setup>
import { ref, reactive, nextTick, watch, onMounted, onUnmounted, computed } from 'vue'
import { ArrowLeft, MoreHorizontal, Send, SendHorizonal, Gift } from 'lucide-vue-next'
import { getGroupChats, sendGroupMessageOnly, triggerGroupAI, getGroup, deleteGroupChatMessage, updateGroupChatMessage, getGroupRedPackets, sendRedPacket, getRedPacket } from '../../services/api.js'
import RedPacketBubble from './RedPacketBubble.vue'
import RedPacketOpenModal from './RedPacketOpenModal.vue'

const props = defineProps({
  groupId: { type: String, required: true },
  currentUserId: { type: String, default: 'user' },
  currentUserName: { type: String, default: '我' },
  currentUserAvatar: { type: String, default: '' }
})

const emit = defineEmits(['back', 'openGroupInfo', 'openRedPacketDetail'])

const group = ref(null)
const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const isSending = ref(false)
const isSendingQueue = ref(false)
const chatListRef = ref(null)

// 红包数据缓存
const redPacketCache = reactive({})

// 红包弹窗状态
const redPacketModal = ref({
  visible: false,
  packetId: '',
  packet: null
})

// 发红包弹窗
const sendRedPacketModal = ref({
  visible: false,
  amount: '',
  num: '',
  wishes: '恭喜发财，大吉大利'
})

// 右键/长按菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  message: null
})
let longPressTimer = null

// 刷新红包数据的定时器
let redPacketRefreshTimer = null

onMounted(async () => {
  await loadData()
  document.addEventListener('click', closeContextMenu)
  // 定时刷新红包数据（每5秒）
  redPacketRefreshTimer = setInterval(refreshRedPackets, 5000)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
  if (redPacketRefreshTimer) {
    clearInterval(redPacketRefreshTimer)
  }
})

watch(() => props.groupId, async () => {
  await loadData()
})

async function loadData() {
  isLoading.value = true
  try {
    const [groupData, chatsData, packetsData] = await Promise.all([
      getGroup(props.groupId),
      getGroupChats(props.groupId),
      getGroupRedPackets(props.groupId).catch(() => [])
    ])
    group.value = groupData
    messages.value = chatsData || []

    // 缓存红包数据
    for (const packet of packetsData) {
      redPacketCache[packet.id] = packet
    }

    // 检查是否有待处理的 AI 请求
    if (pendingAIRequests.has(props.groupId)) {
      isSending.value = true
      // 等待并处理结果
      pendingAIRequests.get(props.groupId).then(result => {
        if (props.groupId === result.groupId && result.aiMessages?.length > 0) {
          // 重新加载消息以获取最新状态
          getGroupChats(props.groupId).then(newChats => {
            messages.value = newChats || []
            scrollToBottom()
          })
        }
      }).finally(() => {
        if (props.groupId === props.groupId) {
          isSending.value = false
        }
      })
    }

    await scrollToBottom()
  } catch (e) {
    console.error('加载群聊数据失败:', e)
  } finally {
    isLoading.value = false
  }
}

// 刷新红包数据
async function refreshRedPackets() {
  try {
    const packetsData = await getGroupRedPackets(props.groupId)
    for (const packet of packetsData) {
      redPacketCache[packet.id] = packet
    }
  } catch (e) {
    // 静默失败
  }
}

async function scrollToBottom() {
  await nextTick()
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  }
}

// 仅发送消息（不触发AI回复，用于连续发多条）
async function sendOnly() {
  const text = inputText.value.trim()
  if (!text || isSending.value || isSendingQueue.value) return

  isSendingQueue.value = true
  inputText.value = ''

  try {
    // 发送到服务器保存
    const userMsg = await sendGroupMessageOnly(props.groupId, text)
    messages.value.push(userMsg)
    await scrollToBottom()
  } catch (e) {
    console.error('发送消息失败:', e)
    alert('发送失败: ' + e.message)
  } finally {
    isSendingQueue.value = false
  }
}

// 发送当前输入并触发AI回复（后台执行，不阻塞返回）
async function sendAndAI() {
  if (isSending.value || isSendingQueue.value) return

  const text = inputText.value.trim()
  const groupId = props.groupId

  isSending.value = true
  inputText.value = ''

  try {
    // 如果有输入内容，先发送
    if (text) {
      const userMsg = await sendGroupMessageOnly(groupId, text)
      messages.value.push(userMsg)
      await scrollToBottom()
    }

    // 后台触发 AI 回复（不等待完成）
    const aiPromise = (async () => {
      try {
        const aiMessages = await triggerGroupAI(groupId)
        return { groupId, aiMessages }
      } catch (e) {
        console.error('AI 回复失败:', e)
        return { groupId, error: e }
      }
    })()

    // 保存到全局 Map
    pendingAIRequests.set(groupId, aiPromise)

    // 异步处理结果（组件可能已卸载）
    aiPromise.then(result => {
      pendingAIRequests.delete(result.groupId)

      // 只有当组件还在显示同一个群时才更新 UI
      if (props.groupId === result.groupId && result.aiMessages?.length > 0) {
        messages.value.push(...result.aiMessages)
        scrollToBottom()
      }
    }).finally(() => {
      // 只有当组件还在显示同一个群时才更新状态
      if (props.groupId === groupId) {
        isSending.value = false
      }
    })

  } catch (e) {
    console.error('发送消息失败:', e)
    alert('发送失败: ' + e.message)
    isSending.value = false
  }
}

function goBack() {
  emit('back')
}

function openGroupInfo() {
  emit('openGroupInfo', props.groupId)
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendAndAI()
  }
}

// ==================== 红包相关 ====================

// 点击红包气泡
async function handleRedPacketClick(msg) {
  const packetId = msg.red_packet_id
  if (!packetId) return

  // 获取最新红包数据
  try {
    const packet = await getRedPacket(props.groupId, packetId)
    redPacketCache[packetId] = packet
    redPacketModal.value = {
      visible: true,
      packetId,
      packet
    }
  } catch (e) {
    console.error('获取红包失败:', e)
    // 使用缓存数据
    redPacketModal.value = {
      visible: true,
      packetId,
      packet: redPacketCache[packetId] || null
    }
  }
}

// 关闭红包弹窗
function closeRedPacketModal() {
  redPacketModal.value.visible = false
}

// 红包领取成功
async function handleRedPacketOpened(result) {
  // 更新缓存
  if (result.packet) {
    redPacketCache[result.packet.id] = result.packet
  }
  // 刷新消息列表
  await refreshRedPackets()
}

// 查看红包详情
function handleViewRedPacketDetail() {
  const packetId = redPacketModal.value.packetId
  closeRedPacketModal()
  emit('openRedPacketDetail', props.groupId, packetId)
}

// 打开发红包弹窗
function openSendRedPacketModal() {
  sendRedPacketModal.value = {
    visible: true,
    amount: '',
    num: '',
    wishes: '恭喜发财，大吉大利'
  }
}

// 关闭发红包弹窗
function closeSendRedPacketModal() {
  sendRedPacketModal.value.visible = false
}

// 确认发红包
async function confirmSendRedPacket() {
  const amount = parseFloat(sendRedPacketModal.value.amount)
  const num = parseInt(sendRedPacketModal.value.num)
  const wishes = sendRedPacketModal.value.wishes.trim() || '恭喜发财，大吉大利'

  if (isNaN(amount) || amount < 0.01) {
    alert('请输入有效金额')
    return
  }
  // 群红包至少2个
  if (isNaN(num) || num < 2) {
    alert('群红包个数不能少于2个')
    return
  }
  if (amount / num < 0.01) {
    alert('单个红包金额不能少于0.01元')
    return
  }

  try {
    // 获取群的 personaId
    const personaId = group.value?.persona_id || 'default'

    const result = await sendRedPacket(props.groupId, {
      sender_id: props.currentUserId,
      sender_name: props.currentUserName,
      sender_avatar: props.currentUserAvatar,
      total_amount: amount,
      total_num: num,
      wishes,
      personaId
    })

    // 添加红包消息到列表
    if (result.message) {
      messages.value.push(result.message)
    }
    // 缓存红包数据
    if (result.packet) {
      redPacketCache[result.packet.id] = result.packet
    }

    closeSendRedPacketModal()
    await scrollToBottom()
  } catch (e) {
    console.error('发红包失败:', e)
    alert('发红包失败: ' + e.message)
  }
}

// ==================== 右键/长按菜单 ====================

// PC端右键菜单
function handleContextMenu(e, msg) {
  if (msg.type === 'recalled' || msg.type === 'red_packet') return
  e.preventDefault()
  showContextMenu(e.clientX, e.clientY, msg)
}

// 移动端长按开始
function handleTouchStart(e, msg) {
  if (msg.type === 'recalled' || msg.type === 'red_packet') return
  const touch = e.touches[0]
  longPressTimer = setTimeout(() => {
    showContextMenu(touch.clientX, touch.clientY, msg)
  }, 500)
}

// 移动端触摸结束/移动
function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// 显示菜单
function showContextMenu(x, y, msg) {
  const menuWidth = 100
  const menuHeight = 40
  const maxX = window.innerWidth - menuWidth - 10
  const maxY = window.innerHeight - menuHeight - 10

  contextMenu.value = {
    visible: true,
    x: Math.min(x, maxX),
    y: Math.min(y, maxY),
    message: msg
  }
}

// 关闭菜单
function closeContextMenu() {
  contextMenu.value.visible = false
}

// 撤回消息
async function recallMessage() {
  const msg = contextMenu.value.message
  contextMenu.value.visible = false

  if (!msg || msg.type === 'recalled') return

  // 构建撤回文本
  const recallText = msg.sender === 'user' ? '你撤回了一条消息' : `"${msg.sender_name}"撤回了一条消息`

  try {
    // 同步到后端
    await updateGroupChatMessage(props.groupId, msg.id, {
      type: 'recalled',
      text: recallText,
      originalText: msg.text
    })

    // 更新本地状态
    msg.originalText = msg.text
    msg.type = 'recalled'
    msg.text = recallText
  } catch (e) {
    console.error('撤回消息失败:', e)
    alert('撤回失败: ' + (e.message || '未知错误'))
  }
}

// 删除消息
async function deleteMessage() {
  const msg = contextMenu.value.message
  contextMenu.value.visible = false

  if (!msg) return

  try {
    await deleteGroupChatMessage(props.groupId, msg.id)
    // 从本地移除
    const index = messages.value.findIndex(m => m.id === msg.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  } catch (e) {
    console.error('删除消息失败:', e)
    alert('删除失败: ' + (e.message || '未知错误'))
  }
}
</script>

<template>
  <div class="group-chat-window" @click="closeContextMenu">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">{{ group?.name || '群聊' }}</span>
      <button class="icon-btn" @click="openGroupInfo">
        <MoreHorizontal :size="22" />
      </button>
    </div>

    <!-- 聊天内容 -->
    <div class="chat-list" ref="chatListRef">
      <div v-if="isLoading" class="loading-tip">加载中...</div>
      <div v-else-if="messages.length === 0" class="empty-tip">
        开始群聊吧~
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="{ 'own': msg.sender === 'user', 'recalled': msg.type === 'recalled' }"
        @contextmenu="handleContextMenu($event, msg)"
        @touchstart="handleTouchStart($event, msg)"
        @touchend="handleTouchEnd"
        @touchmove="handleTouchEnd"
      >
        <!-- 撤回消息提示 -->
        <template v-if="msg.type === 'recalled'">
          <div class="recall-tip">{{ msg.text }}</div>
        </template>

        <!-- 红包消息 -->
        <template v-else-if="msg.type === 'red_packet'">
          <!-- 他人发的红包 -->
          <template v-if="msg.sender !== 'user'">
            <div class="avatar">
              <img v-if="msg.sender_avatar" :src="msg.sender_avatar" />
              <span v-else>{{ msg.sender_name?.[0] || '?' }}</span>
            </div>
            <div class="message-content">
              <div class="sender-name">{{ msg.sender_name }}</div>
              <RedPacketBubble
                :message="msg"
                :packet="redPacketCache[msg.red_packet_id]"
                :currentUserId="currentUserId"
                @click="handleRedPacketClick"
              />
            </div>
          </template>
          <!-- 我发的红包 -->
          <template v-else>
            <div class="message-content own">
              <RedPacketBubble
                :message="msg"
                :packet="redPacketCache[msg.red_packet_id]"
                :currentUserId="currentUserId"
                :isOwn="true"
                @click="handleRedPacketClick"
              />
            </div>
            <div class="avatar own">
              <span>我</span>
            </div>
          </template>
        </template>

        <!-- 他人普通消息：左侧头像 -->
        <template v-else-if="msg.sender !== 'user'">
          <div class="avatar">
            <img v-if="msg.sender_avatar" :src="msg.sender_avatar" />
            <span v-else>{{ msg.sender_name?.[0] || '?' }}</span>
          </div>
          <div class="message-content">
            <div class="sender-name">{{ msg.sender_name }}</div>
            <div class="bubble other">
              {{ msg.text }}
            </div>
          </div>
        </template>

        <!-- 我的普通消息：右侧 -->
        <template v-else>
          <div class="message-content own">
            <div class="bubble own">
              {{ msg.text }}
            </div>
          </div>
          <div class="avatar own">
            <span>我</span>
          </div>
        </template>
      </div>

      <!-- 正在输入提示 -->
      <div v-if="isSending" class="typing-row">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 右键/长按菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <div class="menu-item" @click="recallMessage">
          撤回
        </div>
        <div class="menu-item" @click="deleteMessage">
          删除
        </div>
      </div>
    </Teleport>

    <!-- 红包打开弹窗 -->
    <RedPacketOpenModal
      :visible="redPacketModal.visible"
      :groupId="groupId"
      :packetId="redPacketModal.packetId"
      :packet="redPacketModal.packet"
      :currentUserId="currentUserId"
      :currentUserName="currentUserName"
      :currentUserAvatar="currentUserAvatar"
      :personaId="group?.persona_id || 'default'"
      @close="closeRedPacketModal"
      @opened="handleRedPacketOpened"
      @viewDetail="handleViewRedPacketDetail"
    />

    <!-- 发红包弹窗 -->
    <Teleport to="body">
      <div v-if="sendRedPacketModal.visible" class="modal-overlay" @click.self="closeSendRedPacketModal">
        <div class="send-redpacket-modal">
          <div class="modal-header">
            <span>发红包</span>
            <button class="close-modal-btn" @click="closeSendRedPacketModal">×</button>
          </div>
          <div class="modal-body">
            <div class="form-item">
              <label>总金额</label>
              <div class="input-wrapper">
                <input
                  type="number"
                  v-model="sendRedPacketModal.amount"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                />
                <span class="unit">元</span>
              </div>
            </div>
            <div class="form-item">
              <label>红包个数</label>
              <div class="input-wrapper">
                <input
                  type="number"
                  v-model="sendRedPacketModal.num"
                  placeholder="1"
                  min="1"
                />
                <span class="unit">个</span>
              </div>
            </div>
            <div class="form-item">
              <label>祝福语</label>
              <input
                type="text"
                v-model="sendRedPacketModal.wishes"
                placeholder="恭喜发财，大吉大利"
                maxlength="20"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="send-redpacket-btn" @click="confirmSendRedPacket">
              塞钱进红包
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 输入栏 -->
    <div class="input-bar">
      <button class="icon-btn redpacket-btn" @click="openSendRedPacketModal" title="发红包">
        <Gift :size="20" />
      </button>
      <input
        type="text"
        v-model="inputText"
        placeholder="输入消息..."
        @keydown="handleKeydown"
        :disabled="isSending || isSendingQueue"
      />
      <div class="send-buttons">
        <button
          class="send-btn secondary"
          :disabled="!inputText.trim() || isSending || isSendingQueue"
          @click="sendOnly"
          title="仅发送（可连续发多条）"
        >
          <Send :size="18" />
        </button>
        <button
          class="send-btn primary"
          :disabled="isSending || isSendingQueue"
          @click="sendAndAI"
          title="发送并获取AI回复"
        >
          <SendHorizonal :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-chat-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ededed;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ededed;
  border-bottom: 1px solid #d9d9d9;
}

.header .title {
  font-size: 17px;
  font-weight: 500;
  color: #000;
  flex: 1;
  text-align: center;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-tip, .empty-tip {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 0;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  user-select: none;
}

.message-row.own {
  flex-direction: row;
  justify-content: flex-end;
}

.message-row.recalled {
  justify-content: center;
}

.recall-tip {
  font-size: 12px;
  color: #999;
  background: transparent;
  padding: 4px 8px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar.own {
  background: #576b95;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar span {
  font-size: 16px;
  color: #fff;
}

.message-content {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-content.own {
  align-items: flex-end;
}

.sender-name {
  font-size: 12px;
  color: #999;
  padding-left: 4px;
}

.bubble {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble.other {
  background: #fff;
  color: #000;
}

.bubble.own {
  background: #95ec69;
  color: #000;
}

.typing-row {
  display: flex;
  padding-left: 48px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #ccc;
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.input-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f7f7f7;
  border-top: 1px solid #e0e0e0;
}

.input-bar input {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 6px;
  background: #fff;
  font-size: 15px;
  outline: none;
}

.redpacket-btn {
  color: #e84e3d;
}

.redpacket-btn:hover {
  background: rgba(232, 78, 61, 0.1);
}

.send-buttons {
  display: flex;
  gap: 4px;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn.secondary {
  background: #e0e0e0;
  color: #333;
}

.send-btn.secondary:active:not(:disabled) {
  background: #d0d0d0;
}

.send-btn.primary {
  background: #07c160;
  color: #fff;
}

.send-btn.primary:active:not(:disabled) {
  background: #06ad56;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 右键/长按菜单 */
.context-menu {
  position: fixed;
  background: #4c4c4c;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 80px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 9999;
}

.menu-item {
  padding: 10px 20px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  text-align: center;
}

.menu-item:hover {
  background: rgba(255,255,255,0.1);
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

/* 发红包弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}

.send-redpacket-modal {
  width: 320px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #e84e3d;
  color: #fff;
  font-size: 17px;
  font-weight: 500;
}

.close-modal-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px 16px;
}

.form-item {
  margin-bottom: 16px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-item label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.form-item input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
}

.form-item input:focus {
  border-color: #e84e3d;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-wrapper input {
  flex: 1;
}

.input-wrapper .unit {
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
}

.send-redpacket-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: #e84e3d;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.send-redpacket-btn:hover {
  background: #d63e2f;
}

.send-redpacket-btn:active {
  transform: scale(0.98);
}
</style>
