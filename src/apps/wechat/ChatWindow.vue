<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, MoreHorizontal, Smile, Send, SendHorizonal, Plus, X, Heart, Image, Camera } from 'lucide-vue-next'
import {
  sendChatMessage,
  getWechatProfile,
  updateChatMessage,
  deleteChatMessage
} from '../../services/wechatApi.js'
import { getCharacterForChat, getPersonas } from '../../services/api.js'
import { useChatStore } from '../../stores/chatStore.js'
import TransferBubble from './TransferBubble.vue'
import RedPacketBubble from './RedPacketBubble.vue'
import PrivateRedPacketModal from './PrivateRedPacketModal.vue'

const props = defineProps({
  charId: { type: String, required: true },
  sessionId: { type: String, default: 'player' },
  readOnly: { type: Boolean, default: false },
  // 视角模式: 'player' = 我是玩家, 'spy' = 偷看模式（我是角色）
  viewMode: { type: String, default: 'player' },
  // 会话元数据（spy模式下用于显示对方名称）
  sessionMeta: { type: Object, default: null }
})

// 使用全局 Chat Store
const chatStore = useChatStore()

// 计算当前视角的持有者 ID
const ownerId = computed(() => {
  // player 模式：持有者是 user/player
  // spy 模式：持有者是 character（角色的手机）
  return props.viewMode === 'spy' ? 'character' : 'user'
})

// 判断消息是否是"我方"发送的（根据视角）
function isOwnMessage(msg) {
  // 统一 sender 标识
  const sender = msg.sender === 'player' ? 'user' : msg.sender
  return sender === ownerId.value
}

const emit = defineEmits(['back', 'openProfile'])

// 从 Store 获取消息（响应式）
const messages = computed(() => chatStore.getMessages(props.charId, props.sessionId))

const inputText = ref('')
const isTyping = computed(() => chatStore.isPending(props.charId))
const isSendingQueue = computed(() => chatStore.sendingQueue[props.charId] || false)
const chatListRef = ref(null)
const inputRef = ref(null)
const profile = ref(null)
const character = ref(null)
const boundPersona = ref(null) // 绑定的人设

// 分页相关（从 Store 获取）
const hasMoreMessages = computed(() => chatStore.getPaginationInfo(props.charId, props.sessionId).hasMore)
const isLoadingMore = ref(false)

// 表情面板状态
const showEmojiPanel = ref(false)
const emojiTab = ref('emoji') // 'emoji' | 'custom'

// 功能面板状态
const showActionPanel = ref(false)

// 转账弹窗状态
const showTransferModal = ref(false)
const transferAmount = ref('')

// 余额不足弹窗状态
const showInsufficientModal = ref(false)
const insufficientData = ref({ balance: 0, required: 0 })

// 红包弹窗状态
const showRedPacketModal = ref(false)
const currentRedPacketMsg = ref(null)

// 常用 Emoji 表情（微信风格分类）
const emojiCategories = [
  {
    name: '常用',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥']
  },
  {
    name: '情绪',
    emojis: ['😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
  },
  {
    name: '手势',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂']
  },
  {
    name: '爱心',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💋', '💌', '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌷', '🪷', '🪻', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾']
  },
  {
    name: '动物',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗']
  },
  {
    name: '食物',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚']
  },
  {
    name: '物品',
    emojis: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌']
  }
]

// 自定义表情（从 localStorage 读取）
const customStickers = ref([])

// 加载自定义表情
function loadCustomStickers() {
  try {
    const saved = localStorage.getItem('wechat_custom_stickers')
    if (saved) {
      customStickers.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('加载自定义表情失败:', e)
  }
}

// 保存自定义表情
function saveCustomStickers() {
  try {
    localStorage.setItem('wechat_custom_stickers', JSON.stringify(customStickers.value))
  } catch (e) {
    console.error('保存自定义表情失败:', e)
  }
}

// 添加自定义表情（通过文件选择）
const stickerInputRef = ref(null)

function triggerStickerUpload() {
  stickerInputRef.value?.click()
}

async function handleStickerUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    const base64 = await fileToBase64(file)
    customStickers.value.push({
      id: Date.now(),
      url: base64
    })
    saveCustomStickers()
  } catch (e) {
    console.error('上传表情失败:', e)
  }

  event.target.value = ''
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 删除自定义表情
function deleteSticker(sticker) {
  const index = customStickers.value.findIndex(s => s.id === sticker.id)
  if (index > -1) {
    customStickers.value.splice(index, 1)
    saveCustomStickers()
  }
}

// 右键/长按菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  message: null
})
let longPressTimer = null

// 会话名称映射
const sessionNames = {
  'player': '与我的对话',
  'npc_team': '微信团队',
  'npc_ex': '前任'
}

