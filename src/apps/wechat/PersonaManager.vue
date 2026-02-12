<script setup>
import { ref, onMounted } from 'vue'
import { ArrowLeft, Plus, Edit2, Trash2, X, Camera } from 'lucide-vue-next'
import { getPersonas, createPersona, updatePersona, deletePersona } from '../../services/api.js'

const emit = defineEmits(['back'])

const personas = ref([])
const loading = ref(false)

// 编辑器状态
const showEditor = ref(false)
const editingPersona = ref(null)
const editorForm = ref({
  name: '',
  avatar: '',
  description: '',
  initialBalance: ''
})

// 删除确认
const showDeleteConfirm = ref(false)
const deletingPersona = ref(null)

onMounted(async () => {
  await loadPersonas()
})

async function loadPersonas() {
  loading.value = true
  try {
    personas.value = await getPersonas()
  } catch (e) {
    console.error('加载人设列表失败:', e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  emit('back')
}

// 打开创建人设
function openCreateEditor() {
  editingPersona.value = null
  editorForm.value = {
    name: '',
    avatar: '',
    description: '',
    initialBalance: ''
  }
  showEditor.value = true
}

// 打开编辑人设
function openEditEditor(persona) {
  editingPersona.value = persona
  editorForm.value = {
    name: persona.name,
    avatar: persona.avatar || '',
    description: persona.description || '',
    initialBalance: persona.initialBalance !== undefined ? String(persona.initialBalance) : ''
  }
  showEditor.value = true
}

// 关闭编辑器
function closeEditor() {
  showEditor.value = false
  editingPersona.value = null
}

// 保存人设
async function savePersona() {
  if (!editorForm.value.name.trim()) {
    alert('请输入人设名称')
    return
  }

  // 解析初始金额
  const balanceStr = String(editorForm.value.initialBalance || '').trim()
  const initialBalance = balanceStr ? parseFloat(balanceStr) : undefined

  try {
    if (editingPersona.value) {
      // 更新
      const updated = await updatePersona(editingPersona.value.id, {
        name: editorForm.value.name.trim(),
        avatar: editorForm.value.avatar,
        description: editorForm.value.description,
        initialBalance: initialBalance
      })
      // 本地响应式更新
      const index = personas.value.findIndex(p => p.id === editingPersona.value.id)
      if (index !== -1) {
        personas.value[index] = updated
      }
    } else {
      // 创建
      const created = await createPersona({
        name: editorForm.value.name.trim(),
        avatar: editorForm.value.avatar,
        description: editorForm.value.description,
        initialBalance: initialBalance
      })
      // 本地响应式添加
      personas.value.push(created)
    }
    closeEditor()
  } catch (e) {
    console.error('保存人设失败:', e)
    alert('保存失败: ' + e.message)
  }
}

// 打开删除确认
function openDeleteConfirm(persona) {
  deletingPersona.value = persona
  showDeleteConfirm.value = true
}

// 关闭删除确认
function closeDeleteConfirm() {
  showDeleteConfirm.value = false
  deletingPersona.value = null
}

// 确认删除
async function confirmDelete() {
  if (!deletingPersona.value) return

  try {
    await deletePersona(deletingPersona.value.id)
    // 本地响应式更新
    personas.value = personas.value.filter(p => p.id !== deletingPersona.value.id)
    closeDeleteConfirm()
  } catch (e) {
    console.error('删除人设失败:', e)
    alert('删除失败: ' + e.message)
  }
}

// 头像上传
const avatarInputRef = ref(null)

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
</script>

<template>
  <div class="persona-manager">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">我的人设</span>
      <button class="icon-btn" @click="openCreateEditor">
        <Plus :size="22" />
      </button>
    </div>

    <!-- 人设列表 -->
    <div class="persona-list">
      <div v-if="loading" class="loading-tip">加载中...</div>

      <div v-else-if="personas.length === 0" class="empty-tip">
        <p>暂无人设</p>
        <p class="hint">点击右上角 + 创建你的第一个人设</p>
      </div>

      <div
        v-else
        v-for="persona in personas"
        :key="persona.id"
        class="persona-card"
      >
        <div class="persona-avatar">
          <img v-if="persona.avatar" :src="persona.avatar" />
          <span v-else>{{ persona.name?.[0] || '?' }}</span>
        </div>
        <div class="persona-info">
          <div class="persona-name">{{ persona.name }}</div>
          <div class="persona-desc">{{ persona.description || '暂无描述' }}</div>
        </div>
        <div class="persona-actions">
          <button class="action-btn" @click="openEditEditor(persona)">
            <Edit2 :size="18" />
          </button>
          <button class="action-btn delete" @click="openDeleteConfirm(persona)">
            <Trash2 :size="18" />
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑器 Modal -->
    <Teleport to="body">
      <div v-if="showEditor" class="modal-overlay" @click.self="closeEditor">
        <div class="modal-content">
          <div class="modal-header">
            <span>{{ editingPersona ? '编辑人设' : '创建人设' }}</span>
            <button class="close-btn" @click="closeEditor">
              <X :size="20" />
            </button>
          </div>

          <div class="modal-body">
            <!-- 头像上传 -->
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

            <!-- 昵称 -->
            <div class="form-group">
              <label>昵称</label>
              <input
                v-model="editorForm.name"
                type="text"
                placeholder="输入人设昵称"
                maxlength="20"
              />
            </div>

            <!-- 人设描述 -->
            <div class="form-group">
              <label>人设描述</label>
              <textarea
                v-model="editorForm.description"
                placeholder="描述这个人设的背景、性格、身份等..."
                rows="3"
              ></textarea>
            </div>

            <!-- 初始金额 -->
            <div class="form-group">
              <label>银行卡初始金额</label>
              <div class="balance-input-wrapper">
                <span class="currency-symbol">¥</span>
                <input
                  v-model="editorForm.initialBalance"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div class="form-hint">设置该人设银行卡的初始余额</div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn cancel" @click="closeEditor">取消</button>
            <button class="btn primary" @click="savePersona">保存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认 Modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="closeDeleteConfirm">
        <div class="modal-content confirm-modal">
          <div class="confirm-text">
            确定要删除人设 "{{ deletingPersona?.name }}" 吗？
          </div>
          <div class="confirm-actions">
            <button class="btn cancel" @click="closeDeleteConfirm">取消</button>
            <button class="btn danger" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.persona-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #222;
  border-bottom: 1px solid #333;
}

.header .title {
  font-size: 17px;
  font-weight: 500;
  color: #fff;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 人设列表 */
.persona-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.persona-list::-webkit-scrollbar {
  display: none;
}

.loading-tip,
.empty-tip {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 14px;
}

.empty-tip .hint {
  margin-top: 8px;
  font-size: 12px;
  color: #555;
}

/* 人设卡片 */
.persona-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #222;
  border-radius: 12px;
  margin-bottom: 12px;
}

.persona-avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.persona-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.persona-avatar span {
  font-size: 24px;
  color: #888;
}

.persona-info {
  flex: 1;
  min-width: 0;
}

.persona-name {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.persona-desc {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.persona-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #333;
  color: #aaa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #444;
  color: #fff;
}

.action-btn.delete:hover {
  background: #e53935;
  color: #fff;
}

/* Modal 样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-content {
  width: 85%;
  max-width: 320px;
  max-height: 85vh;
  background: #222;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.modal-header span {
  font-size: 17px;
  font-weight: 500;
  color: #fff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
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
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* 头像上传 */
.avatar-upload {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  cursor: pointer;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview span {
  font-size: 32px;
  color: #666;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  color: #fff;
  font-size: 12px;
}

.avatar-upload:hover .avatar-overlay {
  opacity: 1;
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #888;
  margin-bottom: 8px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #1a1a1a;
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #07c160;
}

.form-group textarea {
  resize: none;
  font-family: inherit;
}

.balance-input-wrapper {
  display: flex;
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0 12px;
  transition: border-color 0.2s;
}

.balance-input-wrapper:focus-within {
  border-color: #07c160;
}

.currency-symbol {
  color: #888;
  font-size: 16px;
  margin-right: 4px;
}

.balance-input-wrapper input {
  flex: 1;
  padding: 12px 0;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 15px;
  outline: none;
}

.balance-input-wrapper input::-webkit-outer-spin-button,
.balance-input-wrapper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.balance-input-wrapper input[type=number] {
  -moz-appearance: textfield;
}

.form-hint {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.cancel {
  background: #333;
  color: #fff;
}

.btn.cancel:hover {
  background: #444;
}

.btn.primary {
  background: #07c160;
  color: #fff;
}

.btn.primary:hover {
  background: #06ad56;
}

.btn.danger {
  background: #e53935;
  color: #fff;
}

.btn.danger:hover {
  background: #c62828;
}

/* 确认弹窗 */
.confirm-modal {
  padding: 24px;
  text-align: center;
}

.confirm-text {
  font-size: 16px;
  color: #fff;
  margin-bottom: 24px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}
</style>
