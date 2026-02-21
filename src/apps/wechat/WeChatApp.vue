<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { MessageCircle, Users, Compass, User } from 'lucide-vue-next'
import { getMyCharacters, getPlazaCharacters, getCharacterForChat, getGroups, createGroup, getPersonas } from '../../services/api.js'
import { useChatStore } from '../../stores/chatStore.js'

import ChatWindow from './ChatWindow.vue'
import ProfileDetail from './ProfileDetail.vue'
import SpyView from './SpyView.vue'
import MomentsView from './MomentsView.vue'
import MomentsFeed from './MomentsFeed.vue'
import PersonaManager from './PersonaManager.vue'
import GroupChatWindow from './GroupChatWindow.vue'
import GroupInfo from './GroupInfo.vue'
import MemberSelector from './MemberSelector.vue'
import RedPacketDetail from './RedPacketDetail.vue'

const route = useRoute()
const chatStore = useChatStore()

// 当前视图状态
const currentView = ref('chats') // chats, contacts, discover, me, chat, profile, spy, moments, momentsFeed, personas, groupChat, groupInfo, memberSelector, redPacketDetail
const currentTab = ref('chats')

// 角色相关
const characters = ref([]) // 我的角色
const chattedPlazaCharacters = ref([]) // 聊过天的广场角色
const selectedCharId = ref(null)
const selectedSessionId = ref('player')
const isReadOnly = ref(false)
const sessionMeta = ref(null) // 会话元数据（用于spy模式显示对方名称）

// 群聊相关
const groups = ref([])
const selectedGroupId = ref(null)
const selectedRedPacketId = ref(null)
const pendingGroupCharId = ref(null) // 待创建群聊的角色ID
const isGroupSpyMode = ref(false) // 群聊偷看模式
const spyGroupCharId = ref('') // 偷看模式下的主角色ID
const isCreatingGroup = ref(false) // 防止重复创建群聊

// 用户人设
const currentPersona = ref(null)
const personas = ref([])

function buildPlayerSessionId(personaId) {
  return personaId ? `player__${personaId}` : 'player'
}

function normalizeSessionId(value) {
  if (Array.isArray(value)) return value[0] || 'player'
  return value || 'player'
}

const ACTIVE_CHAT_USER_KEY = 'wechat_active_chat_user_session'
function getInitialActiveUserSessionId() {
  const savedSessionId = localStorage.getItem(ACTIVE_CHAT_USER_KEY)
  if (savedSessionId) return savedSessionId
  const savedPersonaId = localStorage.getItem('current_persona_id')
  return buildPlayerSessionId(savedPersonaId)
}

const activeUserSessionId = ref(getInitialActiveUserSessionId())
const chatUserSwitchRef = ref(null)
const CHAT_ITEM_HIDE_KEY = 'wechat_hidden_chat_items'
const hiddenChatItems = ref({})
const chatItemMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  target: null
})
const suppressNextItemClick = ref(false)
let longPressTimer = null

function loadHiddenChatItems() {
  try {
    const saved = localStorage.getItem(CHAT_ITEM_HIDE_KEY)
    const parsed = saved ? JSON.parse(saved) : {}
    hiddenChatItems.value = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    hiddenChatItems.value = {}
  }
}

function saveHiddenChatItems() {
  localStorage.setItem(CHAT_ITEM_HIDE_KEY, JSON.stringify(hiddenChatItems.value))
}

function getHiddenSetBySession(sessionId = 'player') {
  return new Set(hiddenChatItems.value[sessionId] || [])
}

function isHiddenChatItem(sessionId, key) {
  return getHiddenSetBySession(sessionId).has(key)
}

function markHiddenChatItem(sessionId, key) {
  const next = { ...hiddenChatItems.value }
  const set = new Set(next[sessionId] || [])
  set.add(key)
  next[sessionId] = Array.from(set)
  hiddenChatItems.value = next
  saveHiddenChatItems()
}

function unmarkHiddenChatItem(sessionId, key) {
  const next = { ...hiddenChatItems.value }
  const set = new Set(next[sessionId] || [])
  if (!set.delete(key)) return
  if (set.size === 0) {
    delete next[sessionId]
  } else {
    next[sessionId] = Array.from(set)
  }
  hiddenChatItems.value = next
  saveHiddenChatItems()
}

// 合并的聊天列表（我的角色 + 聊过的广场角色 + 群聊）
const allChatCharacters = computed(() => {
  const myIds = new Set(characters.value.map(c => c.id))
  // 过滤掉已存在于我的角色中的广场角色
  const uniquePlazaChars = chattedPlazaCharacters.value.filter(c => !myIds.has(c.id))
  return [...characters.value, ...uniquePlazaChars]
})

const chatUsers = computed(() => {
  const list = [{ id: null, name: '默认', sessionId: buildPlayerSessionId(null) }]
  personas.value.forEach(persona => {
    list.push({
      id: persona.id,
      name: persona.name || '未命名用户',
      sessionId: buildPlayerSessionId(persona.id)
    })
  })
  return list
})

const allChatItems = computed(() => {
  const items = []
  for (const char of allChatCharacters.value) {
    for (const user of chatUsers.value) {
      if (char.isPlazaChar && !(char.sessionIds || []).includes(user.sessionId)) {
        continue
      }
      items.push({
        key: `${char.id}:${user.sessionId}`,
        char,
        user,
        sessionId: user.sessionId
      })
    }
  }
  return items
})

