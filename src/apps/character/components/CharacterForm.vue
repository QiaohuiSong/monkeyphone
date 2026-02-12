<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { X, Upload, Trash2, Plus, Check } from 'lucide-vue-next'
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

// ==================== 头像裁剪相关 ====================
const showCropper = ref(false)
const cropperImage = ref('')
const cropperTarget = ref(null) // 'avatar' | { type: 'npc', index: number }
const cropperContainer = ref(null)
const cropBox = ref({ x: 0, y: 0, size: 100 })
const imageInfo = ref({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 })
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const cropStart = ref({ x: 0, y: 0, size: 0 })

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

// 处理 NPC 头像上传（改为打开裁剪器）
function handleNpcAvatarUpload(event, index) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    openCropper(e.target.result, { type: 'npc', index })
  }
  reader.readAsDataURL(file)
  event.target.value = ''
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
    if (field === 'avatar') {
      // 头像需要裁剪
      openCropper(e.target.result, 'avatar')
    } else {
      // 立绘直接使用
      form.value[field] = e.target.result
    }
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

// ==================== 裁剪器函数 ====================

function openCropper(imageSrc, target) {
  cropperImage.value = imageSrc
  cropperTarget.value = target
  showCropper.value = true

  nextTick(() => {
    initCropper()
  })
}

function initCropper() {
  const img = new Image()
  img.onload = () => {
    const container = cropperContainer.value
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const maxWidth = containerRect.width - 20
    const maxHeight = containerRect.height - 20

    // 计算适合容器的图片显示尺寸
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    const displayWidth = img.width * scale
    const displayHeight = img.height * scale

    imageInfo.value = {
      width: displayWidth,
      height: displayHeight,
      naturalWidth: img.width,
      naturalHeight: img.height
    }

    // 初始化裁剪框（居中，尽可能大的正方形）
    const minDim = Math.min(displayWidth, displayHeight)
    const initialSize = Math.min(minDim * 0.8, 200)
    cropBox.value = {
      x: (displayWidth - initialSize) / 2,
      y: (displayHeight - initialSize) / 2,
      size: initialSize
    }
  }
  img.src = cropperImage.value
}

function onCropMouseDown(e, action) {
  e.preventDefault()
  e.stopPropagation()

  const touch = e.touches ? e.touches[0] : e
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  cropStart.value = { ...cropBox.value }

  if (action === 'move') {
    isDragging.value = true
  } else if (action === 'resize') {
    isResizing.value = true
  }

  document.addEventListener('mousemove', onCropMouseMove)
  document.addEventListener('mouseup', onCropMouseUp)
  document.addEventListener('touchmove', onCropMouseMove, { passive: false })
  document.addEventListener('touchend', onCropMouseUp)
}

function onCropMouseMove(e) {
  e.preventDefault()
  const touch = e.touches ? e.touches[0] : e
  const dx = touch.clientX - dragStart.value.x
  const dy = touch.clientY - dragStart.value.y

  const { width, height } = imageInfo.value

  if (isDragging.value) {
    let newX = cropStart.value.x + dx
    let newY = cropStart.value.y + dy

    // 边界限制
    newX = Math.max(0, Math.min(width - cropBox.value.size, newX))
    newY = Math.max(0, Math.min(height - cropBox.value.size, newY))

    cropBox.value.x = newX
    cropBox.value.y = newY
  } else if (isResizing.value) {
    // 从右下角拖拽调整大小
    const delta = Math.max(dx, dy)
    let newSize = cropStart.value.size + delta

    // 最小/最大限制
    const minSize = 50
    const maxSize = Math.min(
      width - cropBox.value.x,
      height - cropBox.value.y
    )
    newSize = Math.max(minSize, Math.min(maxSize, newSize))

    cropBox.value.size = newSize
  }
}

function onCropMouseUp() {
  isDragging.value = false
  isResizing.value = false
  document.removeEventListener('mousemove', onCropMouseMove)
  document.removeEventListener('mouseup', onCropMouseUp)
  document.removeEventListener('touchmove', onCropMouseMove)
  document.removeEventListener('touchend', onCropMouseUp)
}

