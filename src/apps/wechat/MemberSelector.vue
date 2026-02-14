<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Check, X, Upload, Users } from 'lucide-vue-next'
import {
  getMyCharacters,
  getCustomNpcs,
  createCustomNpc,
  getCharacterForChat
} from '../../services/api.js'

const props = defineProps({
  // 当前群组已有的成员 ID 列表
  existingMemberIds: { type: Array, default: () => [] },
  // 主角 ID（发起群聊的角色卡，其自身不应出现在选择列表中）
  ownerCharId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'select'])

const activeTab = ref('existing') // 'existing' | 'custom'

// 所有角色卡下的 NPC（从角色卡的 npcs 数组中提取）
const allPresetNpcs = ref([])

// 自建 NPC
const customNpcs = ref([])

// 选中的成员
const selectedMembers = ref([])

// 新建 NPC 表单
const showCreateForm = ref(false)
const newNpcForm = ref({
  name: '',
  avatar: '',
  personality: ''
})
const isCreating = ref(false)

const isLoading = ref(false)
const isSubmitting = ref(false)

// 可选的预设 NPC（排除已在群里的）
const availablePresetNpcs = computed(() => {
  return allPresetNpcs.value.filter(n => !props.existingMemberIds.includes(n.id))
})

// 可选的自建 NPC（排除已在群里的）
const availableCustomNpcs = computed(() => {
  return customNpcs.value.filter(n => !props.existingMemberIds.includes(n.id))
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  isLoading.value = true
  try {
    const [chars, customNpcList] = await Promise.all([
      getMyCharacters(),
      getCustomNpcs()
    ])
    customNpcs.value = customNpcList

    // 只从当前角色卡中提取 NPC 关系组
    const npcs = []
    if (props.ownerCharId) {
      // 先从自己的角色列表中查找
      let ownerChar = chars.find(c => c.id === props.ownerCharId)

      // 如果找不到（可能是广场角色），则单独获取角色数据
      if (!ownerChar) {
        try {
          ownerChar = await getCharacterForChat(props.ownerCharId)
        } catch (e) {
          console.warn('获取角色数据失败:', e)
        }
      }

      if (ownerChar && ownerChar.npcs && Array.isArray(ownerChar.npcs)) {
        for (const npc of ownerChar.npcs) {
          npcs.push({
            id: npc.id,
            name: npc.name,
            avatar: npc.avatar,
            relation: npc.relation,
            bio: npc.bio,
            persona: npc.persona,
            fromCharId: ownerChar.id,
            fromCharName: ownerChar.name
          })
        }
      }
    }

    allPresetNpcs.value = npcs
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    isLoading.value = false
  }
}

function toggleSelect(member, type) {
  const index = selectedMembers.value.findIndex(m => m.id === member.id)
  if (index >= 0) {
    selectedMembers.value.splice(index, 1)
  } else {
    selectedMembers.value.push({
      id: member.id,
      type,
      name: member.name,
      avatar: member.avatar
    })
  }
}

function isSelected(memberId) {
  return selectedMembers.value.some(m => m.id === memberId)
}

function confirmSelection() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  emit('select', selectedMembers.value)
}

function close() {
  emit('close')
}

function openCreateForm() {
  showCreateForm.value = true
  newNpcForm.value = { name: '', avatar: '', personality: '' }
}

function closeCreateForm() {
  showCreateForm.value = false
}

async function createNpc() {
  if (!newNpcForm.value.name.trim()) {
    alert('请输入 NPC 名称')
    return
  }

  isCreating.value = true
  try {
    const npc = await createCustomNpc({
      name: newNpcForm.value.name.trim(),
      avatar: newNpcForm.value.avatar,
      personality: newNpcForm.value.personality.trim()
    })
    customNpcs.value.push(npc)
    // 自动选中新创建的 NPC
    selectedMembers.value.push({
      id: npc.id,
      type: 'custom',
      name: npc.name,
      avatar: npc.avatar
    })
    closeCreateForm()
  } catch (e) {
    console.error('创建 NPC 失败:', e)
    alert('创建失败: ' + e.message)
  } finally {
    isCreating.value = false
  }
}

// 头像上传
function triggerAvatarUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        newNpcForm.value.avatar = ev.target.result
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}
</script>