const filteredChatItems = computed(() => {
  return allChatItems.value.filter(item => {
    if (item.sessionId !== activeUserSessionId.value) return false
    if (isHiddenChatItem(item.sessionId, `char:${item.char.id}`)) return false
    if (item.char.isPlazaChar && (item.char.sessionIds || []).includes(item.sessionId)) {
      return true
    }
    const messages = chatStore.getMessages(item.char.id, item.sessionId)
    return messages.length > 0
  })
})

function getPersonaIdBySessionId(sessionId = 'player') {
  if (!sessionId || sessionId === 'player') return null
  if (sessionId.startsWith('player__')) return sessionId.slice('player__'.length) || null
  return null
}

const filteredGroups = computed(() => {
  const personaId = getPersonaIdBySessionId(activeUserSessionId.value)
  return groups.value.filter(group => {
    if (isHiddenChatItem(activeUserSessionId.value, `group:${group.id}`)) return false
    if (!group?.persona_id) return !personaId
    return group.persona_id === personaId
  })
})
const showHiddenGroupRestore = ref(false)

const hiddenGroupsForActiveUser = computed(() => {
  const hiddenSet = getHiddenSetBySession(activeUserSessionId.value)
  const hiddenIds = new Set(
    Array.from(hiddenSet)
      .filter(key => key.startsWith('group:'))
      .map(key => key.slice('group:'.length))
      .filter(Boolean)
  )
  return groups.value.filter(group => hiddenIds.has(group.id))
})

// 底部 Tab 配置
const tabs = [
  { id: 'chats', name: '微信', icon: MessageCircle },
  { id: 'contacts', name: '通讯录', icon: Users },
  { id: 'discover', name: '发现', icon: Compass },
  { id: 'me', name: '我', icon: User }
]

const showTabs = computed(() => {
  return ['chats', 'contacts', 'discover', 'me'].includes(currentView.value)
})

// 总未读数（用于底部 Tab 显示）
const totalUnread = computed(() => chatStore.getTotalUnread())

onMounted(async () => {
  loadHiddenChatItems()
  await loadCharacters()
  await loadGroups()
  await loadPersonas()

  // 如果 URL 带有 charId，直接进入聊天
  if (route.query.charId) {
    const routeSessionId = normalizeSessionId(route.query.sessionId)
    selectedCharId.value = route.query.charId
    selectedSessionId.value = routeSessionId
    isReadOnly.value = false
    currentView.value = 'chat'
    setActiveChatUser(routeSessionId)

    // 如果是广场角色，获取其信息并添加到聊天列表
    await ensurePlazaCharacterInList(route.query.charId, routeSessionId)
  }
})

watch(() => [route.query.charId, route.query.sessionId], async ([newCharId, newSessionId]) => {
  if (newCharId) {
    const routeSessionId = normalizeSessionId(newSessionId)
    selectedCharId.value = newCharId
    selectedSessionId.value = routeSessionId
    isReadOnly.value = false
    currentView.value = 'chat'
    setActiveChatUser(routeSessionId)

    // 如果是广场角色，获取其信息并添加到聊天列表
    await ensurePlazaCharacterInList(newCharId, routeSessionId)
  }
})

onUnmounted(() => {
  clearLongPressTimer()
  document.removeEventListener('click', handleGlobalPointerDown)
  document.removeEventListener('touchstart', handleGlobalPointerDown)
})

// 确保广场角色在聊天列表中
async function ensurePlazaCharacterInList(charId, sessionId = 'player') {
  // 检查是否已在我的角色列表中
  const isMyChar = characters.value.some(c => c.id === charId)
  if (isMyChar) return

  // 检查是否已在广场角色列表中
  const existingChar = chattedPlazaCharacters.value.find(c => c.id === charId)
  if (existingChar) {
    if (!existingChar.sessionIds) existingChar.sessionIds = []
    if (!existingChar.sessionIds.includes(sessionId)) {
      existingChar.sessionIds.push(sessionId)
      saveChattedPlazaCharacters()
      preloadChatSessions()
    }
    return
  }

  // 从广场获取角色信息
  try {
    const charData = await getCharacterForChat(charId)
    if (charData) {
      chattedPlazaCharacters.value.push({
        id: charData.id,
        name: charData.name,
        avatar: charData.avatar,
        isPlazaChar: true,
        sessionIds: [sessionId]
      })
      // 保存到 localStorage
      saveChattedPlazaCharacters()
      // 预加载聊天记录
      preloadChatSessions()
    }
  } catch (e) {
    console.error('获取广场角色失败:', e)
  }
}

async function loadCharacters() {
  try {
    characters.value = await getMyCharacters()
    // 加载之前聊过的广场角色
    await loadChattedPlazaCharacters()
    preloadChatSessions()
  } catch (e) {
    console.error('加载角色列表失败:', e)
  }
}

// 加载群列表
async function loadGroups() {
  try {
    groups.value = await getGroups()
  } catch (e) {
    console.error('加载群列表失败:', e)
  }
}