// 标题栏显示（包含输入状态）
const headerTitle = computed(() => {
  if (isSendingQueue.value) {
    return '对方正在输入...'
  }

  // Spy 模式：显示会话对象名称（NPC名称）
  if (props.viewMode === 'spy') {
    // 优先使用 sessionMeta 中的名称
    if (props.sessionMeta?.name) {
      return props.sessionMeta.name
    }
    // 如果是和玩家的对话，显示玩家人设名或"玩家"
    if (props.sessionId === 'player') {
      return boundPersona.value?.name || '玩家'
    }
    // 其他会话使用 sessionNames 映射
    return sessionNames[props.sessionId] || props.sessionMeta?.topic || '聊天'
  }

  // Player 模式：显示角色名
  if (props.sessionId === 'player') {
    return profile.value?.nickname || character.value?.name || '聊天'
  }
  return sessionNames[props.sessionId] || props.sessionId
})

const sessionTitle = computed(() => {
  // Spy 模式
  if (props.viewMode === 'spy') {
    if (props.sessionMeta?.name) {
      return props.sessionMeta.name
    }
    if (props.sessionId === 'player') {
      return boundPersona.value?.name || '玩家'
    }
    return sessionNames[props.sessionId] || '聊天'
  }

  // Player 模式
  if (props.sessionId === 'player') {
    return profile.value?.nickname || character.value?.name || '聊天'
  }
  return sessionNames[props.sessionId] || props.sessionId
})

const backgroundStyle = computed(() => {
  // 优先使用聊天背景，其次使用角色立绘
  const bgImage = profile.value?.chatBackground || character.value?.portrait
  if (bgImage) {
    return {
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})

onMounted(async () => {
  // 进入聊天时通知 Store
  chatStore.enterChat(props.charId)
  await loadData()
  loadCustomStickers()
  document.addEventListener('click', hideContextMenu)
  document.addEventListener('touchstart', hideContextMenu)
})

onUnmounted(() => {
  // 离开聊天时通知 Store
  chatStore.leaveChat()
  document.removeEventListener('click', hideContextMenu)
  document.removeEventListener('touchstart', hideContextMenu)
})

watch(() => [props.charId, props.sessionId], async () => {
  // 切换角色时更新 Store
  chatStore.enterChat(props.charId)
  await loadData()
})

// 注：normalizeMessage 已移至 chatStore

async function loadData() {
  try {
    const [profileData, charData, personasData] = await Promise.all([
      getWechatProfile(props.charId),
      getCharacterForChat(props.charId).catch(() => null),
      getPersonas().catch(() => [])
    ])
    profile.value = profileData
    character.value = charData

    // 从 Store 加载消息（如果缓存中有数据则使用缓存，避免界面闪烁）
    await chatStore.loadMessages(props.charId, props.sessionId, false)

    // 查找绑定的人设
    if (profileData?.boundPersonaId) {
      boundPersona.value = personasData.find(p => p.id === profileData.boundPersonaId) || null
    } else {
      boundPersona.value = null
    }

    // 如果是 player 会话且没有消息，且角色有开场白，自动发送开场白
    if (props.sessionId === 'player' && messages.value.length === 0 && charData?.greeting && !props.readOnly) {
      await sendGreeting(charData.greeting)
    }

    // 确保滚动到最新消息
    scrollToBottom()
  } catch (e) {
    console.error('加载数据失败:', e)
  }
}

// 加载更多历史消息
async function loadMoreMessages() {
  if (isLoadingMore.value || !hasMoreMessages.value) return

  isLoadingMore.value = true
  const container = chatListRef.value
  const oldScrollHeight = container?.scrollHeight || 0

  try {
    const loaded = await chatStore.loadMoreMessages(props.charId, props.sessionId)

    if (loaded) {
      // 保持滚动位置 - 关键步骤
      nextTick(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight
          container.scrollTop = newScrollHeight - oldScrollHeight
        }
      })
    }
  } catch (e) {
    console.error('加载更多消息失败:', e)
  } finally {
    isLoadingMore.value = false
  }
}

// 滚动事件处理（节流）
let scrollThrottleTimer = null
function handleScroll() {
  if (scrollThrottleTimer) return

  scrollThrottleTimer = setTimeout(() => {
    scrollThrottleTimer = null

    if (!chatListRef.value) return

    // 当滚动到顶部附近时加载更多
    if (chatListRef.value.scrollTop < 100 && hasMoreMessages.value && !isLoadingMore.value) {
      loadMoreMessages()
    }
  }, 100)
}

// 发送开场白
async function sendGreeting(greetingText) {
  if (!greetingText) return

  try {
    // 处理开场白（可能包含 ### 分隔符）
    const greetingParts = greetingText.split('###').map(s => s.trim()).filter(s => s)

    for (const part of greetingParts) {
      const msg = await sendChatMessage(
        props.charId,
        part,
        props.sessionId,
        'character',
        profile.value?.nickname || character.value?.name
      )
      chatStore.addMessageToCache(props.charId, msg, props.sessionId)
    }
    scrollToBottom()
  } catch (e) {
    console.error('发送开场白失败:', e)
  }
}

function scrollToBottom(immediate = false) {
  const doScroll = () => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  }

  if (immediate) {
    doScroll()
  } else {
    nextTick(() => {
      // 双重 nextTick 确保 DOM 完全渲染
      nextTick(doScroll)
    })
  }
}