<template>
  <div class="member-selector">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="close">
        <X :size="22" />
      </button>
      <span class="title">选择成员</span>
      <button
        class="icon-btn text-btn"
        :class="{ active: selectedMembers.length > 0 }"
        @click="confirmSelection"
        :disabled="selectedMembers.length === 0 || isSubmitting"
      >
        {{ isSubmitting ? '处理中...' : `完成 (${selectedMembers.length})` }}
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'existing' }"
        @click="activeTab = 'existing'"
      >
        已有角色
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'custom' }"
        @click="activeTab = 'custom'"
      >
        自建角色
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content">
      <!-- 已有角色 Tab（只显示角色卡的 NPC 关系组） -->
      <template v-if="activeTab === 'existing'">
        <div v-if="isLoading" class="loading-tip">加载中...</div>

        <template v-else>
          <!-- 预设 NPC 列表（来自角色卡的 NPC 关系组） -->
          <div v-if="availablePresetNpcs.length > 0" class="list-section">
            <div class="section-title">
              <Users :size="14" />
              <span>角色 NPC</span>
            </div>
            <div
              v-for="npc in availablePresetNpcs"
              :key="npc.id"
              class="member-row"
              @click="toggleSelect(npc, 'preset')"
            >
              <div class="checkbox" :class="{ checked: isSelected(npc.id) }">
                <Check v-if="isSelected(npc.id)" :size="14" />
              </div>
              <div class="member-avatar npc-avatar">
                <img v-if="npc.avatar" :src="npc.avatar" />
                <span v-else>{{ npc.name?.[0] || '?' }}</span>
              </div>
              <div class="member-info">
                <div class="member-name">
                  {{ npc.name }}
                  <span class="type-badge npc">NPC</span>
                </div>
                <div class="member-desc">
                  {{ npc.relation || 'NPC' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-if="availablePresetNpcs.length === 0"
            class="empty-tip"
          >
            没有可添加的 NPC
            <p class="empty-hint">请先在角色卡中添加 NPC 关系组</p>
          </div>
        </template>
      </template>

      <!-- 自建角色 Tab -->
      <template v-if="activeTab === 'custom'">
        <div class="list-section">
          <div class="section-title">
            <Plus :size="14" />
            <span>自建 NPC</span>
          </div>

          <!-- 自建 NPC 列表 -->
          <div
            v-for="npc in availableCustomNpcs"
            :key="npc.id"
            class="member-row"
            @click="toggleSelect(npc, 'custom')"
          >
            <div class="checkbox" :class="{ checked: isSelected(npc.id) }">
              <Check v-if="isSelected(npc.id)" :size="14" />
            </div>
            <div class="member-avatar custom-avatar">
              <img v-if="npc.avatar" :src="npc.avatar" />
              <span v-else>{{ npc.name?.[0] || '?' }}</span>
            </div>
            <div class="member-info">
              <div class="member-name">
                {{ npc.name }}
                <span class="type-badge custom">自建</span>
              </div>
              <div class="member-desc">{{ npc.personality?.slice(0, 30) || '自建角色' }}</div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="availableCustomNpcs.length === 0" class="empty-tip small">
            暂无自建 NPC
          </div>

          <!-- 新建按钮 -->
          <div class="create-btn" @click="openCreateForm">
            <Plus :size="20" />
            <span>新建 NPC</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 新建 NPC 表单 Modal -->
    <div v-if="showCreateForm" class="modal-overlay" @click.self="closeCreateForm">
      <div class="create-modal">
        <div class="modal-header">
          <span>新建 NPC</span>
          <button class="close-btn" @click="closeCreateForm">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-content">
          <!-- 头像上传 -->
          <div class="form-row avatar-row">
            <div class="avatar-preview" @click="triggerAvatarUpload">
              <img v-if="newNpcForm.avatar" :src="newNpcForm.avatar" />
              <div v-else class="avatar-placeholder">
                <Upload :size="24" />
                <span>上传头像</span>
              </div>
            </div>
          </div>

          <!-- 名称 -->
          <div class="form-row">
            <label>名称 <span class="required">*</span></label>
            <input
              type="text"
              v-model="newNpcForm.name"
              placeholder="输入 NPC 名称"
              maxlength="20"
            />
          </div>

          <!-- 性格/人设 -->
          <div class="form-row">
            <label>性格/人设</label>
            <textarea
              v-model="newNpcForm.personality"
              placeholder="描述 NPC 的性格特点、说话风格等，越详细 AI 扮演越准确"
              rows="4"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeCreateForm" :disabled="isCreating">
            取消
          </button>
          <button class="submit-btn" @click="createNpc" :disabled="isCreating || !newNpcForm.name.trim()">
            {{ isCreating ? '创建中...' : '创建并添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-selector {
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

.icon-btn.text-btn {
  width: auto;
  padding: 0 12px;
  font-size: 15px;
  color: #999;
}

.icon-btn.text-btn.active {
  color: #07c160;
}

.icon-btn.text-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.tab-btn {
  flex: 1;
  padding: 14px;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #666;
  cursor: pointer;
  position: relative;
}

.tab-btn.active {
  color: #07c160;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 2px;
  background: #07c160;
}

.content {
  flex: 1;
  overflow-y: auto;
}

.list-section {
  background: #fff;
  margin-bottom: 12px;
}

.section-title {
  padding: 12px 16px 8px;
  font-size: 13px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.member-row:active {
  background: #f5f5f5;
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid #d9d9d9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox.checked {
  background: #07c160;
  border-color: #07c160;
  color: #fff;
}

.member-avatar {
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

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-avatar span {
  font-size: 18px;
  color: #fff;
}

/* 不同类型头像的边框颜色 */
.member-avatar.char-avatar {
  border: 2px solid #576b95;
}

.member-avatar.npc-avatar {
  border: 2px solid #07c160;
}

.member-avatar.custom-avatar {
  border: 2px solid #ff9800;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 16px;
  color: #000;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 类型标签 */
.type-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.type-badge.char {
  background: #e8eef7;
  color: #576b95;
}

.type-badge.npc {
  background: #e8f5e9;
  color: #07c160;
}

.type-badge.custom {
  background: #fff3e0;
  color: #ff9800;
}

.member-desc {
  font-size: 13px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.from-char {
  color: #bbb;
  font-size: 12px;
}

.loading-tip, .empty-tip {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 0;
}

.empty-tip.small {
  padding: 20px 0;
}

.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #07c160;
  font-size: 15px;
  cursor: pointer;
  border-top: 1px solid #f0f0f0;
}

.create-btn:active {
  background: #f5f5f5;
}

.empty-hint {
  font-size: 12px;
  color: #bbb;
  margin-top: 8px;
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

.create-modal {
  width: calc(100% - 32px);
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  max-height: 80%;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 17px;
  font-weight: 500;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

.form-row .required {
  color: #e53935;
}

.form-row input,
.form-row textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
}

.form-row input:focus,
.form-row textarea:focus {
  border-color: #07c160;
}

.form-row textarea {
  resize: none;
  line-height: 1.5;
}

.avatar-row {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #999;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn, .submit-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.cancel-btn {
  background: #f5f5f5;
  color: #333;
}

.submit-btn {
  background: #07c160;
  color: #fff;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