// 加载人设列表
async function loadPersonas() {
  try {
    personas.value = await getPersonas()
    // 加载上次选择的人设
    const savedPersonaId = localStorage.getItem('current_persona_id')
    if (savedPersonaId) {
      currentPersona.value = personas.value.find(p => p.id === savedPersonaId) || null
    }
    preloadChatSessions()
  } catch (e) {
    console.error('加载人设列表失败:', e)
  }
}

// 加载之前聊过的广场角色（从 localStorage）
async function loadChattedPlazaCharacters() {
  try {
    const saved = localStorage.getItem('chatted_plaza_chars')
    if (saved) {
      const parsed = JSON.parse(saved)
      const charEntries = Array.isArray(parsed)
        ? parsed.map(item => {
            if (typeof item === 'string') return { id: item, sessionIds: ['player'] }
            return {
              id: item.id,
              sessionIds: Array.isArray(item.sessionIds) && item.sessionIds.length > 0 ? item.sessionIds : ['player']
            }
          }).filter(item => item.id)
        : []
      const myIds = new Set(characters.value.map(c => c.id))

      for (const entry of charEntries) {
        const charId = entry.id
        // 跳过已是我的角色的
        if (myIds.has(charId)) continue

        try {
          const charData = await getCharacterForChat(charId)
          if (charData) {
            chattedPlazaCharacters.value.push({
              id: charData.id,
              name: charData.name,
              avatar: charData.avatar,
              isPlazaChar: true,
              sessionIds: entry.sessionIds
            })
            // 预加载聊天记录
            preloadChatSessions()
          }
        } catch (e) {
          // 角色可能已被删除，从列表中移除
          console.warn(`广场角色 ${charId} 加载失败`)
        }
      }
    }
  } catch (e) {
    console.error('加载广场角色失败:', e)
  }
}

// 保存聊过的广场角色 ID 列表
function saveChattedPlazaCharacters() {
  const entries = chattedPlazaCharacters.value.map(c => ({
    id: c.id,
    sessionIds: Array.isArray(c.sessionIds) && c.sessionIds.length > 0 ? c.sessionIds : ['player']
  }))
  localStorage.setItem('chatted_plaza_chars', JSON.stringify(entries))
}

function preloadChatSessions() {
  if (allChatItems.value.length === 0) return
  for (const item of allChatItems.value) {
    chatStore.loadMessages(item.char.id, item.sessionId).catch(() => {})
  }
}

// 获取聊天预览（从 Store 缓存获取）
function getChatPreview(charId, sessionId = 'player') {
  const messages = chatStore.getMessages(charId, sessionId)
  if (messages.length === 0) {
    // 尝试从角色数据获取开场白
    const char = characters.value.find(c => c.id === charId)
    if (char?.greeting) {
      const text = char.greeting.split('###')[0].trim()
      return text.length > 20 ? text.slice(0, 20) + '...' : text
    }
    return ''
  }

  const lastMsg = messages[messages.length - 1]
  const prefix = lastMsg.sender === 'player' ? '我: ' : ''
  const text = lastMsg.text?.length > 20 ? lastMsg.text.slice(0, 20) + '...' : (lastMsg.text || '')
  return prefix + text
}

// 获取未读数
function getUnreadCount(charId, sessionId = 'player') {
  return chatStore.getUnreadCount(charId, sessionId)
}

// 检查是否正在输入
function isTyping(charId, sessionId = 'player') {
  return chatStore.isPending(charId, sessionId)
}

// 获取群显示名称（带动态人数后缀）
function getGroupDisplayName(group) {
  if (!group?.name) return ''
  // 移除可能已有的人数后缀
  const baseName = group.name.replace(/（\d+）$/, '').replace(/\(\d+\)$/, '').trim()
  // 计算总人数：过滤掉 player 后的 members + 1（用户自己）
  const nonPlayerMembers = (group.members || []).filter(m => m.id !== 'player' && m.type !== 'player')
  const totalCount = nonPlayerMembers.length + 1
  return `${baseName}（${totalCount}）`
}

function switchTab(tabId) {
  currentTab.value = tabId
  currentView.value = tabId
}

