<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ArrowLeft, Camera, Heart, MessageCircle, User } from 'lucide-vue-next'
import { getMoments, getWechatProfile, getPlayerMoments, postPlayerMoment, deletePlayerMoment as apiDeletePlayerMoment } from '../../services/wechatApi.js'
import { getMyCharacters, getCharacterForChat, getPersonas } from '../../services/api.js'

const emit = defineEmits(['back', 'openProfile'])

const characters = ref([])
const profiles = ref({})
const loading = ref(true)

// 人设相关
const personas = ref([])
const selectedPersonaId = ref(null)
const showPersonaSelector = ref(false)

// 当前选中的人设
const currentPersona = computed(() => {
  if (!selectedPersonaId.value) return null
  return personas.value.find(p => p.id === selectedPersonaId.value)
})

// 用户朋友圈（按人设隔离存储）
const playerMoments = ref([])

// 发布弹窗
const showComposer = ref(false)
const newMomentText = ref('')

// 封面/头像上传
const coverInput = ref(null)
const avatarInput = ref(null)

// 人设资料（封面、头像等，按人设隔离）
const personaProfiles = ref({})

onMounted(async () => {
  await loadData()
})

// 获取当前人设的资料
const currentProfile = computed(() => {
  const personaId = selectedPersonaId.value || 'default'
  return personaProfiles.value[personaId] || {
    nickname: currentPersona.value?.name || '我',
    avatar: currentPersona.value?.avatar || '',
    coverImage: ''
  }
})

