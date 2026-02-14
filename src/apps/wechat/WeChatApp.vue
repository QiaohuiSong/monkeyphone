<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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

// 合并的聊天列表（我的角色 + 聊过的广场角色 + 群聊）
const allChatCharacters = computed(() => {
  const myIds = new Set(characters.value.map(c => c.id))
  // 过滤掉已存在于我的角色中的广场角色
  const uniquePlazaChars = chattedPlazaCharacters.value.filter(c => !myIds.has(c.id))
  return [...characters.value, ...uniquePlazaChars]
})

// 底部 Tab 配置
const tabs = [
  { id: 'chats', name: '微信', icon: MessageCircle },
  { id: 'contacts', name: '通讯录', icon: Users },
  { id: 'discover', name: '发现', icon: Compass },
  { id: 'me', name: '我', icon: User }
]

// 是否显示底部 Tab
const showTabs = computed(() => {
  return ['chats', 'contacts', 'discover', 'me'].includes(currentView.value)
})

// 总未读数（用于底部 Tab 显示）
const totalUnread = computed(() => chatStore.getTotalUnread())

onMounted(async () => {
  await loadCharacters()
  await loadGroups()
  await loadPersonas()

  // 如果 URL 带有 charId，直接进入聊天
  if (route.query.charId) {
    selectedCharId.value = route.query.charId
    selectedSessionId.value = 'player'
    isReadOnly.value = false
    currentView.value = 'chat'

    // 如果是广场角色，获取其信息并添加到聊天列表
    await ensurePlazaCharacterInList(route.query.charId)
  }
})

watch(() => route.query.charId, async (newCharId) => {
  if (newCharId) {
    selectedCharId.value = newCharId
    selectedSessionId.value = 'player'
    isReadOnly.value = false
    currentView.value = 'chat'

    // 如果是广场角色，获取其信息并添加到聊天列表
    await ensurePlazaCharacterInList(newCharId)
  }
})

// 确保广场角色在聊天列表中
async function ensurePlazaCharacterInList(charId) {
  // 检查是否已在我的角色列表中
  const isMyChar = characters.value.some(c => c.id === charId)
  if (isMyChar) return

  // 检查是否已在广场角色列表中
  const isInPlaza = chattedPlazaCharacters.value.some(c => c.id === charId)
  if (isInPlaza) return

  // 从广场获取角色信息
  try {
    const charData = await getCharacterForChat(charId)
    if (charData) {
      chattedPlazaCharacters.value.push({
        id: charData.id,
        name: charData.name,
        avatar: charData.avatar,
        isPlazaChar: true
      })
      // 保存到 localStorage
      saveChattedPlazaCharacters()
      // 预加载聊天记录
      chatStore.loadMessages(charId, 'player').catch(() => {})
    }
  } catch (e) {
    console.error('获取广场角色失败:', e)
  }
}

async function loadCharacters() {
  try {
    characters.value = await getMyCharacters()
    // 预加载每个角色的聊天记录到 Store
    for (const char of characters.value) {
      chatStore.loadMessages(char.id, 'player').catch(() => {})
    }

    // 加载之前聊过的广场角色
    await loadChattedPlazaCharacters()
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
  } catch (e) {
    console.error('加载人设列表失败:', e)
  }
}

// 加载之前聊过的广场角色（从 localStorage）
async function loadChattedPlazaCharacters() {
  try {
    const saved = localStorage.getItem('chatted_plaza_chars')
    if (saved) {
      const charIds = JSON.parse(saved)
      const myIds = new Set(characters.value.map(c => c.id))

      for (const charId of charIds) {
        // 跳过已是我的角色的
        if (myIds.has(charId)) continue

        try {
          const charData = await getCharacterForChat(charId)
          if (charData) {
            chattedPlazaCharacters.value.push({
              id: charData.id,
              name: charData.name,
              avatar: charData.avatar,
              isPlazaChar: true
            })
            // 预加载聊天记录
            chatStore.loadMessages(charId, 'player').catch(() => {})
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
  const ids = chattedPlazaCharacters.value.map(c => c.id)
  localStorage.setItem('chatted_plaza_chars', JSON.stringify(ids))
}

// 获取聊天预览（从 Store 缓存获取）
function getChatPreview(charId) {
  const messages = chatStore.getMessages(charId)
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
function getUnreadCount(charId) {
  return chatStore.getUnreadCount(charId)
}

// 检查是否正在输入
function isTyping(charId) {
  return chatStore.isPending(charId)
}

function switchTab(tabId) {
  currentTab.value = tabId
  currentView.value = tabId
}

// 打开聊天
function openChat(charId, sessionId = 'player', readOnly = false, meta = null) {
  selectedCharId.value = charId
  selectedSessionId.value = sessionId
  isReadOnly.value = readOnly
  sessionMeta.value = meta
  currentView.value = 'chat'
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

    // 构建成员列表
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

    // 创建群名：角色名的群聊（人数）
    const groupName = `${mainChar.name}的群聊（${members.length}）`

    // 创建群
    const group = await createGroup({
      name: groupName,
      members,
      owner_char_id: mainChar.id,
      persona_id: currentPersona.value?.id || null
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
          <div class="page-header">
            <span>微信</span>
          </div>

          <div class="chat-list">
            <div v-if="allChatCharacters.length === 0 && groups.length === 0" class="empty-tip">
              暂无聊天，去通讯录添加角色吧
            </div>

            <!-- 群聊列表 -->
            <div
              v-for="group in groups"
              :key="group.id"
              class="chat-item"
              @click="openGroupChat(group.id)"
            >
              <div class="chat-avatar group-avatar">
                <Users :size="24" />
              </div>
              <div class="chat-info">
                <div class="chat-name">{{ group.name }}</div>
                <div class="chat-preview">[群聊] {{ group.members?.length || 0 }} 人</div>
              </div>
            </div>

            <!-- 角色聊天列表 -->
            <div
              v-for="char in allChatCharacters"
              :key="char.id"
              class="chat-item"
              @click="openChat(char.id)"
            >
              <div class="chat-avatar">
                <img v-if="char.avatar" :src="char.avatar" />
                <span v-else>{{ char.name?.[0] || '?' }}</span>
                <!-- 未读红点 -->
                <div v-if="getUnreadCount(char.id) > 0" class="unread-badge">
                  {{ getUnreadCount(char.id) > 99 ? '99+' : getUnreadCount(char.id) }}
                </div>
              </div>
              <div class="chat-info">
                <div class="chat-name">{{ char.name }}</div>
                <div class="chat-preview" :class="{ typing: isTyping(char.id) }">
                  <template v-if="isTyping(char.id)">
                    <span class="typing-indicator">对方正在输入...</span>
                  </template>
                  <template v-else>
                    {{ getChatPreview(char.id) }}
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

.chat-avatar {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  background: #f44336;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-sizing: border-box;
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
  top: -6px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  background: #f44336;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-sizing: border-box;
}
</style>