function setActiveChatUser(sessionId) {
  activeUserSessionId.value = sessionId
  localStorage.setItem(ACTIVE_CHAT_USER_KEY, sessionId)
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function closeChatItemMenu() {
  chatItemMenu.value.visible = false
  chatItemMenu.value.target = null
}

function handleGlobalPointerDown() {
  if (!chatItemMenu.value.visible) return
  closeChatItemMenu()
}

function openChatItemMenu(x, y, target) {
  const maxX = Math.max(8, window.innerWidth - 140)
  const maxY = Math.max(8, window.innerHeight - 56)
  chatItemMenu.value = {
    visible: true,
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
    target
  }
}

function onChatItemContextMenu(event, target) {
  event.preventDefault()
  suppressNextItemClick.value = true
  openChatItemMenu(event.clientX, event.clientY, target)
}

function onChatItemTouchStart(event, target) {
  clearLongPressTimer()
  const touch = event.touches?.[0]
  if (!touch) return
  longPressTimer = setTimeout(() => {
    suppressNextItemClick.value = true
    openChatItemMenu(touch.clientX, touch.clientY, target)
  }, 650)
}

function onChatItemTouchEnd() {
  clearLongPressTimer()
}

function onChatItemTouchMove() {
  clearLongPressTimer()
}

function maybeConsumeSuppressedClick() {
  if (!suppressNextItemClick.value) return false
  suppressNextItemClick.value = false
  return true
}

function scrollActiveUserChipIntoView() {
  nextTick(() => {
    const container = chatUserSwitchRef.value
    if (!container) return
    const activeChip = container.querySelector('.chat-user-chip.active')
    if (!activeChip) return
    activeChip.scrollIntoView({ inline: 'center', block: 'nearest' })
  })
}

// 打开聊天
function openChat(charId, sessionId = 'player', readOnly = false, meta = null) {
  unmarkHiddenChatItem(sessionId, `char:${charId}`)
  setActiveChatUser(sessionId)
  selectedCharId.value = charId
  selectedSessionId.value = sessionId
  isReadOnly.value = readOnly
  sessionMeta.value = meta
  currentView.value = 'chat'
}

watch(chatUsers, (users) => {
  if (!users.length) {
    setActiveChatUser('player')
    return
  }
  const isValid = users.some(user => user.sessionId === activeUserSessionId.value)
  if (!isValid) {
    setActiveChatUser(users[0].sessionId)
  }
}, { immediate: true })

watch(activeUserSessionId, () => {
  scrollActiveUserChipIntoView()
}, { immediate: true })

watch(() => chatStore.conversations, (allConversations) => {
  const toRestore = []
  for (const [sessionId, keys] of Object.entries(hiddenChatItems.value || {})) {
    if (!Array.isArray(keys)) continue
    for (const key of keys) {
      if (!key.startsWith('char:')) continue
      const charId = key.slice('char:'.length)
      if (!charId) continue
      const cacheKey = `${charId}:${sessionId}`
      const messages = allConversations[cacheKey] || []
      if (messages.length === 0) continue
      const lastMessage = messages[messages.length - 1]
      const sender = lastMessage?.sender === 'user' ? 'player' : lastMessage?.sender
      if (sender === 'player') {
        toRestore.push({ sessionId, key })
      }
    }
  }

  if (toRestore.length > 0) {
    toRestore.forEach(item => unmarkHiddenChatItem(item.sessionId, item.key))
  }
}, { deep: true })

watch(() => chatItemMenu.value.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleGlobalPointerDown)
    document.addEventListener('touchstart', handleGlobalPointerDown)
  } else {
    document.removeEventListener('click', handleGlobalPointerDown)
    document.removeEventListener('touchstart', handleGlobalPointerDown)
  }
})

function handleChatItemClick(chat) {
  if (maybeConsumeSuppressedClick()) return
  openChat(chat.char.id, chat.sessionId)
}

function handleGroupItemClick(group) {
  if (maybeConsumeSuppressedClick()) return
  openGroupChat(group.id)
}

function openHiddenGroupRestore() {
  showHiddenGroupRestore.value = true
}

function closeHiddenGroupRestore() {
  showHiddenGroupRestore.value = false
}

function restoreHiddenGroup(groupId) {
  unmarkHiddenChatItem(activeUserSessionId.value, `group:${groupId}`)
}

function removePlazaSession(charId, sessionId) {
  const index = chattedPlazaCharacters.value.findIndex(c => c.id === charId)
  if (index < 0) return
  const target = chattedPlazaCharacters.value[index]
  const sessionIds = Array.isArray(target.sessionIds) ? target.sessionIds : []
  target.sessionIds = sessionIds.filter(id => id !== sessionId)
  if (target.sessionIds.length === 0) {
    chattedPlazaCharacters.value.splice(index, 1)
  }
  saveChattedPlazaCharacters()
}

function deleteChatItemFromMenu() {
  const target = chatItemMenu.value.target
  if (!target) return

  if (target.type === 'group') {
    markHiddenChatItem(activeUserSessionId.value, `group:${target.group.id}`)
  } else if (target.type === 'char') {
    const chat = target.chat
    const char = chat.char
    if (char.isPlazaChar) {
      removePlazaSession(char.id, chat.sessionId)
    } else {
      markHiddenChatItem(chat.sessionId, `char:${char.id}`)
      chatStore.clearCache(char.id, chat.sessionId)
    }
  }

  closeChatItemMenu()
}

// 打开资料页
function openProfile(charId) {
  selectedCharId.value = charId
  currentView.value = 'profile'
}

// 打开偷看模式
function openSpy(charId) {
  selectedCharId.value = charId
  currentView.value = 'spy'
}

// 打开单个角色的朋友圈（个人相册）
function openMoments(charId) {
  selectedCharId.value = charId
  currentView.value = 'moments'
}

// 打开聚合朋友圈
function openMomentsFeed() {
  currentView.value = 'momentsFeed'
}

// 打开人设管理
function openPersonaManager() {
  currentView.value = 'personas'
}

// 打开群聊
function openGroupChat(groupId) {
  unmarkHiddenChatItem(activeUserSessionId.value, `group:${groupId}`)
  selectedGroupId.value = groupId
  isGroupSpyMode.value = false
  spyGroupCharId.value = ''
  currentView.value = 'groupChat'
}

// 打开偷看模式的群聊（只读）
function openSpyGroupChat(groupId, readOnly = true) {
  selectedGroupId.value = groupId
  isGroupSpyMode.value = readOnly
  // 获取当前偷看的角色ID
  spyGroupCharId.value = selectedCharId.value || ''
  currentView.value = 'groupChat'
}