// 仅发送消息到本地（不触发AI）
async function sendOnly() {
  if (!inputText.value.trim() || isTyping.value || props.readOnly) return

  const text = inputText.value.trim()
  inputText.value = ''

  try {
    await chatStore.sendMessage(props.charId, text, props.sessionId, 'player')
    scrollToBottom()
  } catch (e) {
    console.error('发送失败:', e)
  }
}

// 发送并触发AI回复（使用 Store 后台处理）
async function sendAndAI() {
  if (!inputText.value.trim() || isTyping.value || props.readOnly) return

  const text = inputText.value.trim()
  inputText.value = ''

  try {
    // 使用 Store 的后台发送功能
    chatStore.sendMessageBackground(props.charId, text, props.sessionId, {
      profile: profile.value,
      character: character.value,
      onTypingStart: () => scrollToBottom(),
      onTypingEnd: () => scrollToBottom(),
      onMessageReceived: () => scrollToBottom()
    })
    scrollToBottom()
  } catch (e) {
    console.error('发送失败:', e)
  }
}

// 注：AI 回复解析和消息队列发送已移至 chatStore

// ==================== 右键/长按菜单 ====================

// PC端右键菜单
function handleContextMenu(e, msg) {
  if (msg.type === 'recalled') return
  e.preventDefault()
  showContextMenu(e.clientX, e.clientY, msg)
}

// 移动端长按开始
function handleTouchStart(e, msg) {
  if (msg.type === 'recalled') return
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
  // 调整位置防止超出屏幕
  const menuWidth = 120
  const menuHeight = 80
  const maxX = window.innerWidth - menuWidth - 10
  const maxY = window.innerHeight - menuHeight - 10

  contextMenu.value = {
    visible: true,
    x: Math.min(x, maxX),
    y: Math.min(y, maxY),
    message: msg
  }
}

// 隐藏菜单
function hideContextMenu(e) {
  if (e && e.target.closest('.context-menu')) return
  contextMenu.value.visible = false
}

// 撤回消息
async function recallMessage() {
  const msg = contextMenu.value.message
  if (msg) {
    const recallText = msg.sender === 'player' ? '你撤回了一条消息' : `"${sessionTitle.value}"撤回了一条消息`

    // 先更新本地状态
    msg.originalText = msg.text
    msg.type = 'recalled'
    msg.text = recallText

    // 同步到后端
    try {
      await updateChatMessage(props.charId, props.sessionId, msg.id, {
        type: 'recalled',
        text: recallText,
        originalText: msg.originalText
      })
    } catch (e) {
      console.error('撤回消息同步失败:', e)
    }
  }
  contextMenu.value.visible = false
}

// 复制消息
function copyMessage() {
  const msg = contextMenu.value.message
  if (msg) {
    navigator.clipboard.writeText(msg.text).catch(() => {})
  }
  contextMenu.value.visible = false
}

// 删除消息（彻底删除，不留痕迹）
async function deleteMessage() {
  const msg = contextMenu.value.message
  contextMenu.value.visible = false

  if (!msg) return

  try {
    // 从后端删除
    await deleteChatMessage(props.charId, props.sessionId, msg.id)

    // 从本地缓存中移除
    const cacheKey = `${props.charId}:${props.sessionId}`
    const msgs = chatStore.conversations[cacheKey]
    if (msgs) {
      const index = msgs.findIndex(m => m.id === msg.id)
      if (index !== -1) {
        msgs.splice(index, 1)
      }
    }
  } catch (e) {
    console.error('删除消息失败:', e)
    alert('删除失败: ' + (e.message || '未知错误'))
  }
}

function goBack() {
  emit('back')
}

function openProfile() {
  emit('openProfile')
}

// ==================== 表情面板 ====================

function toggleEmojiPanel() {
  showEmojiPanel.value = !showEmojiPanel.value
  if (showEmojiPanel.value) {
    showActionPanel.value = false
  }
}

function closeEmojiPanel() {
  showEmojiPanel.value = false
}

// ==================== 功能面板 ====================

function toggleActionPanel() {
  showActionPanel.value = !showActionPanel.value
  if (showActionPanel.value) {
    showEmojiPanel.value = false
  }
}

function closeActionPanel() {
  showActionPanel.value = false
}

// 关闭所有面板
function closePanels() {
  showEmojiPanel.value = false
  showActionPanel.value = false
}

// ==================== 转账功能 ====================

function openTransferModal() {
  showActionPanel.value = false
  showTransferModal.value = true
  transferAmount.value = ''
}

function closeTransferModal() {
  showTransferModal.value = false
}

// 显示余额不足弹窗
function showInsufficientBalance(balance, required) {
  insufficientData.value = { balance, required }
  showInsufficientModal.value = true
}

// 关闭余额不足弹窗
function closeInsufficientModal() {
  showInsufficientModal.value = false
}

