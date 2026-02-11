<script setup>
import { ref, onMounted, watch } from 'vue'
import { X, Upload, Trash2, Plus } from 'lucide-vue-next'
import { createCharacter, updateCharacter } from '../../../services/api.js'

const props = defineProps({
  character: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['saved', 'cancel'])

const form = ref({
  name: '',
  avatar: '',
  portrait: '',
  bio: '',
  persona: '',
  greeting: '',
  isPublic: false,
  npcs: []
})

const saving = ref(false)

// NPC 文件输入引用
const npcAvatarInputs = ref({})

onMounted(() => {
  if (props.character) {
    form.value = {
      ...props.character,
      npcs: props.character.npcs || []
    }
  }
})

watch(() => props.character, (char) => {
  if (char) {
    form.value = {
      ...char,
      npcs: char.npcs || []
    }
  } else {
    form.value = {
      name: '',
      avatar: '',
      portrait: '',
      bio: '',
      persona: '',
      greeting: '',
      isPublic: false,
      npcs: []
    }
  }
})

// 添加新 NPC
function addNpc() {
  form.value.npcs.push({
    id: Date.now().toString(),
    name: '',
    avatar: '',
    relation: '',
    bio: '',
    persona: ''
  })
}

// 删除 NPC
function removeNpc(index) {
  form.value.npcs.splice(index, 1)
}

// 处理 NPC 头像上传
function handleNpcAvatarUpload(event, index) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    form.value.npcs[index].avatar = e.target.result
  }
  reader.readAsDataURL(file)
}

// 触发 NPC 头像选择
function triggerNpcAvatarUpload(index) {
  const input = document.getElementById(`npc-avatar-input-${index}`)
  if (input) input.click()
}