// 打开群信息
function openGroupInfo(groupId) {
  selectedGroupId.value = groupId
  currentView.value = 'groupInfo'
}

// 打开成员选择器（创建群聊）
function openMemberSelector(charId) {
  pendingGroupCharId.value = charId
  currentView.value = 'memberSelector'
}

// 处理成员选择完成（创建群聊）
async function handleMembersSelected(selectedMembers) {
  // 防止重复创建
  if (isCreatingGroup.value) return

  if (!pendingGroupCharId.value || selectedMembers.length === 0) {
    currentView.value = 'contacts'
    return
  }

  isCreatingGroup.value = true
  try {
    // 获取主角色信息（先从自己的角色找，再从广场角色找，最后单独获取）
    let mainChar = characters.value.find(c => c.id === pendingGroupCharId.value)
    if (!mainChar) {
      mainChar = chattedPlazaCharacters.value.find(c => c.id === pendingGroupCharId.value)
    }
    if (!mainChar) {
      // 广场角色可能不在列表中，单独获取
      try {
        mainChar = await getCharacterForChat(pendingGroupCharId.value)
      } catch (e) {
        console.error('获取角色信息失败:', e)
      }
    }

    if (!mainChar) {
      alert('无法获取角色信息')
      currentView.value = 'contacts'
      return
    }

    // 构建成员列表（主角色 + 选中的NPC，不包含玩家，玩家是隐含的）
    const members = [
      {
        id: mainChar.id,
        name: mainChar.name,
        avatar: mainChar.avatar,
        type: 'main',
        persona: mainChar.persona
      },
      ...selectedMembers.map(m => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        type: m.type // 'preset' or 'custom'
      }))
    ]

    // 创建群名：角色名的群聊（不含人数后缀，显示时动态计算）
    const groupName = `${mainChar.name}的群聊`

    // 创建群
    const group = await createGroup({
      name: groupName,
      members,
      owner_char_id: mainChar.id,
      persona_id: getPersonaIdBySessionId(activeUserSessionId.value)
    })

    groups.value.unshift(group)

    // 进入群聊
    selectedGroupId.value = group.id
    currentView.value = 'groupChat'
  } catch (e) {
    console.error('创建群聊失败:', e)
    alert('创建群聊失败: ' + e.message)
    currentView.value = 'contacts'
  } finally {
    isCreatingGroup.value = false
  }
}

// 打开红包详情
function openRedPacketDetail(groupId, packetId) {
  selectedGroupId.value = groupId
  selectedRedPacketId.value = packetId
  currentView.value = 'redPacketDetail'
}

// 返回
async function goBack() {
  if (currentView.value === 'chat') {
    if (isReadOnly.value) {
      currentView.value = 'spy'
    } else {
      currentView.value = 'chats'
      // 不再需要刷新预览，Store 缓存会自动更新
    }
  } else if (currentView.value === 'profile') {
    currentView.value = 'contacts'
  } else if (currentView.value === 'spy') {
    currentView.value = 'profile'
  } else if (currentView.value === 'moments') {
    currentView.value = 'profile'
  } else if (currentView.value === 'momentsFeed') {
    currentView.value = 'discover'
  } else if (currentView.value === 'personas') {
    currentView.value = 'me'
  } else if (currentView.value === 'groupChat') {
    currentView.value = 'chats'
    await loadGroups()
  } else if (currentView.value === 'groupInfo') {
    currentView.value = 'groupChat'
  } else if (currentView.value === 'memberSelector') {
    currentView.value = 'contacts'
  } else if (currentView.value === 'redPacketDetail') {
    currentView.value = 'groupChat'
  } else {
    currentView.value = currentTab.value
  }
}

// 群被删除后的处理
function handleGroupDeleted() {
  loadGroups()
  currentView.value = 'chats'
}

// 群信息更新后的处理（如移除成员、修改群名等）
function handleGroupUpdated(updatedGroup) {
  // 更新本地 groups 数组中的对应群数据
  const index = groups.value.findIndex(g => g.id === updatedGroup.id)
  if (index >= 0) {
    groups.value[index] = updatedGroup
  }
}

// 添加成员到现有群（从群信息页触发）
function handleAddMemberToGroup(groupId) {
  // 找到群的主角色
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    pendingGroupCharId.value = group.owner_char_id
    selectedGroupId.value = groupId
    currentView.value = 'addMemberToGroup'
  }
}

// 处理添加成员到现有群
async function handleAddMembersToExistingGroup(selectedMembers) {
  if (!selectedGroupId.value || selectedMembers.length === 0) {
    currentView.value = 'groupInfo'
    return
  }

  try {
    const group = groups.value.find(g => g.id === selectedGroupId.value)
    if (!group) {
      currentView.value = 'groupInfo'
      return
    }

    // 合并成员
    const newMembers = [
      ...group.members,
      ...selectedMembers.map(m => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        type: m.type
      }))
    ]

    // 更新群
    const { updateGroup } = await import('../../services/api.js')
    await updateGroup(selectedGroupId.value, { members: newMembers })

    // 刷新群列表
    await loadGroups()

    // 返回群信息页
    currentView.value = 'groupInfo'
  } catch (e) {
    console.error('添加成员失败:', e)
    alert('添加成员失败: ' + e.message)
    currentView.value = 'groupInfo'
  }
}

