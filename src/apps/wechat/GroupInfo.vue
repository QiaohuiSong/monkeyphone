<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Plus, Minus, ChevronRight } from 'lucide-vue-next'
import { getGroup, updateGroup, deleteGroup, clearGroupChats, getPersonas } from '../../services/api.js'
import { getWechatProfile } from '../../services/wechatApi.js'

const props = defineProps({
  groupId: { type: String, required: true }
})

const emit = defineEmits(['back', 'addMember', 'deleted', 'openChat', 'updated'])

const group = ref(null)
const personas = ref([])
const ownerProfile = ref(null) // 主角色卡的 profile，用于获取默认人设
const isEditMode = ref(false)
const isLoading = ref(false)

// 删除确认弹窗
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// 清空聊天确认弹窗
const showClearConfirm = ref(false)
const isClearing = ref(false)

// 人设选择弹窗
const showPersonaSelector = ref(false)

// 群名称编辑弹窗
const showNameEditor = ref(false)
const editingName = ref('')

// 当前绑定的人设
const boundPersona = computed(() => {
  if (!group.value) return null
  // 优先使用群聊设置的人设
  if (group.value.persona_id) {
    return personas.value.find(p => p.id === group.value.persona_id)
  }
  // 否则使用主角色卡的默认人设
  if (ownerProfile.value?.boundPersonaId) {
    return personas.value.find(p => p.id === ownerProfile.value.boundPersonaId)
  }
  return null
})