function handleImageUpload(event, field) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    form.value[field] = e.target.result
  }
  reader.readAsDataURL(file)
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    alert('请输入角色名称')
    return
  }

  // 过滤掉没有名字的空 NPC
  const validNpcs = form.value.npcs.filter(npc => npc.name && npc.name.trim())

  saving.value = true
  try {
    const dataToSave = {
      ...form.value,
      npcs: validNpcs
    }

    if (props.character) {
      await updateCharacter(props.character.id, dataToSave)
    } else {
      await createCharacter(dataToSave)
    }
    emit('saved')
  } catch (e) {
    alert('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="character-form">
    <div class="form-header">
      <h3>{{ character ? '编辑角色' : '创建角色' }}</h3>
      <button class="close-btn" @click="emit('cancel')">
        <X :size="20" />
      </button>
    </div>

    <div class="form-body">
      <!-- 图片上传区 -->
      <div class="image-row">
        <div class="form-group">
          <label>头像</label>
          <div class="image-upload small">
            <img v-if="form.avatar" :src="form.avatar" class="preview" />
            <div v-else class="placeholder">
              <Upload :size="20" />
            </div>
            <input type="file" accept="image/*" @change="(e) => handleImageUpload(e, 'avatar')" />
          </div>
        </div>
        <div class="form-group flex-1">
          <label>立绘（可选）</label>
          <div class="image-upload wide">
            <img v-if="form.portrait" :src="form.portrait" class="preview" />
            <div v-else class="placeholder">
              <Upload :size="20" />
              <span>聊天背景</span>
            </div>
            <input type="file" accept="image/*" @change="(e) => handleImageUpload(e, 'portrait')" />
          </div>
        </div>
      </div>

      <!-- 名称 -->
      <div class="form-group">
        <label>名称 *</label>
        <input v-model="form.name" type="text" placeholder="角色名称" class="input" />
      </div>

      <!-- 简介 -->
      <div class="form-group">
        <label>简介（公开显示）</label>
        <textarea v-model="form.bio" placeholder="简短介绍..." class="input textarea" rows="2" />
      </div>

      <!-- 核心设定 -->
      <div class="form-group">
        <label>核心设定（Persona）</label>
        <textarea v-model="form.persona" placeholder="性格、背景、说话方式..." class="input textarea" rows="3" />
      </div>

      <!-- 开场白 -->
      <div class="form-group">
        <label>开场白</label>
        <textarea v-model="form.greeting" placeholder="角色的第一句话..." class="input textarea" rows="2" />
      </div>

      <!-- 公开性 -->
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="form.isPublic" />
          <span>公开到角色广场</span>
        </label>
      </div>

      <!-- NPC 关系组分界线 -->
      <div class="section-divider">
        <span class="divider-line"></span>
        <span class="divider-title">NPC 关系组</span>
        <span class="divider-line"></span>
      </div>

      <!-- NPC 卡片列表 -->
      <div class="npc-list">
        <div v-for="(npc, index) in form.npcs" :key="npc.id || index" class="npc-card">
          <!-- 第一行：头像、姓名、关系、删除按钮 -->
          <div class="npc-row-1">
            <!-- 头像上传 -->
            <div class="npc-avatar" @click="triggerNpcAvatarUpload(index)">
              <img v-if="npc.avatar" :src="npc.avatar" class="avatar-preview" />
              <div v-else class="avatar-placeholder">
                <Upload :size="18" />
              </div>
              <input
                :id="`npc-avatar-input-${index}`"
                type="file"
                accept="image/*"
                class="hidden-input"
                @change="(e) => handleNpcAvatarUpload(e, index)"
              />
            </div>

            <!-- 姓名和关系 -->
            <div class="npc-info">
              <input
                v-model="npc.name"
                type="text"
                placeholder="姓名"
                class="input npc-input"
              />
              <input
                v-model="npc.relation"
                type="text"
                placeholder="和Char关系"
                class="input npc-input"
              />
            </div>

            <!-- 删除按钮 -->
            <button class="npc-delete-btn" @click="removeNpc(index)" title="删除此NPC">
              <Trash2 :size="16" />
            </button>
          </div>

          <!-- 第二行：NPC 简介 -->
          <div class="npc-row">
            <textarea
              v-model="npc.bio"
              placeholder="NPC简介 (100字以内)"
              class="input textarea npc-textarea"
              rows="2"
              maxlength="100"
            />
          </div>

          <!-- 第三行：NPC 人设 -->
          <div class="npc-row">
            <textarea
              v-model="npc.persona"
              placeholder="NPC详细人设 (300字以内)"
              class="input textarea npc-textarea"
              rows="4"
              maxlength="300"
            />
          </div>
        </div>

        <!-- 添加新 NPC 按钮 -->
        <button class="add-npc-btn" @click="addNpc">
          <Plus :size="18" />
          <span>添加新 NPC</span>
        </button>
      </div>
    </div>

    <div class="form-footer">
      <button class="btn cancel" @click="emit('cancel')">取消</button>
      <button class="btn save" @click="handleSubmit" :disabled="saving">
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.character-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.form-header h3 {
  margin: 0;
  font-size: 15px;
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

.form-body {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  padding-bottom: 20px;
  /* 隐藏滚动条但保留滚动功能 */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.form-body::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

.form-footer {
  flex-shrink: 0;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.image-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.flex-1 {
  flex: 1;
}

.image-upload {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: #333;
  cursor: pointer;
}

.image-upload.small {
  width: 64px;
  height: 64px;
}

.image-upload.wide {
  width: 100%;
  height: 64px;
}

.image-upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.image-upload .preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-upload .placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
  gap: 2px;
  font-size: 11px;
}

.input {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: #333;
  color: #fff;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.input::placeholder {
  color: #666;
}

.input:focus {
  background: #3a3a3a;
}

.textarea {
  resize: none;
  font-family: inherit;
  line-height: 1.4;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: #9c27b0;
}

.checkbox-label span {
  color: #fff;
  font-size: 13px;
}

.form-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.cancel {
  background: #333;
  color: #fff;
}

.btn.save {
  background: #9c27b0;
  color: #fff;
}

/* ==================== NPC 关系组样式 ==================== */

.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: #444;
}

.divider-title {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
}

.npc-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.npc-card {
  border: 1px solid #444;
  border-radius: 10px;
  padding: 12px;
  background: #2a2a2a;
}

.npc-row-1 {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

.npc-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: #3a3a3a;
  border: 1px dashed #555;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.npc-avatar:hover {
  border-color: #9c27b0;
}

.npc-avatar .avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.npc-avatar .avatar-placeholder {
  color: #666;
}

.npc-avatar .hidden-input {
  display: none;
}

.npc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.npc-input {
  padding: 8px 10px;
  font-size: 13px;
}

.npc-delete-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.npc-delete-btn:hover {
  background: rgba(244, 67, 54, 0.3);
}

.npc-row {
  margin-top: 8px;
}

.npc-textarea {
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
}

.add-npc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1px dashed #555;
  border-radius: 10px;
  background: transparent;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-npc-btn:hover {
  border-color: #9c27b0;
  color: #9c27b0;
  background: rgba(156, 39, 176, 0.08);
}
</style>