// 默认头像
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#07c160" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)
</script>

<template>
  <div class="wechat-app">
    <!-- 聊天窗口 -->
    <ChatWindow
      v-if="currentView === 'chat'"
      :charId="selectedCharId"
      :sessionId="selectedSessionId"
      :readOnly="isReadOnly"
      :viewMode="isReadOnly ? 'spy' : 'player'"
      :sessionMeta="sessionMeta"
      @back="goBack"
      @openProfile="openProfile(selectedCharId)"
    />

    <!-- 资料页 -->
    <ProfileDetail
      v-else-if="currentView === 'profile'"
      :charId="selectedCharId"
      @back="goBack"
      @openChat="openChat"
      @openMoments="openMoments"
      @openSpy="openSpy"
      @createGroupChat="openMemberSelector"
    />

    <!-- 偷看模式 -->
    <SpyView
      v-else-if="currentView === 'spy'"
      :charId="selectedCharId"
      @back="goBack"
      @openChat="openChat"
      @openGroupChat="openSpyGroupChat"
    />

    <!-- 单个角色的朋友圈（个人相册） -->
    <MomentsView
      v-else-if="currentView === 'moments'"
      :charId="selectedCharId"
      @back="goBack"
    />

    <!-- 聚合朋友圈 -->
    <MomentsFeed
      v-else-if="currentView === 'momentsFeed'"
      @back="goBack"
      @openProfile="openProfile"
    />

    <!-- 人设管理 -->
    <PersonaManager
      v-else-if="currentView === 'personas'"
      @back="goBack"
    />

    <!-- 群聊窗口 -->
    <GroupChatWindow
      v-else-if="currentView === 'groupChat'"
      :groupId="selectedGroupId"
      :readOnly="isGroupSpyMode"
      :viewMode="isGroupSpyMode ? 'spy' : 'player'"
      :spyCharId="spyGroupCharId"
      @back="goBack"
      @openGroupInfo="openGroupInfo"
      @openRedPacketDetail="openRedPacketDetail"
    />

    <!-- 群信息 -->
    <GroupInfo
      v-else-if="currentView === 'groupInfo'"
      :groupId="selectedGroupId"
      @back="goBack"
      @deleted="handleGroupDeleted"
      @addMember="handleAddMemberToGroup"
      @updated="handleGroupUpdated"
    />

    <!-- 成员选择器（创建新群聊） -->
    <MemberSelector
      v-else-if="currentView === 'memberSelector'"
      :existingMemberIds="[]"
      :ownerCharId="pendingGroupCharId"
      @close="goBack"
      @select="handleMembersSelected"
    />

    <!-- 成员选择器（添加成员到现有群） -->
    <MemberSelector
      v-else-if="currentView === 'addMemberToGroup'"
      :existingMemberIds="groups.find(g => g.id === selectedGroupId)?.members?.map(m => m.id) || []"
      :ownerCharId="pendingGroupCharId"
      @close="() => currentView = 'groupInfo'"
      @select="handleAddMembersToExistingGroup"
    />

    <!-- 红包详情 -->
    <RedPacketDetail
      v-else-if="currentView === 'redPacketDetail'"
      :groupId="selectedGroupId"
      :packetId="selectedRedPacketId"
      @back="goBack"
    />

    <!-- 主界面 -->
    <template v-else>
      <div class="main-content">
        <!-- 微信 Tab - 最近聊天 -->
        <div v-if="currentTab === 'chats'" class="tab-content">
          <div class="page-header page-header-chats">
            <span>微信</span>
          </div>

          <div class="chat-user-switch-wrap">
            <div ref="chatUserSwitchRef" class="chat-user-switch">
              <button
                v-for="user in chatUsers"
                :key="user.sessionId"
                type="button"
                class="chat-user-chip"
                :class="{ active: user.sessionId === activeUserSessionId }"
                @click="setActiveChatUser(user.sessionId)"
              >
                {{ user.name }}
              </button>
            </div>
            <button
              v-if="hiddenGroupsForActiveUser.length > 0"
              type="button"
              class="restore-groups-btn"
              @click="openHiddenGroupRestore"
            >
              恢复已删除群聊 ({{ hiddenGroupsForActiveUser.length }})
            </button>
          </div>

          <div class="chat-list">
            <div v-if="filteredChatItems.length === 0 && filteredGroups.length === 0" class="empty-tip">
              暂无聊天，去通讯录添加角色吧
            </div>

            <!-- 群聊列表 -->
            <div
              v-for="group in filteredGroups"
              :key="group.id"
              class="chat-item"
              @click="handleGroupItemClick(group)"
              @contextmenu.prevent="onChatItemContextMenu($event, { type: 'group', group })"
              @touchstart="onChatItemTouchStart($event, { type: 'group', group })"
              @touchmove="onChatItemTouchMove"
              @touchend="onChatItemTouchEnd"
              @touchcancel="onChatItemTouchEnd"
            >
              <div class="chat-avatar group-avatar">
                <Users :size="24" />
              </div>
              <div class="chat-info">
                <div class="chat-name">{{ getGroupDisplayName(group) }}</div>
                <div class="chat-preview">[群聊]</div>
              </div>
            </div>

            <!-- 角色聊天列表 -->
            <div
              v-for="chat in filteredChatItems"
              :key="chat.key"
              class="chat-item"
              @click="handleChatItemClick(chat)"
              @contextmenu.prevent="onChatItemContextMenu($event, { type: 'char', chat })"
              @touchstart="onChatItemTouchStart($event, { type: 'char', chat })"
              @touchmove="onChatItemTouchMove"
              @touchend="onChatItemTouchEnd"
              @touchcancel="onChatItemTouchEnd"
            >
              <div class="chat-avatar">
                <img v-if="chat.char.avatar" :src="chat.char.avatar" />
                <span v-else>{{ chat.char.name?.[0] || '?' }}</span>
                <!-- 未读红点 -->
                <div v-if="getUnreadCount(chat.char.id, chat.sessionId) > 0" class="unread-badge">
                  {{ getUnreadCount(chat.char.id, chat.sessionId) > 99 ? '99+' : getUnreadCount(chat.char.id, chat.sessionId) }}
                </div>
              </div>
              <div class="chat-info">
                <div class="chat-name">{{ chat.char.name }}</div>
                <div class="chat-preview" :class="{ typing: isTyping(chat.char.id, chat.sessionId) }">
                  <template v-if="isTyping(chat.char.id, chat.sessionId)">
                    <span class="typing-indicator">对方正在输入...</span>
                  </template>
                  <template v-else>
                    {{ getChatPreview(chat.char.id, chat.sessionId) }}
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 通讯录 Tab -->
        <div v-if="currentTab === 'contacts'" class="tab-content">
          <div class="page-header">
            <span>通讯录</span>
          </div>

          <div class="contact-list">
            <div v-if="allChatCharacters.length === 0" class="empty-tip">
              暂无联系人
            </div>

            <div
              v-for="char in allChatCharacters"
              :key="char.id"
              class="contact-item"
              @click="openProfile(char.id)"
            >
              <div class="contact-avatar">
                <img v-if="char.avatar" :src="char.avatar" />
                <span v-else>{{ char.name?.[0] || '?' }}</span>
              </div>
              <div class="contact-name">{{ char.name }}</div>
            </div>
          </div>
        </div>

        <!-- 发现 Tab -->
        <div v-if="currentTab === 'discover'" class="tab-content">
          <div class="page-header">
            <span>发现</span>
          </div>

          <div class="discover-menu">
            <div class="discover-item" @click="openMomentsFeed">
              <div class="discover-icon moments-icon">
                <Compass :size="24" />
              </div>
              <span class="discover-label">朋友圈</span>
              <div class="discover-arrow">›</div>
            </div>
          </div>
        </div>

        <!-- 我 Tab -->
        <div v-if="currentTab === 'me'" class="tab-content">
          <div class="page-header">
            <span>我</span>
          </div>

          <div class="me-section">
            <div class="me-profile">
              <div class="me-avatar">
                <span>我</span>
              </div>
              <div class="me-info">
                <div class="me-name">玩家</div>
                <div class="me-id">微信号: player_001</div>
              </div>
            </div>

            <div class="me-menu">
              <div class="menu-item" @click="openPersonaManager">
                <span>我的人设</span>
                <div class="menu-arrow">›</div>
              </div>
              <div class="menu-item">
                <span>设置</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部 Tab 栏 -->
      <div class="tab-bar" v-if="showTabs">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: currentTab === tab.id }"
          @click="switchTab(tab.id)"
        >
          <div class="tab-icon-wrapper">
            <component :is="tab.icon" :size="24" />
            <!-- 微信 Tab 显示总未读数 -->
            <div v-if="tab.id === 'chats' && totalUnread > 0" class="tab-unread-badge">
              {{ totalUnread > 99 ? '99+' : totalUnread }}
            </div>
          </div>
          <span>{{ tab.name }}</span>
        </div>
      </div>

      <div
        v-if="showHiddenGroupRestore"
        class="modal-overlay"
        @click.self="closeHiddenGroupRestore"
      >
        <div class="restore-modal">
          <div class="restore-modal-title">恢复已删除群聊</div>
          <div class="restore-list">
            <div
              v-for="group in hiddenGroupsForActiveUser"
              :key="group.id"
              class="restore-item"
            >
              <span class="restore-name">{{ getGroupDisplayName(group) }}</span>
              <button type="button" class="restore-btn" @click="restoreHiddenGroup(group.id)">
                恢复
              </button>
            </div>
            <div v-if="hiddenGroupsForActiveUser.length === 0" class="restore-empty">
              当前用户没有已删除群聊
            </div>
          </div>
          <button type="button" class="restore-close-btn" @click="closeHiddenGroupRestore">
            关闭
          </button>
        </div>
      </div>

      <div
        v-if="chatItemMenu.visible"
        class="chat-item-menu"
        :style="{ left: `${chatItemMenu.x}px`, top: `${chatItemMenu.y}px` }"
        @click.stop
      >
        <button type="button" class="chat-item-menu-btn danger" @click="deleteChatItemFromMenu">
          删除会话
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wechat-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ededed;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.main-content::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