// 加载人设资料
function loadPersonaProfiles() {
  try {
    const saved = localStorage.getItem('player_persona_profiles')
    if (saved) {
      personaProfiles.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('加载人设资料失败:', e)
  }
}

// 保存人设资料
function savePersonaProfiles() {
  try {
    localStorage.setItem('player_persona_profiles', JSON.stringify(personaProfiles.value))
  } catch (e) {
    console.error('保存人设资料失败:', e)
  }
}

// 更新当前人设的资料
function updateCurrentProfile(key, value) {
  const personaId = selectedPersonaId.value || 'default'
  if (!personaProfiles.value[personaId]) {
    personaProfiles.value[personaId] = {
      nickname: currentPersona.value?.name || '我',
      avatar: currentPersona.value?.avatar || '',
      coverImage: ''
    }
  }
  personaProfiles.value[personaId][key] = value
  savePersonaProfiles()
}

// 加载所有人设的朋友圈（从后端）
async function loadAllPlayerMoments() {
  try {
    return await getPlayerMoments()
  } catch (e) {
    console.error('加载朋友圈失败:', e)
  }
  return []
}

// 加载当前人设的朋友圈
async function loadPlayerMomentsData() {
  const allData = await loadAllPlayerMoments()
  const personaId = selectedPersonaId.value || 'default'
  // 筛选当前人设的朋友圈
  playerMoments.value = allData.filter(m =>
    (m.personaId || 'default') === personaId
  )
}

// 监听人设切换，重新加载数据
watch(selectedPersonaId, async () => {
  await loadPlayerMomentsData()
  await loadCharacterMoments()
})

// 角色朋友圈（按人设隔离）
const charMoments = ref([])

// 加载与当前人设绑定的角色的朋友圈
async function loadCharacterMoments() {
  const personaId = selectedPersonaId.value || 'default'
  const moments = []

  for (const char of characters.value) {
    try {
      const [profile, charData, charMomentsData] = await Promise.all([
        getWechatProfile(char.id),
        getCharacterForChat(char.id).catch(() => null),
        getMoments(char.id)
      ])

      // 保存 profile 信息
      profiles.value[char.id] = {
        ...profile,
        name: profile?.nickname || charData?.name || char.name,
        avatar: profile?.avatar || charData?.avatar || char.avatar,
        boundPersonaId: profile?.boundPersonaId
      }

      // 只加载与当前人设绑定的角色的朋友圈
      // 如果角色没有绑定人设，默认属于 'default' 人设
      const charBoundPersonaId = profile?.boundPersonaId || 'default'
      if (charBoundPersonaId !== personaId) {
        continue // 跳过不属于当前人设的角色
      }

      // 给每条动态添加角色信息
      for (const m of charMomentsData) {
        moments.push({
          ...m,
          charId: char.id,
          authorName: profiles.value[char.id].name,
          authorAvatar: profiles.value[char.id].avatar,
          isPlayer: false
        })
      }
    } catch (e) {
      console.error(`加载角色 ${char.id} 朋友圈失败:`, e)
    }
  }

  charMoments.value = moments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

async function loadData() {
  loading.value = true
  try {
    // 获取所有角色和人设
    const [chars, personasData] = await Promise.all([
      getMyCharacters(),
      getPersonas().catch(() => [])
    ])
    characters.value = chars
    personas.value = personasData

    // 加载人设资料
    loadPersonaProfiles()

    // 恢复上次选择的人设
    const savedPersonaId = localStorage.getItem('current_persona_id')
    if (savedPersonaId && personasData.find(p => p.id === savedPersonaId)) {
      selectedPersonaId.value = savedPersonaId
    } else if (personasData.length > 0 && !selectedPersonaId.value) {
      selectedPersonaId.value = personasData[0].id
    }

    // 加载当前人设的朋友圈
    await loadPlayerMomentsData()

    // 加载与当前人设绑定的角色的朋友圈
    await loadCharacterMoments()

  } catch (e) {
    console.error('加载朋友圈失败:', e)
  } finally {
    loading.value = false
  }
}

// 合并用户和角色的朋友圈
const combinedMoments = computed(() => {
  const playerMomentsWithInfo = playerMoments.value.map(m => ({
    ...m,
    authorName: currentProfile.value.nickname,
    authorAvatar: currentProfile.value.avatar,
    isPlayer: true,
    personaId: selectedPersonaId.value
  }))

  // 使用 charMoments 而不是 allMoments
  return [...playerMomentsWithInfo, ...charMoments.value]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

function goBack() {
  emit('back')
}

function openAuthorProfile(charId) {
  if (charId) {
    emit('openProfile', charId)
  }
}

// 人设选择
function togglePersonaSelector() {
  showPersonaSelector.value = !showPersonaSelector.value
}

function selectPersona(personaId) {
  selectedPersonaId.value = personaId
  showPersonaSelector.value = false
}

// 上传封面
function triggerCoverUpload() {
  coverInput.value?.click()
}

async function handleCoverChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    const base64 = await fileToBase64(file)
    updateCurrentProfile('coverImage', base64)
  } catch (e) {
    console.error('上传封面失败:', e)
  }
  e.target.value = ''
}

// 上传头像
function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function handleAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    const base64 = await fileToBase64(file)
    updateCurrentProfile('avatar', base64)
  } catch (e) {
    console.error('上传头像失败:', e)
  }
  e.target.value = ''
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 发布动态
function openComposer() {
  if (!selectedPersonaId.value && personas.value.length > 0) {
    alert('请先选择一个人设')
    showPersonaSelector.value = true
    return
  }
  showComposer.value = true
  newMomentText.value = ''
}

function closeComposer() {
  showComposer.value = false
}

async function publishMoment() {
  if (!newMomentText.value.trim()) return

  try {
    const newMoment = await postPlayerMoment({
      content: newMomentText.value,
      images: [],
      location: '',
      personaId: selectedPersonaId.value,
      personaName: currentPersona.value?.name || '我'
    })

    playerMoments.value.unshift(newMoment)
    closeComposer()
  } catch (e) {
    console.error('发布朋友圈失败:', e)
    alert('发布失败: ' + e.message)
  }
}

// 删除自己的动态
async function deletePlayerMoment(momentId) {
  if (!confirm('确定删除这条动态吗？')) return

  try {
    await apiDeletePlayerMoment(momentId)
    const index = playerMoments.value.findIndex(m => m.id === momentId)
    if (index >= 0) {
      playerMoments.value.splice(index, 1)
    }
  } catch (e) {
    console.error('删除朋友圈失败:', e)
    alert('删除失败: ' + e.message)
  }
}

// 点赞
function toggleLike(moment) {
  const myId = selectedPersonaId.value || 'player'
  if (!moment.likes) moment.likes = []
  const index = moment.likes.findIndex(l =>
    typeof l === 'string' ? l === myId : l.id === myId
  )
  if (index >= 0) {
    moment.likes.splice(index, 1)
  } else {
    moment.likes.push({
      id: myId,
      name: currentProfile.value.nickname
    })
  }
  // 用户自己的点赞只是本地状态，角色的互动由后端处理
}

function isLiked(moment) {
  const myId = selectedPersonaId.value || 'player'
  return moment.likes?.some(l =>
    typeof l === 'string' ? l === myId : l.id === myId
  )
}

// 获取点赞名字列表
function getLikeNames(moment) {
  if (!moment.likes?.length) return ''
  return moment.likes.map(l => typeof l === 'string' ? l : l.name).join(', ')
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString()
}
</script>

<template>
  <div class="moments-feed">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">朋友圈</span>
      <div class="header-actions">
        <!-- 人设选择按钮 -->
        <button class="icon-btn" :class="{ active: showPersonaSelector }" @click="togglePersonaSelector">
          <Heart :size="22" :fill="selectedPersonaId ? '#e53935' : 'none'" />
        </button>
        <!-- 发布按钮 -->
        <button class="icon-btn" @click="openComposer">
          <Camera :size="22" />
        </button>
      </div>
    </div>

    <!-- 人设选择器 -->
    <div v-if="showPersonaSelector" class="persona-selector">
      <div class="persona-selector-title">选择身份</div>
      <div class="persona-list">
        <div
          v-for="persona in personas"
          :key="persona.id"
          class="persona-item"
          :class="{ active: selectedPersonaId === persona.id }"
          @click="selectPersona(persona.id)"
        >
          <div class="persona-avatar">
            <img v-if="persona.avatar" :src="persona.avatar" />
            <span v-else>{{ persona.name?.[0] || '?' }}</span>
          </div>
          <span class="persona-name">{{ persona.name }}</span>
          <span v-if="selectedPersonaId === persona.id" class="check-icon">✓</span>
        </div>
        <div v-if="personas.length === 0" class="persona-empty">
          暂无人设，请先在"我"页面创建
        </div>
      </div>
    </div>

    <!-- 封面区域 -->
    <div class="cover-section">
      <div
        class="cover-image"
        :style="currentProfile.coverImage ? { backgroundImage: `url(${currentProfile.coverImage})` } : {}"
        @click="triggerCoverUpload"
      >
        <div v-if="!currentProfile.coverImage" class="cover-placeholder">
          <Camera :size="24" />
          <span>点击设置封面</span>
        </div>
        <div v-else class="cover-edit-hint">
          <Camera :size="16" />
          <span>更换封面</span>
        </div>
      </div>

      <!-- 用户头像 -->
      <div class="profile-float">
        <span class="nickname">{{ currentProfile.nickname }}</span>
        <div class="avatar" @click.stop="triggerAvatarUpload">
          <img v-if="currentProfile.avatar" :src="currentProfile.avatar" />
          <span v-else>{{ currentProfile.nickname?.[0] || '我' }}</span>
          <div class="avatar-edit-hint">
            <Camera :size="12" />
          </div>
        </div>
      </div>

      <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="handleCoverChange" />
      <input ref="avatarInput" type="file" accept="image/*" style="display: none" @change="handleAvatarChange" />
    </div>

    <!-- 动态列表 -->
    <div class="moments-list">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="combinedMoments.length === 0" class="empty">暂无朋友圈动态</div>

      <div v-else v-for="moment in combinedMoments" :key="moment.id" class="moment-item">
        <div class="moment-avatar" :class="{ clickable: !moment.isPlayer }" @click="!moment.isPlayer && openAuthorProfile(moment.charId)">
          <img v-if="moment.authorAvatar" :src="moment.authorAvatar" />
          <span v-else>{{ moment.authorName?.[0] || '?' }}</span>
        </div>

        <div class="moment-content">
          <div class="moment-author" :class="{ clickable: !moment.isPlayer, 'is-player': moment.isPlayer }" @click="!moment.isPlayer && openAuthorProfile(moment.charId)">
            {{ moment.authorName }}
            <span v-if="moment.isPlayer" class="player-badge">我</span>
          </div>

          <div v-if="moment.content" class="moment-text">{{ moment.content }}</div>

          <div v-if="moment.images?.length" class="moment-images" :class="`grid-${Math.min(moment.images.length, 3)}`">
            <img v-for="(img, idx) in moment.images" :key="idx" :src="img" class="moment-img" />
          </div>

          <div v-if="moment.location" class="moment-location">📍 {{ moment.location }}</div>

          <div class="moment-footer">
            <span class="moment-time">{{ formatTime(moment.createdAt) }}</span>
            <div class="moment-actions">
              <button class="action-btn" :class="{ liked: isLiked(moment) }" @click="toggleLike(moment)">
                <Heart :size="16" :fill="isLiked(moment) ? '#e53935' : 'none'" />
                <span v-if="moment.likes?.length">{{ moment.likes.length }}</span>
              </button>
              <button class="action-btn">
                <MessageCircle :size="16" />
                <span v-if="moment.comments?.length">{{ moment.comments.length }}</span>
              </button>
              <button v-if="moment.isPlayer" class="action-btn delete" @click="deletePlayerMoment(moment.id)">删除</button>
            </div>
          </div>

          <!-- 互动区域 -->
          <div v-if="moment.likes?.length || moment.comments?.length" class="interaction-section">
            <div v-if="moment.likes?.length" class="likes-row">
              <Heart :size="14" fill="#e53935" />
              <span>{{ getLikeNames(moment) }}</span>
            </div>
            <div v-if="moment.comments?.length" class="comments-list">
              <div v-for="comment in moment.comments" :key="comment.id" class="comment-item">
                <span class="comment-author">{{ comment.authorName }}:</span>
                <span class="comment-text">{{ comment.content }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 发布弹窗 -->
    <div v-if="showComposer" class="composer-overlay" @click.self="closeComposer">
      <div class="composer">
        <div class="composer-header">
          <button class="text-btn" @click="closeComposer">取消</button>
          <span>以「{{ currentProfile.nickname }}」发布</span>
          <button class="text-btn primary" @click="publishMoment">发布</button>
        </div>
        <textarea v-model="newMomentText" class="composer-input" placeholder="这一刻的想法..." rows="4"></textarea>
        <div class="composer-tip">💡 发布后，角色会在下次聊天时看到你的朋友圈</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.moments-feed {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ededed;
  overflow-y: auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ededed;
  border-bottom: 1px solid #d9d9d9;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .title {
  font-size: 17px;
  font-weight: 500;
  color: #000;
}

.header-actions {
  display: flex;
  gap: 4px;
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

.icon-btn.active {
  background: #f0f0f0;
}

/* 人设选择器 */
.persona-selector {
  background: #fff;
  border-bottom: 1px solid #d9d9d9;
  padding: 12px;
}

.persona-selector-title {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.persona-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.persona-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  min-width: 60px;
  position: relative;
}

.persona-item.active {
  background: #e8f5e9;
}

.persona-avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.persona-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.persona-avatar span {
  font-size: 18px;
  color: #fff;
}

.persona-name {
  font-size: 12px;
  color: #333;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #07c160;
  font-size: 12px;
  font-weight: bold;
}

.persona-empty {
  color: #999;
  font-size: 13px;
  padding: 12px;
}

/* 封面区域 */
.cover-section {
  position: relative;
  flex-shrink: 0;
}

.cover-image {
  height: 280px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-size: cover;
  background-position: center;
  cursor: pointer;
  position: relative;
}

.cover-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255,255,255,0.7);
}

.cover-edit-hint {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(0,0,0,0.5);
  border-radius: 20px;
  color: #fff;
  font-size: 12px;
}

.profile-float {
  position: absolute;
  bottom: -30px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-float .nickname {
  font-size: 17px;
  font-weight: 500;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.profile-float .avatar {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  background: #576b95;
  border: 3px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.profile-float .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-float .avatar span {
  font-size: 28px;
  color: #fff;
}

.avatar-edit-hint {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 动态列表 */
.moments-list {
  padding-top: 50px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.moment-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.moment-avatar {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.moment-avatar.clickable {
  cursor: pointer;
}

.moment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-avatar span {
  font-size: 18px;
  color: #fff;
}

.moment-content {
  flex: 1;
  min-width: 0;
}

.moment-author {
  font-size: 15px;
  font-weight: 500;
  color: #576b95;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.moment-author.clickable {
  cursor: pointer;
}

.moment-author.is-player {
  color: #07c160;
}

.player-badge {
  font-size: 10px;
  padding: 1px 4px;
  background: #07c160;
  color: #fff;
  border-radius: 2px;
}

.moment-text {
  font-size: 15px;
  color: #000;
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-word;
}

.moment-images {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.moment-images.grid-1 {
  grid-template-columns: 1fr;
  max-width: 200px;
}

.moment-images.grid-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 280px;
}

.moment-images.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.moment-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}

.moment-location {
  font-size: 12px;
  color: #576b95;
  margin-bottom: 8px;
}

.moment-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.moment-time {
  font-size: 12px;
  color: #999;
}

.moment-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 12px;
}

.action-btn.liked {
  color: #e53935;
}

.action-btn.delete:hover {
  color: #e53935;
}

/* 互动区域 */
.interaction-section {
  margin-top: 8px;
  padding: 8px;
  background: #f7f7f7;
  border-radius: 4px;
}

.likes-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #576b95;
}

.comments-list {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e5e5e5;
}

.comment-item {
  font-size: 13px;
  line-height: 1.6;
}

.comment-author {
  color: #576b95;
  font-weight: 500;
}

.comment-text {
  color: #000;
}

/* 发布弹窗 */
.composer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.composer {
  width: calc(100% - 48px);
  max-width: 320px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.composer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.composer-header span {
  font-size: 14px;
  font-weight: 500;
}

.text-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #999;
  cursor: pointer;
}

.text-btn.primary {
  color: #07c160;
  font-weight: 500;
}

.composer-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.composer-input:focus {
  border-color: #07c160;
}

.composer-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #999;
  text-align: center;
}
</style>
