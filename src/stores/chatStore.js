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

  // 获取指定角色的消息
  function getMessages(charId) {
    return conversations[charId] || []
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

  // ==================== Actions ====================

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
    // 如果已有缓存且不强制刷新，直接返回
    if (!forceReload && conversations[charId] && conversations[charId].length > 0) {
      return conversations[charId]
    }

    try {
      const result = await getChatMessages(charId, sessionId, { limit: 20 })
      const messages = (result.data || []).map(normalizeMessage)
      conversations[charId] = messages
      paginationInfo[charId] = {
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
    const pagination = paginationInfo[charId]
    if (!pagination || !pagination.hasMore) return false

    try {
      const result = await getChatMessages(charId, sessionId, {
        limit: 10,
        beforeIndex: pagination.nextIndex
      })

      if (result.data && result.data.length > 0) {
        const newMessages = result.data.map(normalizeMessage)
        // 插入到数组头部
        conversations[charId] = [...newMessages, ...(conversations[charId] || [])]
        paginationInfo[charId] = {
          hasMore: result.hasMore || false,
          nextIndex: result.nextIndex || 0
        }
        return true
      }

      paginationInfo[charId].hasMore = false
      return false
    } catch (e) {
      console.error('加载更多消息失败:', e)
      return false
    }
  }

  // 发送消息（仅发送，不触发 AI）
  async function sendMessage(charId, text, sessionId = 'player', sender = 'player', senderName, options = {}) {
    try {
      const msg = await sendChatMessage(charId, text, sessionId, sender, senderName, options)
      const normalizedMsg = normalizeMessage(msg)

      // 添加到缓存
      if (!conversations[charId]) {
        conversations[charId] = []
      }
      conversations[charId].push(normalizedMsg)

      return normalizedMsg
    } catch (e) {
      console.error('发送消息失败:', e)
      throw e
    }
  }

  // 核心：后台发送消息并获取 AI 回复
  async function sendMessageBackground(charId, text, sessionId = 'player', options = {}) {
    const { profile, character, onTypingStart, onTypingEnd, onMessageReceived } = options

    // Step 1: 立即发送用户消息
    try {
      const userMsg = await sendChatMessage(charId, text, sessionId, 'player')
      const normalizedUserMsg = normalizeMessage(userMsg)

      if (!conversations[charId]) {
        conversations[charId] = []
      }
      conversations[charId].push(normalizedUserMsg)
    } catch (e) {
      console.error('发送用户消息失败:', e)
      throw e
    }

    // Step 2: 标记为等待回复
    pendingRequests.value.add(charId)
    sendingQueue[charId] = true
    onTypingStart?.()

    // Step 3: 异步调用 AI API（不会被组件卸载打断）
    const aiPromise = (async () => {
      try {
        // 构建上下文
        const recentMessages = (conversations[charId] || []).slice(-20)
        const context = recentMessages
          .filter(m => m.sender === 'player' || m.sender === 'character')
          .map(m => m.text)
          .join('\n')

        const aiReply = await sendAIMessage(charId, context)

        // Step 4: 处理 AI 回复
        const { textParts, redpackets } = parseAIResponse(aiReply.text)

        // 处理文本消息队列
        if (textParts.length > 0) {
          const finalQueue = processAIResponse(textParts.join(' '))
          await sendMessageQueueBackground(charId, finalQueue, sessionId, profile, character)
        }

        // 处理红包
        for (const rp of redpackets) {
          await sendRedPacketFromAI(charId, rp.amount, rp.note, sessionId, profile, character)
        }

        // 处理待收款转账
        await processPendingTransfers(charId, sessionId, profile, character)

        // 通知：如果用户不在当前聊天窗口
        if (activeCharId.value !== charId) {
          // 增加未读数
          if (!unreadCounts[charId]) {
            unreadCounts[charId] = 0
          }
          unreadCounts[charId]++

          // 播放提示音（静音处理）
          try {
            notificationSound.volume = 0.3
            notificationSound.play().catch(() => {})
          } catch (e) {}
        }

        onMessageReceived?.()

      } catch (e) {
        console.error('AI 回复失败:', e)
        // 添加错误消息
        if (!conversations[charId]) {
          conversations[charId] = []
        }
        conversations[charId].push({
          id: Date.now(),
          sender: 'system',
          text: `AI 回复失败: ${e.message}`,
          timestamp: new Date().toISOString()
        })
      } finally {
        // 清理状态
        pendingRequests.value.delete(charId)
        sendingQueue[charId] = false
        onTypingEnd?.()
      }
    })()

    // 返回 Promise 但不阻塞（让调用者可以选择等待或不等待）
    return aiPromise
  }

  // 消息队列发送（模拟打字延迟）
  async function sendMessageQueueBackground(charId, textArray, sessionId, profile, character) {
    if (textArray.length === 0) return

    for (let i = 0; i < textArray.length; i++) {
      const text = textArray[i]
      const isPunctuation = /^[。！？.!?]+$/.test(text)

      // 延迟策略
      let delay = 0
      if (i > 0) {
        if (isPunctuation) {
          delay = 200 + Math.random() * 200
        } else {
          delay = Math.min(2500, Math.max(600, text.length * 60))
        }
      }

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      try {
        const senderName = profile?.nickname || character?.name
        const aiMsg = await sendChatMessage(charId, text, sessionId, 'character', senderName)
        const normalizedMsg = normalizeMessage(aiMsg)

        if (!conversations[charId]) {
          conversations[charId] = []
        }
        conversations[charId].push(normalizedMsg)
      } catch (e) {
        console.error('保存消息失败:', e)
      }
    }
  }

  // AI 发送红包
  async function sendRedPacketFromAI(charId, amount, note, sessionId, profile, character) {
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

      if (!conversations[charId]) {
        conversations[charId] = []
      }
      conversations[charId].push(normalizeMessage(msg))
    } catch (e) {
      console.error('AI 发送红包失败:', e)
    }
  }

  // 处理待收款转账
  async function processPendingTransfers(charId, sessionId, profile, character) {
    const messages = conversations[charId] || []

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
        conversations[charId].push(normalizeMessage(confirmMsg))
      } catch (e) {
        console.error('发送收款确认消息失败:', e)
      }
    }
  }

  // 直接添加消息到缓存（用于本地创建的消息）
  function addMessageToCache(charId, message) {
    if (!conversations[charId]) {
      conversations[charId] = []
    }
    conversations[charId].push(normalizeMessage(message))
  }

  // 更新缓存中的消息
  function updateMessageInCache(charId, messageId, updates) {
    const messages = conversations[charId]
    if (!messages) return

    const msg = messages.find(m => m.id === messageId)
    if (msg) {
      Object.assign(msg, updates)
    }
  }

  // 清空角色聊天缓存
  function clearCache(charId) {
    if (charId) {
      delete conversations[charId]
      delete paginationInfo[charId]
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

  // 解析 AI 回复，提取红包标签
  function parseAIResponse(fullText) {
    const redpackets = []
    const redpacketRegex = /<redpacket\s+amount="([^"]+)"\s+note="([^"]*)"[^>]*>([^<]*)<\/redpacket>/gi

    let match
    while ((match = redpacketRegex.exec(fullText)) !== null) {
      redpackets.push({
        amount: match[1],
        note: match[2] || '恭喜发财，大吉大利'
      })
    }

    const textWithoutRedpackets = fullText.replace(redpacketRegex, '').trim()
    const textParts = textWithoutRedpackets.split(/\s+/).filter(s => s.length > 0)

    return {
      textParts: textParts.length > 0 ? [textWithoutRedpackets] : [],
      redpackets
    }
  }

  // 处理 AI 回复分割
  function processAIResponse(fullText) {
    const segments = fullText.split('###')
    const finalQueue = []

    segments.forEach(seg => {
      const trimmed = seg.trim()
      if (!trimmed) return

      const parts = trimmed.split(/([。！？.!?]+)/).filter(s => s.length > 0)

      let i = 0
      while (i < parts.length) {
        const current = parts[i]
        const next = parts[i + 1]
        const isPunctuation = /^[。！？.!?]+$/.test(current)

        if (isPunctuation) {
          finalQueue.push(current)
          i++
        } else if (next && /^[。！？.!?]+$/.test(next)) {
          finalQueue.push(current + next)
          i += 2
        } else {
          finalQueue.push(current)
          i++
        }
      }
    })

    return finalQueue.filter(s => s.trim().length > 0)
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