.tab-content {
  min-height: 100%;
}

.page-header {
  padding: 12px 16px;
  background: #ededed;
  border-bottom: 1px solid #d9d9d9;
  font-size: 17px;
  font-weight: 500;
  color: #000;
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-header-chats {
  margin-bottom: 8px;
}

.chat-user-switch-wrap {
  position: relative;
  background: #ededed;
}

.chat-user-switch-wrap::before,
.chat-user-switch-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 8px;
  width: 14px;
  pointer-events: none;
  z-index: 1;
}

.chat-user-switch-wrap::before {
  left: 0;
  background: linear-gradient(to right, #ededed, rgba(237, 237, 237, 0));
}

.chat-user-switch-wrap::after {
  right: 0;
  background: linear-gradient(to left, #ededed, rgba(237, 237, 237, 0));
}

.restore-groups-btn {
  margin: 0 16px 8px;
  border: 1px solid #d9d9d9;
  background: #fff;
  color: #666;
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 12px;
}

.chat-user-switch {
  display: flex;
  gap: 8px;
  padding: 0 16px 8px;
  overflow-x: auto;
  background: #ededed;
  scrollbar-width: none;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}

.chat-user-switch::-webkit-scrollbar {
  display: none;
}

.chat-user-chip {
  flex-shrink: 0;
  border: 1px solid #d9d9d9;
  background: #fff;
  color: #666;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}

.chat-user-chip.active {
  border-color: #07c160;
  color: #07c160;
  background: #edf9f2;
}

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

/* 聊天列表 */
.chat-list {
  background: #fff;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.chat-item:active {
  background: #f5f5f5;
}

.chat-item-menu {
  position: fixed;
  z-index: 3000;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  border: 1px solid #ececec;
  min-width: 120px;
  overflow: hidden;
}

.chat-item-menu-btn {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 12px 14px;
  font-size: 14px;
  color: #333;
}

.chat-item-menu-btn.danger {
  color: #e53935;
}

.chat-avatar {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  flex-shrink: 0;
  position: relative;
}

.chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.chat-avatar span {
  font-size: 20px;
  color: #fff;
}

/* 群聊头像 */
.chat-avatar.group-avatar {
  background: #07c160;
  color: #fff;
}

/* 未读红点徽标 */
.unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(42%, -42%);
  min-width: 18px;
  height: 18px;
  background: #f44336;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-sizing: border-box;
  border: 2px solid #fff;
  z-index: 2;
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-name {
  font-size: 16px;
  color: #000;
  margin-bottom: 4px;
}

.chat-preview {
  font-size: 13px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-preview.typing {
  color: #07c160;
}

.typing-indicator {
  animation: typing-blink 1s infinite;
}

@keyframes typing-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 通讯录 */
.contact-list {
  background: #fff;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.contact-item:active {
  background: #f5f5f5;
}

.contact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.contact-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.contact-avatar span {
  font-size: 16px;
  color: #fff;
}

.contact-name {
  font-size: 16px;
  color: #000;
  flex: 1;
}

/* 发现 */
.discover-menu {
  background: #fff;
  margin-top: 12px;
}

.discover-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.discover-item:active {
  background: #f5f5f5;
}

.discover-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.moments-icon {
  background: #576b95;
}

.discover-label {
  flex: 1;
  font-size: 16px;
  color: #000;
}

.discover-arrow {
  color: #c0c0c0;
  font-size: 20px;
}

/* 我 */
.me-section {
  padding-top: 12px;
}

.me-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 16px;
  background: #fff;
  margin-bottom: 12px;
}

.me-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: #576b95;
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-avatar span {
  font-size: 28px;
  color: #fff;
}

.me-info {
  flex: 1;
}

.me-name {
  font-size: 18px;
  font-weight: 500;
  color: #000;
  margin-bottom: 4px;
}

.me-id {
  font-size: 14px;
  color: #999;
}

.me-menu {
  background: #fff;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 16px;
  color: #000;
  cursor: pointer;
}

.menu-item:active {
  background: #f5f5f5;
}

.menu-arrow {
  color: #c0c0c0;
  font-size: 20px;
}

/* 底部 Tab 栏 */
.tab-bar {
  display: flex;
  background: #f7f7f7;
  border-top: 1px solid #d9d9d9;
  padding: 4px 0 8px;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px;
  cursor: pointer;
  color: #999;
  font-size: 10px;
}

.tab-item.active {
  color: #07c160;
}

.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Tab 未读徽标 */
.tab-unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(58%, -45%);
  min-width: 16px;
  height: 16px;
  background: #f44336;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-sizing: border-box;
  border: 2px solid #f7f7f7;
  z-index: 2;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2900;
  padding: 16px;
}

.restore-modal {
  width: min(360px, 100%);
  max-height: 70vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.restore-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #222;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.restore-list {
  flex: 1;
  overflow-y: auto;
}

.restore-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f7f7f7;
}

.restore-name {
  font-size: 14px;
  color: #333;
}

.restore-btn {
  border: 1px solid #07c160;
  color: #07c160;
  background: #fff;
  border-radius: 12px;
  font-size: 12px;
  padding: 3px 10px;
}

.restore-empty {
  padding: 20px 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.restore-close-btn {
  border: none;
  background: #f7f7f7;
  color: #666;
  font-size: 14px;
  padding: 12px 0;
}
</style>