function confirmCrop() {
  const { width, height, naturalWidth, naturalHeight } = imageInfo.value
  const { x, y, size } = cropBox.value

  // 计算实际图片上的裁剪区域
  const scaleX = naturalWidth / width
  const scaleY = naturalHeight / height

  const cropX = x * scaleX
  const cropY = y * scaleY
  const cropSize = size * Math.max(scaleX, scaleY)

  // 创建 canvas 进行裁剪
  const canvas = document.createElement('canvas')
  const outputSize = 256 // 输出尺寸
  canvas.width = outputSize
  canvas.height = outputSize

  const ctx = canvas.getContext('2d')
  const img = new Image()

  img.onload = () => {
    ctx.drawImage(
      img,
      cropX, cropY, cropSize, cropSize,
      0, 0, outputSize, outputSize
    )

    const croppedData = canvas.toDataURL('image/png')

    // 应用到对应目标
    if (cropperTarget.value === 'avatar') {
      form.value.avatar = croppedData
    } else if (cropperTarget.value?.type === 'npc') {
      const index = cropperTarget.value.index
      if (form.value.npcs[index]) {
        form.value.npcs[index].avatar = croppedData
      }
    }

    closeCropper()
  }

  img.src = cropperImage.value
}

function closeCropper() {
  showCropper.value = false
  cropperImage.value = ''
  cropperTarget.value = null
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

    <!-- 头像裁剪弹窗 -->
    <Teleport to="body">
      <div v-if="showCropper" class="cropper-overlay" @click.self="closeCropper">
        <div class="cropper-modal">
          <div class="cropper-header">
            <span>裁剪头像</span>
            <button class="cropper-close" @click="closeCropper">
              <X :size="18" />
            </button>
          </div>
          <div ref="cropperContainer" class="cropper-container">
            <div class="cropper-image-wrapper" :style="{ width: imageInfo.width + 'px', height: imageInfo.height + 'px' }">
              <img :src="cropperImage" class="cropper-image" />
              <!-- 暗色遮罩层 -->
              <div class="cropper-mask"></div>
              <!-- 裁剪框 -->
              <div
                class="crop-box"
                :style="{
                  left: cropBox.x + 'px',
                  top: cropBox.y + 'px',
                  width: cropBox.size + 'px',
                  height: cropBox.size + 'px'
                }"
                @mousedown="(e) => onCropMouseDown(e, 'move')"
                @touchstart="(e) => onCropMouseDown(e, 'move')"
              >
                <!-- 网格线 -->
                <div class="crop-grid">
                  <div class="grid-line horizontal" style="top: 33.33%"></div>
                  <div class="grid-line horizontal" style="top: 66.66%"></div>
                  <div class="grid-line vertical" style="left: 33.33%"></div>
                  <div class="grid-line vertical" style="left: 66.66%"></div>
                </div>
                <!-- 右下角拖拽手柄 -->
                <div
                  class="resize-handle"
                  @mousedown.stop="(e) => onCropMouseDown(e, 'resize')"
                  @touchstart.stop="(e) => onCropMouseDown(e, 'resize')"
                ></div>
              </div>
            </div>
          </div>
          <div class="cropper-footer">
            <button class="cropper-btn cancel" @click="closeCropper">取消</button>
            <button class="cropper-btn confirm" @click="confirmCrop">
              <Check :size="16" />
              <span>确认</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

/* ==================== 头像裁剪器样式 ==================== */

.cropper-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.cropper-modal {
  width: 90%;
  max-width: 360px;
  background: #1e1e1e;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cropper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #333;
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.cropper-close {
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

.cropper-close:hover {
  background: #333;
  color: #fff;
}

.cropper-container {
  position: relative;
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
  overflow: hidden;
}

.cropper-image-wrapper {
  position: relative;
  user-select: none;
}

.cropper-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.cropper-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.crop-box {
  position: absolute;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  cursor: move;
  box-sizing: border-box;
  touch-action: none;
}

.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.3);
}

.grid-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
}

.grid-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.resize-handle {
  position: absolute;
  right: -8px;
  bottom: -8px;
  width: 20px;
  height: 20px;
  background: #9c27b0;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: se-resize;
  touch-action: none;
}

.cropper-footer {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #333;
}

.cropper-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.2s;
}

.cropper-btn.cancel {
  background: #333;
  color: #fff;
}

.cropper-btn.cancel:hover {
  background: #444;
}

.cropper-btn.confirm {
  background: #9c27b0;
  color: #fff;
}

.cropper-btn.confirm:hover {
  background: #7b1fa2;
}
</style>
