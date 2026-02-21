<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessageCircle, X, Plus, Camera } from 'lucide-vue-next'
import { getPlazaCharacters, getPersonas, createPersona } from '../../../services/api.js'

const router = useRouter()
const characters = ref([])
const loading = ref(true)
const selectedChar = ref(null)

const showUserPicker = ref(false)
const personas = ref([])
const pendingChatCharId = ref('')

const showPersonaEditor = ref(false)
const savingPersona = ref(false)
const editorForm = ref({
  name: '',
  avatar: '',
  description: '',
  initialBalance: ''
})
const avatarInputRef = ref(null)

const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#9c27b0" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)

onMounted(async () => {
  await loadCharacters()
  await loadPersonasList()
})

async function loadCharacters() {
  loading.value = true
  try {
    characters.value = await getPlazaCharacters()
  } catch (e) {
    console.error('加载角色广场失败:', e)
  } finally {
    loading.value = false
  }
}

async function loadPersonasList() {
  try {
    personas.value = await getPersonas()
  } catch (e) {
    console.error('加载用户列表失败:', e)
  }
}

function showDetail(char) {
  selectedChar.value = char
}

function closeDetail() {
  selectedChar.value = null
}

function chatWithCharacter(charId) {
  selectedChar.value = null
  pendingChatCharId.value = charId
  loadPersonasList()
  showUserPicker.value = true
}

function closeUserPicker() {
  showUserPicker.value = false
  pendingChatCharId.value = ''
  closePersonaEditor()
}

function startChatWithSession(sessionId = 'player') {
  if (!pendingChatCharId.value) return
  router.push({
    path: '/app/wechat',
    query: { charId: pendingChatCharId.value, sessionId, fromPlaza: '1' }
  })
  closeUserPicker()
}

function openPersonaEditor() {
  editorForm.value = {
    name: '',
    avatar: '',
    description: '',
    initialBalance: ''
  }
  showPersonaEditor.value = true
}

