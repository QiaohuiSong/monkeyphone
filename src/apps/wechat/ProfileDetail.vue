<script setup>
import { ref, onMounted, computed } from 'vue'
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-vue-next'
import { getWechatProfile, bindPersona, clearChatSession } from '../../services/wechatApi.js'
import { getCharacterForChat, getPersonas } from '../../services/api.js'

const props = defineProps({
  charId: { type: String, required: true }
})

const emit = defineEmits(['back', 'openChat', 'openMoments', 'openSpy'])

const profile = ref(null)
const character = ref(null)
const personas = ref([])

// 人设选择器状态
const showPersonaSelector = ref(false)

// 删除确认弹窗
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// 当前绑定的人设
const boundPersona = computed(() => {
  if (!profile.value?.boundPersonaId) return null
  return personas.value.find(p => p.id === profile.value.boundPersonaId)
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  try {
    const [profileData, charData, personasData] = await Promise.all([
      getWechatProfile(props.charId),
      getCharacterForChat(props.charId).catch(() => null),
      getPersonas().catch(() => [])
    ])
    profile.value = profileData
    character.value = charData
    personas.value = personasData
  } catch (e) {
    console.error('加载资料失败:', e)
  }
}

function goBack() {
  emit('back')
}

function openChat() {
  emit('openChat', props.charId, 'player')
}

function openMoments() {
  emit('openMoments', props.charId)
}

function openSpy() {
  emit('openSpy', props.charId)
}

// 打开人设选择器
function openPersonaSelector() {
  showPersonaSelector.value = true
}

// 关闭人设选择器
function closePersonaSelector() {
  showPersonaSelector.value = false
}

// 选择人设
async function selectPersona(personaId) {
  try {
    const updatedProfile = await bindPersona(props.charId, personaId)
    profile.value = updatedProfile
    closePersonaSelector()
  } catch (e) {
    console.error('绑定人设失败:', e)
    alert('绑定失败: ' + e.message)
  }
}

// 打开删除确认弹窗
function openDeleteConfirm() {
  showDeleteConfirm.value = true
}

// 关闭删除确认弹窗
function closeDeleteConfirm() {
  showDeleteConfirm.value = false
}

// 确认删除聊天记录
async function confirmDeleteChat() {
  if (isDeleting.value) return

  isDeleting.value = true
  try {
    await clearChatSession(props.charId, 'player')
    closeDeleteConfirm()
    alert('聊天记录已清空')
  } catch (e) {
    console.error('删除聊天记录失败:', e)
    alert('删除失败: ' + e.message)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="profile-detail">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">个人信息</span>
      <div style="width: 36px"></div>
    </div>

    <!-- 资料卡片 -->
    <div class="profile-card">
      <!-- 头像区域 -->
      <div class="avatar-section">
        <div class="avatar">
          <img v-if="profile?.avatar || character?.avatar" :src="profile?.avatar || character?.avatar" />
          <span v-else>{{ profile?.nickname?.[0] || character?.name?.[0] || '?' }}</span>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="info-section">
        <div class="info-row">
          <span class="label">昵称</span>
          <span class="value">{{ profile?.nickname || character?.name || '未设置' }}</span>
        </div>

        <div class="info-row">
          <span class="label">微信号</span>
          <span class="value">{{ profile?.wxId || '未设置' }}</span>
        </div>

        <div class="info-row">
          <span class="label">个性签名</span>
          <span class="value signature">{{ profile?.signature || character?.bio || '未设置' }}</span>
        </div>
      </div>
    </div>

    <!-- 功能列表 -->
    <div class="menu-section">
      <div class="menu-item" @click="openPersonaSelector">
        <span class="menu-label">我的身份</span>
        <span class="menu-value">{{ boundPersona?.name || '默认身份' }}</span>
        <ChevronRight :size="20" class="menu-arrow" />
      </div>

      <div class="menu-item" @click="openMoments">
        <span class="menu-label">个人相册</span>
        <ChevronRight :size="20" class="menu-arrow" />
      </div>

      <div class="menu-item" @click="openSpy">
        <span class="menu-label">更多信息</span>
        <span class="menu-hint">查看TA的聊天记录</span>
        <ChevronRight :size="20" class="menu-arrow" />
      </div>

      <div class="menu-item danger" @click="openDeleteConfirm">
        <Trash2 :size="18" class="menu-icon-left" />
        <span class="menu-label">清空聊天记录</span>
        <ChevronRight :size="20" class="menu-arrow" />
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="bottom-actions">
      <button class="action-btn primary" @click="openChat">
        发消息
      </button>
    </div>

    <!-- 人设选择器 Modal -->
    <div v-if="showPersonaSelector" class="modal-overlay" @click.self="closePersonaSelector">
      <div class="selector-modal">
        <div class="selector-header">
          <span>选择身份</span>
        </div>
        <div class="selector-list">
          <!-- 默认身份 -->
          <div
            class="selector-item"
            :class="{ active: !profile?.boundPersonaId }"
            @click="selectPersona(null)"
          >
            <div class="selector-avatar default">
              <span>我</span>
            </div>
            <div class="selector-name">默认身份</div>
            <div v-if="!profile?.boundPersonaId" class="selector-check">&#10003;</div>
          </div>

          <!-- 人设列表 -->
          <div
            v-for="persona in personas"
            :key="persona.id"
            class="selector-item"
            :class="{ active: profile?.boundPersonaId === persona.id }"
            @click="selectPersona(persona.id)"
          >
            <div class="selector-avatar">
              <img v-if="persona.avatar" :src="persona.avatar" />
              <span v-else>{{ persona.name?.[0] || '?' }}</span>
            </div>
            <div class="selector-name">{{ persona.name }}</div>
            <div v-if="profile?.boundPersonaId === persona.id" class="selector-check">&#10003;</div>
          </div>

          <!-- 空状态 -->
          <div v-if="personas.length === 0" class="selector-empty">
            暂无人设，请先在"我"页面创建人设
          </div>
        </div>
        <div class="selector-footer">
          <button class="cancel-btn" @click="closePersonaSelector">取消</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="closeDeleteConfirm">
      <div class="confirm-modal">
        <div class="confirm-icon">
          <Trash2 :size="32" />
        </div>
        <div class="confirm-title">清空聊天记录</div>
        <div class="confirm-message">
          确定要删除与「{{ profile?.nickname || character?.name || '该角色' }}」的所有聊天记录吗？
          <br />
          <span class="confirm-warning">此操作不可撤销</span>
        </div>
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" @click="closeDeleteConfirm" :disabled="isDeleting">取消</button>
          <button class="confirm-btn danger" @click="confirmDeleteChat" :disabled="isDeleting">
            {{ isDeleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ededed;
  position: relative;
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

.profile-card {
  background: #fff;
  margin: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.avatar-section {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar span {
  font-size: 32px;
  color: #fff;
}

.info-section {
  padding: 0 16px 16px;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  width: 80px;
  font-size: 15px;
  color: #000;
}

.info-row .value {
  flex: 1;
  font-size: 15px;
  color: #999;
  text-align: right;
}

.info-row .value.signature {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-section {
  background: #fff;
  margin: 0 12px;
  border-radius: 8px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: #f5f5f5;
}

.menu-label {
  flex: 1;
  font-size: 15px;
  color: #000;
}

.menu-hint {
  font-size: 13px;
  color: #999;
  margin-right: 8px;
}

.menu-arrow {
  color: #c0c0c0;
}

.bottom-actions {
  margin-top: auto;
  padding: 16px;
}

.action-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.action-btn.primary {
  background: #07c160;
  color: #fff;
}

.action-btn.primary:active {
  background: #06ad56;
}

/* 人设选择器 Modal */
.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.selector-modal {
  width: calc(100% - 48px);
  max-width: 320px;
  background: #fff;
  border-radius: 12px;
  max-height: 60%;
  display: flex;
  flex-direction: column;
}

.selector-header {
  padding: 16px;
  text-align: center;
  font-size: 17px;
  font-weight: 500;
  color: #000;
  border-bottom: 1px solid #f0f0f0;
}

.selector-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
}

.selector-item:active {
  background: #f5f5f5;
}

.selector-item.active {
  background: #f0f9f4;
}

.selector-avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.selector-avatar.default {
  background: #576b95;
}

.selector-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selector-avatar span {
  font-size: 18px;
  color: #fff;
}

.selector-name {
  flex: 1;
  font-size: 16px;
  color: #000;
}

.selector-check {
  color: #07c160;
  font-size: 18px;
  font-weight: bold;
}

.selector-empty {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.selector-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: #f5f5f5;
  color: #333;
  font-size: 16px;
  cursor: pointer;
}

.cancel-btn:active {
  background: #e5e5e5;
}

.menu-value {
  font-size: 14px;
  color: #999;
  margin-right: 4px;
}

.menu-item.danger {
  color: #e53935;
}

.menu-item.danger .menu-label {
  color: #e53935;
}

.menu-icon-left {
  margin-right: 8px;
  flex-shrink: 0;
}

/* 确认弹窗 */
.confirm-modal {
  width: calc(100% - 64px);
  max-width: 280px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.confirm-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: #fff2f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e53935;
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: #000;
  margin-bottom: 8px;
}

.confirm-message {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
}

.confirm-warning {
  color: #e53935;
  font-size: 12px;
}

.confirm-buttons {
  display: flex;
  gap: 12px;
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn.cancel {
  background: #f5f5f5;
  color: #333;
}

.confirm-btn.cancel:hover:not(:disabled) {
  background: #e5e5e5;
}

.confirm-btn.danger {
  background: #e53935;
  color: #fff;
}

.confirm-btn.danger:hover:not(:disabled) {
  background: #d32f2f;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