// 显示的人设来源
const personaSource = computed(() => {
  if (!group.value) return ''
  if (group.value.persona_id) return ''
  if (ownerProfile.value?.boundPersonaId) return '(来自角色卡)'
  return ''
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  isLoading.value = true
  try {
    const [groupData, personasData] = await Promise.all([
      getGroup(props.groupId),
      getPersonas().catch(() => [])
    ])
    group.value = groupData
    personas.value = personasData

    // 获取主角色卡的 profile 以获取默认人设
    if (groupData.owner_char_id) {
      try {
        ownerProfile.value = await getWechatProfile(groupData.owner_char_id)
      } catch (e) {
        console.error('获取主角色卡 profile 失败:', e)
      }
    }
  } catch (e) {
    console.error('加载群组失败:', e)
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  emit('back')
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
}

function addMember() {
  emit('addMember', props.groupId)
}

async function removeMember(memberId) {
  if (!group.value) return

  const newMembers = group.value.members.filter(m => m.id !== memberId)
  if (newMembers.length === 0) {
    alert('群聊至少需要一个成员')
    return
  }

  try {
    group.value = await updateGroup(props.groupId, {
      members: newMembers,
      name: `${group.value.name.split(' ')[0]} (${newMembers.length + 1}人)` // +1 for user
    })
    emit('updated', group.value)
  } catch (e) {
    console.error('移除成员失败:', e)
    alert('移除失败: ' + e.message)
  }
}

function openDeleteConfirm() {
  showDeleteConfirm.value = true
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false
}

async function confirmDeleteGroup() {
  if (isDeleting.value) return

  isDeleting.value = true
  try {
    await deleteGroup(props.groupId)
    closeDeleteConfirm()
    emit('deleted')
  } catch (e) {
    console.error('删除群组失败:', e)
    alert('删除失败: ' + e.message)
  } finally {
    isDeleting.value = false
  }
}

function openClearConfirm() {
  showClearConfirm.value = true
}

function closeClearConfirm() {
  showClearConfirm.value = false
}

async function confirmClearChats() {
  if (isClearing.value) return

  isClearing.value = true
  try {
    await clearGroupChats(props.groupId)
    closeClearConfirm()
    alert('聊天记录已清空')
  } catch (e) {
    console.error('清空聊天失败:', e)
    alert('清空失败: ' + e.message)
  } finally {
    isClearing.value = false
  }
}

// 群名称编辑相关
function openNameEditor() {
  editingName.value = group.value?.name || ''
  showNameEditor.value = true
}

function closeNameEditor() {
  showNameEditor.value = false
}

async function saveName() {
  const newName = editingName.value.trim()
  if (!newName) {
    alert('群聊名称不能为空')
    return
  }
  try {
    group.value = await updateGroup(props.groupId, { name: newName })
    emit('updated', group.value)
    closeNameEditor()
  } catch (e) {
    console.error('更新群名称失败:', e)
    alert('更新失败: ' + e.message)
  }
}

// 人设选择相关
function openPersonaSelector() {
  showPersonaSelector.value = true
}

function closePersonaSelector() {
  showPersonaSelector.value = false
}

async function selectPersona(personaId) {
  try {
    group.value = await updateGroup(props.groupId, {
      persona_id: personaId || null
    })
    emit('updated', group.value)
    closePersonaSelector()
  } catch (e) {
    console.error('更新人设失败:', e)
    alert('更新失败: ' + e.message)
  }
}

function getMemberTypeLabel(type) {
  switch (type) {
    case 'main': return '角色卡'
    case 'preset': return 'NPC'
    case 'custom': return '自建'
    default: return ''
  }
}

function getMemberTypeClass(type) {
  switch (type) {
    case 'main': return 'char'
    case 'preset': return 'npc'
    case 'custom': return 'custom'
    default: return ''
  }
}
</script>

<template>
  <div class="group-info">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">聊天信息</span>
      <button class="icon-btn text-btn" @click="toggleEditMode">
        {{ isEditMode ? '完成' : '管理' }}
      </button>
    </div>

    <div class="content" v-if="group">
      <!-- 群名称 -->
      <div class="section">
        <div class="menu-item" @click="openNameEditor">
          <span class="menu-label">群聊名称</span>
          <div class="menu-value">
            <span>{{ group.name }}</span>
            <ChevronRight :size="18" class="chevron" />
          </div>
        </div>
      </div>

      <!-- 成员网格 -->
      <div class="section">
        <div class="section-title">群聊成员</div>
        <div class="member-grid">
          <!-- 我（用户）-->
          <div class="member-item" @click="openPersonaSelector">
            <div class="member-avatar-wrapper">
              <div class="member-avatar user">
                <img v-if="boundPersona?.avatar" :src="boundPersona.avatar" />
                <span v-else>我</span>
              </div>
            </div>
            <div class="member-name">{{ boundPersona?.name || '我' }}</div>
            <div class="member-type user">我</div>
          </div>

          <!-- 其他成员列表 -->
          <div
            v-for="member in group.members"
            :key="member.id"
            class="member-item"
          >
            <div class="member-avatar-wrapper">
              <div class="member-avatar" :class="getMemberTypeClass(member.type)">
                <img v-if="member.avatar" :src="member.avatar" />
                <span v-else>{{ member.name?.[0] || '?' }}</span>
              </div>
              <!-- 编辑模式下显示删除按钮 -->
              <button
                v-if="isEditMode && group.members.length > 1"
                class="remove-btn"
                @click="removeMember(member.id)"
              >
                <Minus :size="12" />
              </button>
            </div>
            <div class="member-name">{{ member.name }}</div>
            <div class="member-type" :class="getMemberTypeClass(member.type)">
              {{ getMemberTypeLabel(member.type) }}
            </div>
          </div>

          <!-- 添加成员按钮 -->
          <div class="member-item add-btn" @click="addMember">
            <div class="member-avatar-wrapper">
              <div class="member-avatar add">
                <Plus :size="24" />
              </div>
            </div>
            <div class="member-name">添加</div>
          </div>
        </div>
      </div>

      <!-- 我的身份（人设选择） -->
      <div class="section">
        <div class="menu-item" @click="openPersonaSelector">
          <span class="menu-label">我的身份</span>
          <div class="menu-value">
            <span v-if="boundPersona">{{ boundPersona.name }}</span>
            <span v-else class="default-value">默认身份</span>
            <span v-if="personaSource" class="source-hint">{{ personaSource }}</span>
            <ChevronRight :size="18" class="chevron" />
          </div>
        </div>
      </div>

      <!-- 操作菜单 -->
      <div class="section menu-section">
        <div class="menu-item" @click="openClearConfirm">
          <span class="menu-label">清空聊天记录</span>
        </div>
        <div class="menu-item danger" @click="openDeleteConfirm">
          <span class="menu-label">删除并退出</span>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="isLoading" class="loading-tip">加载中...</div>

    <!-- 人设选择弹窗 -->
    <div v-if="showPersonaSelector" class="modal-overlay" @click.self="closePersonaSelector">
      <div class="selector-modal">
        <div class="selector-header">
          <span>选择身份</span>
        </div>
        <div class="selector-content">
          <!-- 默认身份选项 -->
          <div
            class="selector-item"
            :class="{ active: !group?.persona_id }"
            @click="selectPersona(null)"
          >
            <div class="selector-avatar default">
              <span>我</span>
            </div>
            <div class="selector-info">
              <div class="selector-name">默认身份</div>
              <div v-if="ownerProfile?.boundPersonaId" class="selector-hint">
                使用角色卡设置的人设
              </div>
            </div>
            <div v-if="!group?.persona_id" class="selector-check">&#10003;</div>
          </div>

          <!-- 人设列表 -->
          <div
            v-for="persona in personas"
            :key="persona.id"
            class="selector-item"
            :class="{ active: group?.persona_id === persona.id }"
            @click="selectPersona(persona.id)"
          >
            <div class="selector-avatar">
              <img v-if="persona.avatar" :src="persona.avatar" />
              <span v-else>{{ persona.name?.[0] || '?' }}</span>
            </div>
            <div class="selector-info">
              <div class="selector-name">{{ persona.name }}</div>
            </div>
            <div v-if="group?.persona_id === persona.id" class="selector-check">&#10003;</div>
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

    <!-- 群名称编辑弹窗 -->
    <div v-if="showNameEditor" class="modal-overlay" @click.self="closeNameEditor">
      <div class="editor-modal">
        <div class="editor-header">修改群聊名称</div>
        <div class="editor-content">
          <input
            type="text"
            v-model="editingName"
            placeholder="请输入群聊名称"
            maxlength="30"
            @keyup.enter="saveName"
          />
        </div>
        <div class="editor-footer">
          <button class="cancel-btn" @click="closeNameEditor">取消</button>
          <button class="confirm-btn primary" @click="saveName">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="closeDeleteConfirm">
      <div class="confirm-modal">
        <div class="confirm-title">删除群聊</div>
        <div class="confirm-message">
          确定要删除该群聊吗？所有聊天记录将被清除。
        </div>
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" @click="closeDeleteConfirm" :disabled="isDeleting">
            取消
          </button>
          <button class="confirm-btn danger" @click="confirmDeleteGroup" :disabled="isDeleting">
            {{ isDeleting ? '删除中...' : '删除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 清空聊天确认弹窗 -->
    <div v-if="showClearConfirm" class="modal-overlay" @click.self="closeClearConfirm">
      <div class="confirm-modal">
        <div class="confirm-title">清空聊天记录</div>
        <div class="confirm-message">
          确定要清空该群聊的所有聊天记录吗？
        </div>
        <div class="confirm-buttons">
          <button class="confirm-btn cancel" @click="closeClearConfirm" :disabled="isClearing">
            取消
          </button>
          <button class="confirm-btn danger" @click="confirmClearChats" :disabled="isClearing">
            {{ isClearing ? '清空中...' : '清空' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-info {
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

.icon-btn.text-btn {
  width: auto;
  padding: 0 8px;
  font-size: 15px;
  color: #576b95;
}

.content {
  flex: 1;
  overflow-y: auto;
}

.section {
  background: #fff;
  margin-bottom: 12px;
}

.group-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.group-name-row .label {
  font-size: 15px;
  color: #000;
}

.group-name-row .value {
  font-size: 15px;
  color: #999;
}

.section-title {
  padding: 12px 16px 8px;
  font-size: 14px;
  color: #999;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 8px 16px 16px;
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.member-avatar-wrapper {
  position: relative;
}

.member-avatar {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-avatar span {
  font-size: 20px;
  color: #fff;
}

/* 不同类型成员的头像边框 */
.member-avatar.char {
  border: 2px solid #576b95;
}

.member-avatar.npc {
  border: 2px solid #07c160;
}

.member-avatar.custom {
  border: 2px solid #ff9800;
}

.member-avatar.user {
  border: 2px solid #1989fa;
  background: #1989fa;
  cursor: pointer;
}

.member-avatar.add {
  background: #fff;
  border: 1px dashed #ccc;
  color: #999;
  cursor: pointer;
}

.member-item.add-btn {
  cursor: pointer;
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: #e53935;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-name {
  font-size: 12px;
  color: #333;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.member-type {
  font-size: 10px;
  color: #999;
  padding: 1px 4px;
  border-radius: 3px;
}

.member-type.char {
  background: #e8eef7;
  color: #576b95;
}

.member-type.npc {
  background: #e8f5e9;
  color: #07c160;
}

.member-type.custom {
  background: #fff3e0;
  color: #ff9800;
}

.member-type.user {
  background: #e6f4ff;
  color: #1989fa;
}

.menu-section {
  margin-top: 12px;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  font-size: 15px;
  color: #000;
}

.menu-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: #999;
}

.menu-value .default-value {
  color: #bbb;
}

.menu-value .source-hint {
  font-size: 12px;
  color: #bbb;
}

.menu-value .chevron {
  color: #ccc;
}

.menu-item.danger .menu-label {
  color: #e53935;
}

.loading-tip {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 0;
}

/* Modal */
.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.confirm-modal {
  width: calc(100% - 64px);
  max-width: 280px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: #000;
  margin-bottom: 12px;
}

.confirm-message {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
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
}

.confirm-btn.cancel {
  background: #f5f5f5;
  color: #333;
}

.confirm-btn.danger {
  background: #e53935;
  color: #fff;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 人设选择弹窗 */
.selector-modal {
  width: calc(100% - 32px);
  max-width: 320px;
  max-height: 70%;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.selector-header {
  padding: 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.selector-content {
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
  background: #f0fff4;
}

.selector-avatar {
  width: 44px;
  height: 44px;
  border-radius: 6px;
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

.selector-info {
  flex: 1;
  min-width: 0;
}

.selector-name {
  font-size: 15px;
  color: #000;
}

.selector-hint {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.selector-check {
  color: #07c160;
  font-size: 18px;
  font-weight: bold;
}

.selector-empty {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 24px 16px;
}

.selector-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 15px;
  color: #333;
  cursor: pointer;
}

.cancel-btn:active {
  background: #e8e8e8;
}

/* 群名称编辑弹窗 */
.editor-modal {
  width: calc(100% - 32px);
  max-width: 320px;
  background: #fff;
  border-radius: 12px;
}

.editor-header {
  padding: 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.editor-content {
  padding: 16px;
}

.editor-content input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
}

.editor-content input:focus {
  border-color: #07c160;
}

.editor-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.editor-footer .cancel-btn {
  flex: 1;
  width: auto;
}

.editor-footer .confirm-btn.primary {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #07c160;
  font-size: 15px;
  color: #fff;
  cursor: pointer;
}

.editor-footer .confirm-btn.primary:active {
  background: #06ad56;
}
</style>