function closePersonaEditor() {
  showPersonaEditor.value = false
}

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  try {
    const base64 = await fileToBase64(file)
    editorForm.value.avatar = base64
  } catch (e) {
    console.error('上传头像失败:', e)
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

async function createAndSelectUser() {
  const name = editorForm.value.name.trim()
  if (!name || savingPersona.value) return
  savingPersona.value = true
  try {
    const balanceStr = String(editorForm.value.initialBalance || '').trim()
    const initialBalance = balanceStr ? parseFloat(balanceStr) : undefined
    const persona = await createPersona({
      name,
      avatar: editorForm.value.avatar,
      description: editorForm.value.description,
      initialBalance
    })
    personas.value.push(persona)
    closePersonaEditor()
    startChatWithSession(`player__${persona.id}`)
  } catch (e) {
    console.error('创建用户失败:', e)
    alert('创建用户失败: ' + e.message)
  } finally {
    savingPersona.value = false
  }
}
</script>

<template>
  <div class="character-plaza">
    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="characters.length === 0" class="empty">
      <p>角色广场暂无角色</p>
      <p class="hint">创建角色并设为公开后会显示在这里</p>
    </div>

    <div v-else class="list">
      <div
        v-for="char in characters"
        :key="char.id"
        class="plaza-card"
        @click="showDetail(char)"
      >
        <img :src="char.avatar || defaultAvatar" class="avatar" alt="" />
        <div class="info">
          <div class="name">{{ char.name }}</div>
          <div class="bio">{{ char.bio || '暂无简介' }}</div>
          <div class="author">by {{ char.authorId }}</div>
        </div>
        <button class="chat-btn" @click.stop="chatWithCharacter(char.id)">
          <MessageCircle :size="16" />
        </button>
      </div>
    </div>

    <div v-if="selectedChar" class="modal-overlay" @click.self="closeDetail">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">角色简介</span>
          <button class="close-btn" @click="closeDetail">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-header">
            <img :src="selectedChar.avatar || defaultAvatar" class="detail-avatar" alt="" />
            <div class="detail-info">
              <div class="detail-name">{{ selectedChar.name }}</div>
              <div class="detail-author">by {{ selectedChar.authorId }}</div>
            </div>
          </div>
          <div class="detail-section">
            <div class="section-title">简介</div>
            <div class="section-content">{{ selectedChar.bio || '暂无简介' }}</div>
          </div>
          <div v-if="selectedChar.npcs && selectedChar.npcs.length > 0" class="npc-section">
            <div class="section-title">世界观 / 登场人物</div>
            <div class="npc-list">
              <div v-for="npc in selectedChar.npcs" :key="npc.id" class="npc-preview-card">
                <img v-if="npc.avatar" :src="npc.avatar" class="npc-avatar" alt="" />
                <div v-else class="npc-avatar npc-avatar-placeholder">
                  {{ npc.name?.[0] || '?' }}
                </div>
                <div class="npc-info">
                  <div class="npc-header">
                    <span class="npc-name">{{ npc.name }}</span>
                    <span v-if="npc.relation" class="npc-relation">{{ npc.relation }}</span>
                  </div>
                  <div class="npc-bio">{{ npc.bio || '神秘人物' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="chat-btn full" @click="chatWithCharacter(selectedChar.id)">
            <MessageCircle :size="18" />
            <span>与 TA 聊天</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showUserPicker" class="modal-overlay" @click.self="closeUserPicker">
      <div class="modal user-picker-modal">
        <div class="modal-header">
          <span class="modal-title">选择聊天用户</span>
          <button class="close-btn" @click="closeUserPicker">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <button class="user-item" @click="startChatWithSession('player')">
            <span class="user-name">默认</span>
            <span class="user-hint">player</span>
          </button>
          <button
            v-for="persona in personas"
            :key="persona.id"
            class="user-item"
            @click="startChatWithSession(`player__${persona.id}`)"
          >
            <span class="user-name">{{ persona.name || '未命名用户' }}</span>
            <span class="user-hint">{{ persona.id }}</span>
          </button>
          <button class="add-user-strip" @click="openPersonaEditor">
            <Plus :size="18" />
            <span>新增用户</span>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showPersonaEditor" class="modal-overlay" @click.self="closePersonaEditor">
        <div class="modal-content">
          <div class="modal-header">
            <span>创建人设</span>
            <button class="close-btn" @click="closePersonaEditor">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <div class="avatar-upload" @click="triggerAvatarUpload">
              <div class="avatar-preview">
                <img v-if="editorForm.avatar" :src="editorForm.avatar" />
                <span v-else>{{ editorForm.name?.[0] || '?' }}</span>
              </div>
              <div class="avatar-overlay">
                <Camera :size="20" />
                <span>更换头像</span>
              </div>
              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleAvatarUpload"
              />
            </div>
            <div class="form-group">
              <label>昵称</label>
              <input v-model="editorForm.name" type="text" placeholder="输入用户昵称" maxlength="20" />
            </div>
            <div class="form-group">
              <label>人设描述</label>
              <textarea v-model="editorForm.description" placeholder="描述这个用户人设" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>初始余额</label>
              <div class="balance-input-wrapper">
                <span class="currency-symbol">¥</span>
                <input v-model="editorForm.initialBalance" type="number" placeholder="0.00" step="0.01" min="0" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn cancel" @click="closePersonaEditor">取消</button>
            <button class="btn primary" :disabled="savingPersona || !editorForm.name.trim()" @click="createAndSelectUser">
              {{ savingPersona ? '创建中' : '创建并聊天' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.character-plaza {
  padding: 12px;
}

.loading, .empty {
  text-align: center;
  padding: 30px 16px;
  color: #666;
}

.empty .hint {
  font-size: 12px;
  margin-top: 6px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plaza-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #2a2a2a;
  border-radius: 10px;
  align-items: center;
  cursor: pointer;
}

.plaza-card:active {
  background: #333;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 2px;
}

.bio {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 90%;
  max-width: 320px;
  background: #222;
  border-radius: 12px;
  overflow: hidden;
}

.modal-content {
  width: 90%;
  max-width: 360px;
  max-height: 85vh;
  background: #222;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.modal-title {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #333;
  color: #fff;
}

.modal-body {
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.detail-avatar {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.detail-author {
  font-size: 12px;
  color: #888;
}

.detail-section {
  margin-top: 12px;
}

.section-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.section-content {
  font-size: 13px;
  color: #ccc;
  line-height: 1.5;
  background: #2a2a2a;
  padding: 10px 12px;
  border-radius: 8px;
}

.chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #9c27b0;
  color: #fff;
  cursor: pointer;
}

.chat-btn.full {
  width: 100%;
  height: auto;
  padding: 10px 16px;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #333;
}

.npc-section {
  margin-top: 16px;
}

.npc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.npc-preview-card {
  display: flex;
  gap: 10px;
  background: #2a2a2a;
  border-radius: 10px;
  padding: 10px;
  border: 1px solid #3a3a3a;
}

.npc-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.npc-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.npc-info {
  flex: 1;
  min-width: 0;
}

.npc-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.npc-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.npc-relation {
  font-size: 11px;
  color: #9c27b0;
}

.npc-bio {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}

.user-picker-modal {
  max-width: 360px;
}

.user-item {
  width: 100%;
  border: 1px solid #3a3a3a;
  background: #2a2a2a;
  border-radius: 8px;
  color: #fff;
  padding: 10px 12px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  cursor: pointer;
}

.user-item:active {
  background: #333;
}

.user-name {
  font-size: 14px;
}

.user-hint {
  font-size: 11px;
  color: #888;
}

.add-user-strip {
  width: 100%;
  border: 1px dashed #9c27b0;
  background: #26222b;
  border-radius: 8px;
  color: #c8a4df;
  padding: 11px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  cursor: pointer;
}

.add-user-strip:active {
  background: #2f2736;
}

.avatar-upload {
  position: relative;
  width: 96px;
  height: 96px;
  margin: 0 auto 14px;
  cursor: pointer;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview span {
  font-size: 28px;
  color: #fff;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.48);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
}

.avatar-upload:active .avatar-overlay {
  opacity: 1;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  background: #1c1c1c;
  color: #fff;
  padding: 8px 10px;
  font-size: 13px;
  box-sizing: border-box;
}

.balance-input-wrapper {
  position: relative;
}

.currency-symbol {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #aaa;
}

.balance-input-wrapper input {
  padding-left: 24px;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.btn.cancel {
  background: #3a3a3a;
  color: #ddd;
}

.btn.primary {
  background: #9c27b0;
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
