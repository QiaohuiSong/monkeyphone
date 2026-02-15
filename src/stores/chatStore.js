import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import {
  getChatMessages,
  sendChatMessage,
  sendAIMessage,
  updateChatMessage
} from '../services/wechatApi.js'

// 提示音（可选）
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC4ISZLkyIF5PSUnkLnVn4x9WFFU')

export const useChatStore = defineStore('chat', () => {
  // ==================== State ====================

  // 缓存所有角色的聊天记录 { charId: Message[] }
  const conversations = reactive({})

  // 记录哪些角色正在等待 AI 回复
  const pendingRequests = ref(new Set())

  // 每个角色的未读消息数 { charId: number }
  const unreadCounts = reactive({})

  // 当前正在查看的角色 ID
  const activeCharId = ref(null)

  // 是否正在发送队列（用于显示"正在输入"）
  const sendingQueue = reactive({})

  // 分页信息 { charId: { hasMore, nextIndex } }
  const paginationInfo = reactive({})

  // ==================== Getters ====================

  // 获取指定角色的消息（支持 sessionId）
  function getMessages(charId, sessionId = 'player') {
    const cacheKey = getCacheKey(charId, sessionId)
    return conversations[cacheKey] || []
  }

  // 获取分页信息（支持 sessionId）
  function getPaginationInfo(charId, sessionId = 'player') {
    const cacheKey = getCacheKey(charId, sessionId)
    return paginationInfo[cacheKey] || { hasMore: false, nextIndex: 0 }
  }

  // 检查角色是否正在回复中
  function isPending(charId) {
    return pendingRequests.value.has(charId)
  }

  // 获取角色未读数
  function getUnreadCount(charId) {
    return unreadCounts[charId] || 0
  }

  // 获取总未读数
  function getTotalUnread() {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
  }

  // ==================== Helper Functions ====================

  // 生成缓存 key（charId + sessionId）
  function getCacheKey(charId, sessionId = 'player') {
    return `${charId}:${sessionId}`
  }

  // ==================== 工具函数 ====================

  // 延迟函数
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // 根据文本长度计算延迟时间
  function calculateDelay(text, isFirst = false) {
    if (isFirst) return 600 // 第一条快一点
    // 基础 500ms + 每字 50ms，上限 2500ms
    return Math.min(text.length * 50 + 500, 2500)
  }

  // ==================== Actions ====================

  // 核心：发送消息并获取 AI 回复（Fetch-then-Render 模式）
  async function sendMessageBackground(charId, text, sessionId = 'player', options = {}) {
    const { onTypingStart, onTypingEnd, onBubbleAdded } = options
    const cacheKey = getCacheKey(charId, sessionId)

    // === 第一阶段：准备 ===
    if (!conversations[cacheKey]) {
      conversations[cacheKey] = []
    }
    // 立即显示用户消息
    conversations[cacheKey].push({
      id: Date.now(),
      sender: 'player',
      text,
      timestamp: new Date().toISOString()
    })

    // 锁定状态
    pendingRequests.value.add(charId)
    sendingQueue[charId] = true
    onTypingStart?.()

    try {
      // === 第二阶段：网络请求（只执行一次！）===
      console.log('[sendMessageBackground] 发送 API 请求...')
      const result = await sendAIMessage(charId, text)
      console.log('[sendMessageBackground] API 响应:', result)

      // === 第三阶段：解析 ===
      let bubbles = []
      if (Array.isArray(result)) {
        // 保留完整消息对象（包含 type, redpacketData 等）
        bubbles = result.filter(m => m && (typeof m === 'string' ? m.trim() : m.text?.trim()))
      } else if (result?.text) {
        bubbles = [result]
      } else if (typeof result === 'string') {
        bubbles = [result]
      }
      console.log('[sendMessageBackground] 解析出气泡:', bubbles.length, '条')

      // === 第四阶段：渲染循环（无网络请求！）===
      for (const [index, msg] of bubbles.entries()) {
        const bubbleText = typeof msg === 'string' ? msg : msg.text
        if (!bubbleText?.trim()) continue

        // 计算延迟
        const delay = index === 0 ? 600 : Math.min(bubbleText.length * 50 + 400, 2000)
        await wait(delay)

        // 显示气泡（纯本地操作，保留完整消息结构）
        if (typeof msg === 'object') {
          // 完整消息对象（可能包含 type, redpacketData 等）
          conversations[cacheKey].push({
            ...msg,
            id: msg.id || Date.now() + index
          })
        } else {
          // 纯文本
          conversations[cacheKey].push({
            id: Date.now() + index,
            sender: 'character',
            text: bubbleText,
            timestamp: new Date().toISOString()
          })
        }
        onBubbleAdded?.()
      }

    } catch (e) {
      console.error('[sendMessageBackground] 错误:', e)
      conversations[cacheKey].push({
        id: Date.now(),
        sender: 'system',
        text: `错误: ${e.message}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      // === 第五阶段：收尾 ===
      pendingRequests.value.delete(charId)
      sendingQueue[charId] = false
      onTypingEnd?.()
    }
  }

  // 进入聊天窗口
  function enterChat(charId) {
    activeCharId.value = charId
    // 清空该角色的未读数
    if (unreadCounts[charId]) {
      unreadCounts[charId] = 0
    }
  }

  // 离开聊天窗口
  function leaveChat() {
    activeCharId.value = null
  }

  // 加载聊天记录（带缓存）
  async function loadMessages(charId, sessionId = 'player', forceReload = false) {
    const cacheKey = getCacheKey(charId, sessionId)

    // 如果已有缓存且不强制刷新，直接返回
    if (!forceReload && conversations[cacheKey] && conversations[cacheKey].length > 0) {
      return conversations[cacheKey]
    }

    try {
      const result = await getChatMessages(charId, sessionId, { limit: 8 })
      const messages = (result.data || []).map(normalizeMessage)
      conversations[cacheKey] = messages
      paginationInfo[cacheKey] = {
        hasMore: result.hasMore || false,
        nextIndex: result.nextIndex || 0
      }
      return messages
    } catch (e) {
      console.error('加载聊天记录失败:', e)
      return []
    }
  }

  // 加载更多历史消息
  async function loadMoreMessages(charId, sessionId = 'player') {
    const cacheKey = getCacheKey(charId, sessionId)
    const pagination = paginationInfo[cacheKey]
    if (!pagination || !pagination.hasMore) return false

    try {
      const result = await getChatMessages(charId, sessionId, {
        limit: 10,
        beforeIndex: pagination.nextIndex
      })

      if (result.data && result.data.length > 0) {
        const newMessages = result.data.map(normalizeMessage)
        // 插入到数组头部
        conversations[cacheKey] = [...newMessages, ...(conversations[cacheKey] || [])]
        paginationInfo[cacheKey] = {
          hasMore: result.hasMore || false,
          nextIndex: result.nextIndex || 0
        }
        return true
      }

      paginationInfo[cacheKey].hasMore = false
      return false
    } catch (e) {
      console.error('加载更多消息失败:', e)
      return false
    }
  }

  // 发送消息（仅发送，不触发 AI）
  async function sendMessage(charId, text, sessionId = 'player', sender = 'player', senderName, options = {}) {
    const cacheKey = getCacheKey(charId, sessionId)
    try {
      const msg = await sendChatMessage(charId, text, sessionId, sender, senderName, options)
      const normalizedMsg = normalizeMessage(msg)

      // 添加到缓存
      if (!conversations[cacheKey]) {
        conversations[cacheKey] = []
      }
      conversations[cacheKey].push(normalizedMsg)

      return normalizedMsg
    } catch (e) {
      console.error('发送消息失败:', e)
      throw e
    }
  }

  // AI 发送红包
  async function sendRedPacketFromAI(charId, amount, note, sessionId, profile, character) {
    const cacheKey = getCacheKey(charId, sessionId)
    try {
      const msg = await sendChatMessage(
        charId,
        `[红包] ${note}`,
        sessionId,
        'character',
        profile?.nickname || character?.name,
        {
          type: 'redpacket',
          redpacketData: {
            amount: parseFloat(amount).toFixed(2),
            note: note || '恭喜发财，大吉大利',
            status: 'unclaimed'
          }
        }
      )

      if (!conversations[cacheKey]) {
        conversations[cacheKey] = []
      }
      conversations[cacheKey].push(normalizeMessage(msg))
    } catch (e) {
      console.error('AI 发送红包失败:', e)
    }
  }

  // 处理待收款转账
  async function processPendingTransfers(charId, sessionId, profile, character) {
    const cacheKey = getCacheKey(charId, sessionId)
    const messages = conversations[cacheKey] || []

    const pendingTransfer = [...messages].reverse().find(
      msg => msg.type === 'transfer' &&
             msg.transferData?.status === 'pending' &&
             msg.sender === 'player'
    )

    if (pendingTransfer) {
      const originalAmount = pendingTransfer.transferData?.amount || '0.00'

      // 更新状态为已接收
      pendingTransfer.transferData = {
        ...pendingTransfer.transferData,
        status: 'accepted'
      }

      // 更新后端
      try {
        await updateChatMessage(charId, sessionId, pendingTransfer.id, {
          transferData: pendingTransfer.transferData
        })
      } catch (e) {
        console.error('更新转账状态失败:', e)
      }

      // 插入 Char 的"已收款"确认消息
      try {
        const confirmMsg = await sendChatMessage(
          charId,
          `[转账] 已收款 ¥${originalAmount}`,
          sessionId,
          'character',
          profile?.nickname || character?.name,
          {
            type: 'transfer',
            transferData: {
              amount: originalAmount,
              status: 'received_confirm'
            }
          }
        )
        conversations[cacheKey].push(normalizeMessage(confirmMsg))
      } catch (e) {
        console.error('发送收款确认消息失败:', e)
      }
    }
  }

  // 直接添加消息到缓存（用于本地创建的消息）
  function addMessageToCache(charId, message, sessionId = 'player') {
    const cacheKey = getCacheKey(charId, sessionId)
    if (!conversations[cacheKey]) {
      conversations[cacheKey] = []
    }
    conversations[cacheKey].push(normalizeMessage(message))
  }

  // 更新缓存中的消息
  function updateMessageInCache(charId, messageId, updates, sessionId = 'player') {
    const cacheKey = getCacheKey(charId, sessionId)
    const messages = conversations[cacheKey]
    if (!messages) return

    const msg = messages.find(m => m.id === messageId)
    if (msg) {
      Object.assign(msg, updates)
    }
  }

  // 清空角色聊天缓存
  // 支持 charId（清空该角色所有会话）或 charId + sessionId（清空特定会话）
  function clearCache(charId, sessionId = null) {
    if (charId) {
      if (sessionId) {
        // 清空特定会话
        const cacheKey = getCacheKey(charId, sessionId)
        delete conversations[cacheKey]
        delete paginationInfo[cacheKey]
      } else {
        // 清空该角色的所有会话（遍历所有以 charId: 开头的 key）
        const prefix = `${charId}:`
        Object.keys(conversations).forEach(key => {
          if (key === charId || key.startsWith(prefix)) {
            delete conversations[key]
          }
        })
        Object.keys(paginationInfo).forEach(key => {
          if (key === charId || key.startsWith(prefix)) {
            delete paginationInfo[key]
          }
        })
      }
      // 清空未读数（未读数仍以 charId 为 key）
      delete unreadCounts[charId]
    } else {
      // 清空所有
      Object.keys(conversations).forEach(key => delete conversations[key])
      Object.keys(paginationInfo).forEach(key => delete paginationInfo[key])
      Object.keys(unreadCounts).forEach(key => delete unreadCounts[key])
    }
  }

  // ==================== Helper Functions ====================

  // 标准化消息数据
  function normalizeMessage(msg) {
    if (!msg) return msg

    // 解析 redpacketData
    if (msg.redpacketData && typeof msg.redpacketData === 'string') {
      try {
        msg.redpacketData = JSON.parse(msg.redpacketData)
      } catch (e) {}
    }

    // 解析 transferData
    if (msg.transferData && typeof msg.transferData === 'string') {
      try {
        msg.transferData = JSON.parse(msg.transferData)
      } catch (e) {}
    }

    // 确保红包消息类型正确
    if (msg.redpacketData && msg.type !== 'redpacket') {
      const rpStatus = msg.redpacketData.status
      if (!rpStatus || (rpStatus !== 'unclaimed' && rpStatus !== 'opened')) {
        msg.type = 'transfer'
        msg.transferData = {
          amount: msg.redpacketData.amount,
          status: 'accepted'
        }
      } else {
        msg.type = 'redpacket'
      }
    }

    // 解析 content JSON
    if (msg.content && typeof msg.content === 'string') {
      try {
        const parsed = JSON.parse(msg.content)
        if (parsed.type) msg.type = parsed.type
        if (parsed.redpacketData) {
          msg.redpacketData = parsed.redpacketData
          const rpStatus = parsed.redpacketData.status
          if (rpStatus === 'unclaimed' || rpStatus === 'opened') {
            msg.type = 'redpacket'
          } else {
            msg.type = 'transfer'
            msg.transferData = { amount: parsed.redpacketData.amount, status: 'accepted' }
          }
        }
        if (parsed.transferData) msg.transferData = parsed.transferData
      } catch (e) {}
    }

    return msg
  }

  return {
    // State
    conversations,
    pendingRequests,
    unreadCounts,
    activeCharId,
    sendingQueue,
    paginationInfo,

    // Getters
    getMessages,
    getPaginationInfo,
    getCacheKey,
    isPending,
    getUnreadCount,
    getTotalUnread,

    // Actions
    enterChat,
    leaveChat,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendMessageBackground,
    addMessageToCache,
    updateMessageInCache,
    clearCache
  }
})