async function sendTransfer() {
  if (!transferAmount.value || parseFloat(transferAmount.value) <= 0) {
    alert('请输入转账金额')
    return
  }

  const amount = parseFloat(transferAmount.value).toFixed(2)
  const numAmount = parseFloat(amount)

  // 获取当前人设ID
  const personaId = profile.value?.boundPersonaId || 'default'

  try {
    // 先检查余额是否充足
    const token = localStorage.getItem('auth_token')
    const balanceRes = await fetch(`/api/bank/balance?personaId=${personaId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const balanceData = await balanceRes.json()

    if (balanceData.success) {
      const currentBalance = balanceData.data.balance || 0
      if (currentBalance < numAmount) {
        // 显示仿真余额不足弹窗
        showInsufficientBalance(currentBalance, numAmount)
        return
      }
    }

    // 扣减余额
    const expenseRes = await fetch('/api/bank/transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'expense',
        amount: numAmount,
        source: props.charId,
        source_name: profile.value?.nickname || character.value?.name || '好友',
        note: '微信转账',
        personaId,
        personaName: boundPersona.value?.name || '默认身份'
      })
    })

    const expenseData = await expenseRes.json()
    if (!expenseRes.ok) {
      // 后端返回余额不足
      const balance = expenseData.current_balance || 0
      showInsufficientBalance(balance, numAmount)
      return
    }

    // 发送转账消息，初始状态为 pending（待收款）
    const msg = await sendChatMessage(
      props.charId,
      `[转账] ¥${amount}`,
      props.sessionId,
      'player',
      undefined,
      {
        type: 'transfer',
        transferData: {
          amount,
          status: 'pending' // 初始状态：待收款
        }
      }
    )
    chatStore.addMessageToCache(props.charId, msg, props.sessionId)
    scrollToBottom()
    closeTransferModal()
  } catch (e) {
    console.error('发送转账失败:', e)
    alert('发送转账失败')
  }
}

// 注：转账处理已移至 chatStore.processPendingTransfers

// ==================== 红包功能 ====================

// 点击红包气泡
function handleRedPacketClick(msg) {
  // 自己发的红包不能打开
  if (isOwnMessage(msg)) return
  // 已经打开的不能再打开
  if (msg.redpacketData?.status === 'opened') return

  currentRedPacketMsg.value = msg
  showRedPacketModal.value = true
}

// 红包开启回调
async function handleOpenRedPacket(msg) {
  if (!msg) return

  // 更新本地消息状态
  msg.redpacketData = {
    ...msg.redpacketData,
    status: 'opened'
  }

  // 更新 Store 中的消息
  chatStore.updateMessageInCache(props.charId, msg.id, {
    redpacketData: msg.redpacketData
  }, props.sessionId)

  // 更新后端
  try {
    await updateChatMessage(props.charId, props.sessionId, msg.id, {
      redpacketData: msg.redpacketData
    })
  } catch (e) {
    console.error('更新红包状态失败:', e)
  }

  // 同步存入银行账户
  try {
    const token = localStorage.getItem('auth_token')
    // 获取当前绑定的人设ID和名称
    const personaId = profile.value?.boundPersonaId || 'default'
    const personaName = boundPersona.value?.name || '默认身份'

    await fetch('/api/bank/transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'income',
        amount: msg.redpacketData?.amount || 0,
        source: props.charId,
        source_name: profile.value?.nickname || character.value?.name || '好友',
        note: msg.redpacketData?.note || '微信红包',
        personaId,
        personaName
      })
    })
  } catch (e) {
    console.error('同步银行账户失败:', e)
  }
}

// 关闭红包弹窗
function closeRedPacketModal() {
  showRedPacketModal.value = false
  currentRedPacketMsg.value = null
}

// 插入 Emoji 到输入框
function insertEmoji(emoji) {
  inputText.value += emoji
  // 保持输入框焦点
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 发送自定义表情贴纸
async function sendSticker(sticker) {
  if (isTyping.value || isSendingQueue.value || props.readOnly) return

  closeEmojiPanel()

  try {
    // 发送贴纸消息
    const msg = await sendChatMessage(
      props.charId,
      '[表情]',
      props.sessionId,
      'player'
    )
    // 标记为贴纸类型
    msg.type = 'sticker'
    msg.stickerUrl = sticker.url
    chatStore.addMessageToCache(props.charId, msg, props.sessionId)
    scrollToBottom()
  } catch (e) {
    console.error('发送表情失败:', e)
  }
}

// 获取头像样式类
function getAvatarClass(msg) {
  const isOwn = isOwnMessage(msg)

  // 我方头像样式
  if (isOwn) {
    if (props.viewMode === 'spy') {
      // Spy模式：我方是角色，使用角色头像背景
      return { 'character-avatar': !profile.value?.avatar && !character.value?.avatar }
    } else {
      // Player模式：我方是玩家
      return { 'player-avatar': !boundPersona.value?.avatar }
    }
  }

  // 对方头像样式
  if (props.viewMode === 'spy') {
    // Spy模式：对方可能是玩家或NPC
    if (msg.sender === 'player') {
      return { 'player-avatar': !boundPersona.value?.avatar }
    }
    return { 'npc-avatar': true }
  } else {
    // Player模式：对方是角色
    return { 'character-avatar': !profile.value?.avatar && !character.value?.avatar }
  }
}
</script>

<template>
  <div class="chat-window" :style="backgroundStyle">
    <!-- 背景遮罩 -->
    <div v-if="profile?.chatBackground" class="backdrop"></div>

    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title" :class="{ typing: isSendingQueue }" @click="openProfile">{{ headerTitle }}</span>
      <button class="icon-btn" @click="openProfile">
        <MoreHorizontal :size="22" />
      </button>
    </div>

    <!-- 只读模式提示 -->
    <div v-if="readOnly" class="readonly-banner">
      偷看模式 - 只能查看，不能发送消息
    </div>

    <!-- 消息列表 -->
    <div class="message-list" ref="chatListRef" @scroll="handleScroll">
      <!-- 加载更多提示 -->
      <div v-if="isLoadingMore" class="loading-more">
        <div class="loading-spinner"></div>
        <span>加载历史消息...</span>
      </div>
      <div v-else-if="hasMoreMessages" class="load-more-hint" @click="loadMoreMessages">
        ↑ 向上滚动加载更多
      </div>
      <div v-else-if="messages.length > 0" class="no-more-hint">
        — 已经是最早的消息了 —
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="{ own: isOwnMessage(msg), other: !isOwnMessage(msg) }"
      >
        <!-- 时间戳 -->
        <div v-if="msg.showTime" class="time-divider">
          {{ new Date(msg.timestamp).toLocaleString() }}
        </div>

        <!-- 系统消息（撤回等） -->
        <div v-if="msg.type === 'recalled' || msg.sender === 'system'" class="system-msg">
          {{ msg.text }}
        </div>

        <!-- 普通消息气泡 -->
        <div
          v-else
          class="bubble-wrapper"
          :class="{ own: isOwnMessage(msg), other: !isOwnMessage(msg) }"
          @contextmenu="handleContextMenu($event, msg)"
          @touchstart="handleTouchStart($event, msg)"
          @touchend="handleTouchEnd"
          @touchmove="handleTouchEnd"
        >
          <!-- 头像 -->
          <div class="avatar" :class="getAvatarClass(msg)">
            <template v-if="isOwnMessage(msg)">
              <!-- 我方头像（根据视角不同） -->
              <template v-if="viewMode === 'spy'">
                <!-- Spy模式：我方是角色 -->
                <img v-if="profile?.avatar || character?.avatar" :src="profile?.avatar || character?.avatar" />
                <span v-else>{{ (profile?.nickname || character?.name)?.[0] || '?' }}</span>
              </template>
              <template v-else>
                <!-- Player模式：我方是玩家 -->
                <img v-if="boundPersona?.avatar" :src="boundPersona.avatar" />
                <span v-else>{{ boundPersona?.name?.[0] || '我' }}</span>
              </template>
            </template>
            <template v-else>
              <!-- 对方头像（根据视角和发送者不同） -->
              <template v-if="viewMode === 'spy'">
                <!-- Spy模式：对方可能是玩家或NPC -->
                <template v-if="msg.sender === 'player'">
                  <!-- 对方是玩家 -->
                  <img v-if="boundPersona?.avatar" :src="boundPersona.avatar" />
                  <span v-else>{{ boundPersona?.name?.[0] || '玩' }}</span>
                </template>
                <template v-else>
                  <!-- 对方是NPC -->
                  <img v-if="msg.senderAvatar" :src="msg.senderAvatar" />
                  <span v-else>{{ (msg.senderName || sessionMeta?.name || '?')[0] }}</span>
                </template>
              </template>
              <template v-else>
                <!-- Player模式：对方是角色 -->
                <img v-if="profile?.avatar || character?.avatar" :src="profile?.avatar || character?.avatar" />
                <span v-else>{{ (msg.senderName || sessionTitle)?.[0] || '?' }}</span>
              </template>
            </template>
          </div>

          <!-- 气泡内容 -->
          <div class="bubble" :class="{
            own: isOwnMessage(msg),
            other: !isOwnMessage(msg),
            'transfer-wrapper': msg.type === 'transfer',
            'redpacket-wrapper': msg.type === 'redpacket'
          }">
            <!-- 红包消息 -->
            <RedPacketBubble
              v-if="msg.type === 'redpacket'"
              :message="msg"
              :is-own="isOwnMessage(msg)"
              @click="handleRedPacketClick"
            />

            <!-- 转账消息 -->
            <TransferBubble
              v-else-if="msg.type === 'transfer'"
              :message="msg"
              :is-own="isOwnMessage(msg)"
            />

            <!-- 表情贴纸 -->
            <img v-else-if="msg.type === 'sticker'" :src="msg.stickerUrl" class="sticker-img" />

            <!-- 普通文本 -->
            <template v-else>{{ msg.text }}</template>
          </div>
        </div>
      </div>

      <!-- 正在输入 -->
      <div v-if="isTyping" class="message-row other">
        <div class="bubble-wrapper other">
          <div class="avatar">
            <template v-if="viewMode === 'spy'">
              <!-- Spy模式：输入中显示玩家头像 -->
              <img v-if="boundPersona?.avatar" :src="boundPersona.avatar" />
              <span v-else>{{ boundPersona?.name?.[0] || '玩' }}</span>
            </template>
            <template v-else>
              <!-- Player模式：输入中显示角色头像 -->
              <img v-if="profile?.avatar" :src="profile.avatar" />
              <span v-else>{{ sessionTitle?.[0] || '?' }}</span>
            </template>
          </div>
          <div class="bubble other">
            <span class="typing-dots">
              <span></span><span></span><span></span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键/长按菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="menu-item" @click="copyMessage">
          复制
        </div>
        <div class="menu-item" @click="recallMessage">
          撤回
        </div>
        <div class="menu-item" @click="deleteMessage">
          删除
        </div>
      </div>
    </Teleport>

    <!-- 输入区域 -->
    <div class="input-area" v-if="!readOnly">
      <button class="icon-btn" :class="{ active: showActionPanel }" @click="toggleActionPanel">
        <Plus :size="22" />
      </button>
      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        placeholder="输入消息..."
        :disabled="isTyping || isSendingQueue"
        @keyup.enter="sendAndAI"
        @focus="closePanels"
      />
      <button class="icon-btn" :class="{ active: showEmojiPanel }" @click="toggleEmojiPanel">
        <Smile :size="22" />
      </button>

      <div class="send-buttons">
        <button
          class="send-btn secondary"
          :disabled="isTyping || isSendingQueue"
          @click="sendOnly"
          title="仅发送"
        >
          <Send :size="18" />
        </button>
        <button
          class="send-btn primary"
          :disabled="isTyping || isSendingQueue"
          @click="sendAndAI"
          title="发送并获取AI回复"
        >
          <SendHorizonal :size="18" />
        </button>
      </div>
    </div>

    <!-- 功能面板 -->
    <div class="action-panel" :class="{ show: showActionPanel && !readOnly }">
      <div class="action-grid">
        <div class="action-item" @click="closeActionPanel">
          <div class="action-icon">
            <Image :size="28" />
          </div>
          <span class="action-label">相册</span>
        </div>
        <div class="action-item" @click="closeActionPanel">
          <div class="action-icon">
            <Camera :size="28" />
          </div>
          <span class="action-label">拍摄</span>
        </div>
        <div class="action-item" @click="openTransferModal">
          <div class="action-icon transfer-icon">
            <span>💰</span>
          </div>
          <span class="action-label">转账</span>
        </div>
      </div>
    </div>

    <!-- 表情面板 -->
    <div v-if="showEmojiPanel && !readOnly" class="emoji-panel">
      <!-- 表情面板顶部 Tab -->
      <div class="emoji-tabs">
        <button
          class="emoji-tab"
          :class="{ active: emojiTab === 'emoji' }"
          @click="emojiTab = 'emoji'"
        >
          <Smile :size="20" />
        </button>
        <button
          class="emoji-tab"
          :class="{ active: emojiTab === 'custom' }"
          @click="emojiTab = 'custom'"
        >
          <Heart :size="20" />
        </button>
      </div>

      <!-- Emoji 表情 -->
      <div v-if="emojiTab === 'emoji'" class="emoji-content">
        <div v-for="category in emojiCategories" :key="category.name" class="emoji-category">
          <div class="category-name">{{ category.name }}</div>
          <div class="emoji-grid">
            <button
              v-for="emoji in category.emojis"
              :key="emoji"
              class="emoji-item"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>

      <!-- 自定义表情 -->
      <div v-if="emojiTab === 'custom'" class="emoji-content custom-content">
        <div class="custom-header">
          <span>我的表情</span>
          <button class="add-sticker-btn" @click="triggerStickerUpload">
            <Plus :size="16" />
            <span>添加</span>
          </button>
        </div>

        <div v-if="customStickers.length === 0" class="empty-stickers">
          <p>暂无自定义表情</p>
          <p class="hint">点击上方添加按钮上传图片</p>
        </div>

        <div v-else class="sticker-grid">
          <div
            v-for="sticker in customStickers"
            :key="sticker.id"
            class="sticker-item"
            @click="sendSticker(sticker)"
          >
            <img :src="sticker.url" alt="" />
            <button class="delete-sticker" @click.stop="deleteSticker(sticker)">
              <X :size="12" />
            </button>
          </div>
        </div>

        <!-- 隐藏的文件输入 -->
        <input
          ref="stickerInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleStickerUpload"
        />
      </div>
    </div>

    <!-- 转账弹窗 -->
    <div v-if="showTransferModal" class="transfer-modal-overlay" @click.self="closeTransferModal">
      <div class="transfer-modal">
        <div class="transfer-modal-header">
          <button class="close-btn" @click="closeTransferModal">
            <X :size="20" />
          </button>
          <span class="title">转账</span>
          <div style="width: 32px"></div>
        </div>

        <div class="transfer-modal-body">
          <div class="transfer-to">
            <span class="to-label">转账给</span>
            <span class="to-name">{{ profile?.nickname || character?.name || '好友' }}</span>
          </div>

          <div class="amount-input-section">
            <span class="currency-symbol">¥</span>
            <input
              v-model="transferAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              class="transfer-amount-input"
            />
          </div>

          <div class="transfer-hint">
            转账金额将直接发送给对方
          </div>
        </div>

        <div class="transfer-modal-footer">
          <button class="send-transfer-btn" @click="sendTransfer">
            转账
          </button>
        </div>
      </div>
    </div>

    <!-- 红包开启弹窗 -->
    <PrivateRedPacketModal
      :visible="showRedPacketModal"
      :message="currentRedPacketMsg"
      :sender-name="profile?.nickname || character?.name || '好友'"
      :sender-avatar="profile?.avatar || character?.avatar || ''"
      @close="closeRedPacketModal"
      @open="handleOpenRedPacket"
    />

    <!-- 余额不足弹窗 -->
    <div v-if="showInsufficientModal" class="insufficient-overlay" @click.self="closeInsufficientModal">
      <div class="insufficient-modal">
        <div class="insufficient-icon">
          <div class="wallet-icon">💳</div>
        </div>
        <div class="insufficient-title">余额不足</div>
        <div class="insufficient-content">
          <div class="balance-row">
            <span class="label">当前余额</span>
            <span class="value">¥{{ insufficientData.balance.toFixed(2) }}</span>
          </div>
          <div class="balance-row required">
            <span class="label">转账金额</span>
            <span class="value">¥{{ insufficientData.required.toFixed(2) }}</span>
          </div>
          <div class="balance-row diff">
            <span class="label">还需</span>
            <span class="value highlight">¥{{ (insufficientData.required - insufficientData.balance).toFixed(2) }}</span>
          </div>
        </div>
        <button class="insufficient-btn" @click="closeInsufficientModal">我知道了</button>
      </div>
    </div>

    <!-- 只读模式底部 -->
    <div v-if="readOnly" class="input-area readonly">
      <input type="text" placeholder="偷看模式，无法发送消息" disabled />
    </div>
  </div>
</template>

<style scoped>
.chat-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ebebeb;
  position: relative;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: inherit;
  filter: blur(10px) brightness(0.8);
  z-index: 0;
}

/* 顶部导航 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ebebeb;
  border-bottom: 1px solid #d6d6d6;
  position: relative;
  z-index: 10;
}

.header .title {
  font-size: 17px;
  font-weight: 500;
  color: #000;
  cursor: pointer;
}

.header .title.typing {
  color: #576b95;
  font-size: 14px;
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

.icon-btn:hover {
  background: rgba(0,0,0,0.05);
}

.readonly-banner {
  background: #fff3cd;
  color: #856404;
  padding: 8px 16px;
  text-align: center;
  font-size: 13px;
  position: relative;
  z-index: 10;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 1;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.message-list::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

.message-row {
  display: flex;
  flex-direction: column;
}

.time-divider {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin: 8px 0;
}

/* 系统消息 */
.system-msg {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 4px 0;
}

/* 气泡容器 */
.bubble-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
}

.bubble-wrapper.own {
  flex-direction: row-reverse;
}

.bubble-wrapper.other {
  flex-direction: row;
}

/* 头像 */
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar span {
  font-size: 14px;
  color: #fff;
}

.player-avatar {
  background: #576b95;
}

.character-avatar {
  background: #ccc;
}

.npc-avatar {
  background: #8e8e93;
}

/* 气泡 */
.bubble {
  max-width: calc(100% - 110px);
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
  position: relative;
  user-select: text;
}

.bubble.other {
  background: #fff;
  color: #000;
}

.bubble.own {
  background: #95ec69;
  color: #000;
}

/* 转账气泡包装器 - 去除默认气泡背景 */
.bubble.transfer-wrapper {
  padding: 0;
  background: transparent !important;
  overflow: visible;
  max-width: 200px;
}

/* 红包气泡包装器 - 去除默认气泡背景 */
.bubble.redpacket-wrapper {
  padding: 0;
  background: transparent !important;
  overflow: visible;
  max-width: 200px;
}

/* 表情贴纸 */
.sticker-img {
  max-width: 120px;
  max-height: 120px;
}

/* 正在输入动画 */
.typing-dots {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: #999;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* 右键/长按菜单 */
.context-menu {
  position: fixed;
  background: #4c4c4c;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 100px;
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

/* 输入区域 */
.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f7f7f7;
  border-top: 1px solid #d6d6d6;
  position: relative;
  z-index: 10;
}

.input-area.readonly {
  background: #eee;
}

.input-area input {
  flex: 1;
  padding: 10px 12px;
  border: none;
  border-radius: 4px;
  background: #fff;
  font-size: 15px;
  outline: none;
}

.input-area input:disabled {
  background: #f5f5f5;
  color: #999;
}

/* 发送按钮 */
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

.send-btn.secondary:hover:not(:disabled) {
  background: #d0d0d0;
}

.send-btn.primary {
  background: #07c160;
  color: #fff;
}

.send-btn.primary:hover:not(:disabled) {
  background: #06ad56;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 表情按钮激活状态 */
.icon-btn.active {
  color: #07c160;
}

/* 表情面板 */
.emoji-panel {
  background: #f7f7f7;
  border-top: 1px solid #d6d6d6;
  position: relative;
  z-index: 10;
}

.emoji-tabs {
  display: flex;
  background: #ededed;
  border-bottom: 1px solid #d6d6d6;
}

.emoji-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.emoji-tab.active {
  color: #07c160;
  background: #f7f7f7;
}

.emoji-tab:hover:not(.active) {
  background: #e5e5e5;
}

.emoji-content {
  height: 200px;
  overflow-y: auto;
  padding: 8px;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.emoji-content::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

.emoji-category {
  margin-bottom: 12px;
}

.category-name {
  font-size: 12px;
  color: #999;
  padding: 4px 8px;
  margin-bottom: 4px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.emoji-item {
  width: 100%;
  aspect-ratio: 1;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.emoji-item:hover {
  background: #e5e5e5;
}

.emoji-item:active {
  background: #d5d5d5;
  transform: scale(1.1);
}

/* 自定义表情 */
.custom-content {
  padding: 12px;
}

.custom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.custom-header span {
  font-size: 14px;
  color: #333;
}

.add-sticker-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  background: transparent;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-sticker-btn:hover {
  border-color: #07c160;
  color: #07c160;
}

.empty-stickers {
  text-align: center;
  padding: 30px;
  color: #999;
}

.empty-stickers p {
  margin: 4px 0;
}

.empty-stickers .hint {
  font-size: 12px;
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.sticker-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e5e5e5;
}

.sticker-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sticker-item:hover {
  border-color: #07c160;
}

.sticker-item:active {
  transform: scale(0.95);
}

.delete-sticker {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.sticker-item:hover .delete-sticker {
  opacity: 1;
}

.delete-sticker:hover {
  background: #e53935;
}

/* 加载更多 */
.loading-more, .load-more-hint, .no-more-hint {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: #999;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e5e5;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.load-more-hint {
  cursor: pointer;
  color: #576b95;
}

.load-more-hint:hover {
  text-decoration: underline;
}

.load-more-hint:active {
  opacity: 0.7;
}

/* ==================== 功能面板 ==================== */
.action-panel {
  max-height: 0;
  overflow: hidden;
  background: #f7f7f7;
  border-top: 1px solid #d6d6d6;
  transition: max-height 0.3s ease;
  position: relative;
  z-index: 10;
}

.action-panel.show {
  max-height: 180px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 20px 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.action-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s;
}

.action-item:hover .action-icon {
  background: #f0f0f0;
}

.action-item:active .action-icon {
  transform: scale(0.95);
}

.action-icon.transfer-icon {
  background: linear-gradient(135deg, #f9d5a0 0%, #f5c78e 100%);
  font-size: 28px;
}

.action-label {
  font-size: 12px;
  color: #666;
}

/* ==================== 转账弹窗 ==================== */
.transfer-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.transfer-modal {
  width: 90%;
  max-width: 320px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.transfer-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.transfer-modal-header .title {
  font-size: 17px;
  font-weight: 500;
  color: #333;
}

.transfer-modal-header .close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.transfer-modal-header .close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.transfer-modal-body {
  padding: 24px 20px;
}

.transfer-to {
  text-align: center;
  margin-bottom: 24px;
}

.to-label {
  font-size: 14px;
  color: #999;
  margin-right: 8px;
}

.to-name {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.amount-input-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  border-bottom: 1px solid #eee;
}

.currency-symbol {
  font-size: 32px;
  color: #333;
  font-weight: 500;
  margin-right: 4px;
}

.transfer-amount-input {
  border: none;
  outline: none;
  font-size: 48px;
  font-weight: 600;
  color: #333;
  text-align: center;
  background: transparent;
  width: 180px;
}

.transfer-amount-input::placeholder {
  color: #ccc;
}

/* 隐藏 number input 的箭头 */
.transfer-amount-input::-webkit-outer-spin-button,
.transfer-amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.transfer-amount-input[type=number] {
  -moz-appearance: textfield;
}

.transfer-hint {
  text-align: center;
  padding: 16px 0;
  font-size: 13px;
  color: #999;
}

.transfer-modal-footer {
  padding: 16px 20px 24px;
}

.send-transfer-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #f9d5a0 0%, #f5c78e 100%);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.send-transfer-btn:hover {
  filter: brightness(1.05);
}

.send-transfer-btn:active {
  transform: scale(0.98);
}

/* ==================== 余额不足弹窗 ==================== */
.insufficient-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.insufficient-modal {
  width: 85%;
  max-width: 300px;
  background: #fff;
  border-radius: 16px;
  padding: 24px 20px;
  text-align: center;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.insufficient-icon {
  margin-bottom: 16px;
}

.wallet-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: linear-gradient(135deg, #ff9500 0%, #ff5e3a 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 8px 20px rgba(255, 94, 58, 0.3);
}

.insufficient-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
}

.insufficient-content {
  background: #f8f8f8;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.balance-row:last-child {
  border-bottom: none;
}

.balance-row .label {
  font-size: 14px;
  color: #666;
}

.balance-row .value {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.balance-row.required .value {
  color: #ff5e3a;
}

.balance-row.diff .value.highlight {
  color: #ff3b30;
  font-size: 18px;
  font-weight: 600;
}

.insufficient-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.insufficient-btn:active {
  transform: scale(0.98);
  filter: brightness(0.95);
}
</style>
