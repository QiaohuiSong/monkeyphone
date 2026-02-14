<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Edit2, Trash2, Download, Upload, MessageCircle } from 'lucide-vue-next'
import { getMyCharacters, deleteCharacter, importCharacterJson } from '../../../services/api.js'
import CharacterCard from './CharacterCard.vue'

const router = useRouter()
const emit = defineEmits(['create', 'edit'])

const characters = ref([])
const loading = ref(true)
const importing = ref(false) // 导入中状态
const fileInputRef = ref(null)

// 导出相关
const showExportModal = ref(false)
const exportingChar = ref(null)

onMounted(async () => {
  await loadCharacters()
})

async function loadCharacters() {
  loading.value = true
  try {
    characters.value = await getMyCharacters()
  } catch (e) {
    console.error('加载角色失败:', e)
  } finally {
    loading.value = false
  }
}

// 暴露给父组件调用
defineExpose({ loadCharacters })

async function handleDelete(char) {
  if (!confirm(`确定要删除角色「${char.name}」吗？`)) return
  try {
    await deleteCharacter(char.id)
    // 本地响应式更新，无需重新加载
    characters.value = characters.value.filter(c => c.id !== char.id)
  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

function handleExport(char) {
  exportingChar.value = char
  showExportModal.value = true
}

// 导出为 JSON
function exportAsJson() {
  if (!exportingChar.value) return
  const char = exportingChar.value

  const exportData = {
    name: char.name,
    avatar: char.avatar,
    portrait: char.portrait,
    bio: char.bio,
    persona: char.persona,
    greeting: char.greeting,
    npcs: char.npcs || []
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${char.name}.json`
  a.click()
  URL.revokeObjectURL(url)

  showExportModal.value = false
  exportingChar.value = null
}

// 导出为 PNG (将角色数据嵌入图片)
async function exportAsPng() {
  if (!exportingChar.value) return
  const char = exportingChar.value

  const exportData = {
    name: char.name,
    avatar: char.avatar,
    portrait: char.portrait,
    bio: char.bio,
    persona: char.persona,
    greeting: char.greeting,
    npcs: char.npcs || []
  }

  // 创建 canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // 使用角色头像或立绘作为基础图片
  const imgSrc = char.portrait || char.avatar
  if (imgSrc) {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imgSrc
      })

      if (img.complete && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
      }
    } catch {
      // 如果加载失败，使用默认尺寸
      canvas.width = 512
      canvas.height = 512
      ctx.fillStyle = '#9c27b0'
      ctx.fillRect(0, 0, 512, 512)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(char.name, 256, 256)
    }
  } else {
    // 没有图片，创建一个带角色名称的纯色背景
    canvas.width = 512
    canvas.height = 512
    ctx.fillStyle = '#9c27b0'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(char.name, 256, 256)
  }

  const jsonStr = JSON.stringify(exportData)
  console.log('[PNG Export] JSON data:', jsonStr)

  // 获取 canvas 的 PNG 数据
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  const arrayBuffer = await blob.arrayBuffer()
  const pngData = new Uint8Array(arrayBuffer)

  console.log('[PNG Export] Original PNG size:', pngData.length)

  // 嵌入角色数据
  const pngWithData = embedDataInPng(pngData, jsonStr)

  // 下载
  const finalBlob = new Blob([pngWithData], { type: 'image/png' })
  const url = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${char.name}.png`
  a.click()
  URL.revokeObjectURL(url)

  showExportModal.value = false
  exportingChar.value = null
}

// 将数据嵌入 PNG 的 tEXt chunk
function embedDataInPng(pngData, jsonStr) {
  // PNG 签名是前 8 字节
  // 我们在 IEND chunk 之前插入 tEXt chunk

  // 查找 IEND chunk 的位置（从后往前搜索 "IEND" 字符串）
  let iendPos = -1
  for (let i = pngData.length - 8; i >= 8; i--) {
    // 检查 chunk type 是否为 IEND (0x49, 0x45, 0x4E, 0x44)
    if (pngData[i] === 0x49 && pngData[i + 1] === 0x45 &&
        pngData[i + 2] === 0x4E && pngData[i + 3] === 0x44) {
      // 找到 IEND 类型字段，往前 4 字节是 length 字段
      iendPos = i - 4
      console.log('[PNG Export] Found IEND at position:', iendPos)
      break
    }
  }

  if (iendPos === -1) {
    console.error('[PNG Export] IEND chunk not found')
    return pngData
  }

  // 创建 tEXt chunk
  const keyword = 'chara' // SillyTavern 兼容的关键字
  const textData = btoa(unescape(encodeURIComponent(jsonStr)))
  const keywordBytes = new TextEncoder().encode(keyword)
  const textBytes = new TextEncoder().encode(textData)

  // chunkData = keyword + null byte + text
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length)
  chunkData.set(keywordBytes, 0)
  chunkData[keywordBytes.length] = 0 // null separator
  chunkData.set(textBytes, keywordBytes.length + 1)

  // 计算 CRC32 (包含 type + data)
  const chunkType = new Uint8Array([0x74, 0x45, 0x58, 0x74]) // "tEXt"
  const crcInput = new Uint8Array(4 + chunkData.length)
  crcInput.set(chunkType, 0)
  crcInput.set(chunkData, 4)
  const crc = crc32(crcInput)

  // 构建完整的 tEXt chunk: length (4) + type (4) + data + crc (4)
  const chunk = new Uint8Array(12 + chunkData.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, chunkData.length, false) // length (big-endian)
  chunk.set(chunkType, 4) // type
  chunk.set(chunkData, 8) // data
  view.setUint32(8 + chunkData.length, crc, false) // CRC (big-endian)

  console.log('[PNG Export] Created tEXt chunk, size:', chunk.length, 'data length:', chunkData.length)

  // 组合新的 PNG：原数据(到IEND之前) + tEXt chunk + IEND chunk
  const iendChunk = pngData.subarray(iendPos)
  const result = new Uint8Array(iendPos + chunk.length + iendChunk.length)
  result.set(pngData.subarray(0, iendPos), 0) // 原数据（不含IEND）
  result.set(chunk, iendPos) // 插入 tEXt chunk
  result.set(iendChunk, iendPos + chunk.length) // IEND chunk

  console.log('[PNG Export] Final PNG size:', result.length)

  return result
}

// CRC32 计算
function crc32(data) {
  let crc = 0xFFFFFFFF
  const table = getCrc32Table()

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF]
  }

  return (crc ^ 0xFFFFFFFF) >>> 0
}

let crc32Table = null
function getCrc32Table() {
  if (crc32Table) return crc32Table

  crc32Table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    crc32Table[i] = c
  }
  return crc32Table
}

// 跳转到微信聊天
function startChat(char) {
  router.push(`/app/wechat?charId=${char.id}`)
}

function triggerImport() {
  if (importing.value) return
  fileInputRef.value?.click()
}

async function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return

  importing.value = true
  try {
    if (file.name.endsWith('.json')) {
      // 导入 JSON
      const text = await file.text()
      const data = JSON.parse(text)
      await importCharacterJson(data)
      await loadCharacters()
      alert('导入成功')
    } else if (file.name.endsWith('.png')) {
      // 导入 PNG（从 PNG 元数据中提取）
      const arrayBuffer = await file.arrayBuffer()
      const charData = await extractPngMetadata(arrayBuffer)
      if (charData) {
        // 使用 PNG 本身作为头像
        const base64 = await fileToBase64(file)
        charData.avatar = base64
        await importCharacterJson(charData)
        await loadCharacters()
        alert('导入成功')
      } else {
        alert('PNG 文件中未找到角色卡数据')
      }
    } else {
      alert('请选择 .json 或 .png 文件')
    }
  } catch (e) {
    alert('导入失败: ' + e.message)
  } finally {
    importing.value = false
  }

  // 清空 input 以便重复选择同一文件
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

function uint8ArrayToString(arr) {
  // 使用 TextDecoder 处理 UTF-8
  try {
    return new TextDecoder('utf-8').decode(arr)
  } catch {
    // 回退到分块处理
    const chunkSize = 8192
    let result = ''
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize)
      result += String.fromCharCode.apply(null, chunk)
    }
    return result
  }
}

async function extractPngMetadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  console.log('[PNG Import] File size:', bytes.length)

  // PNG 签名检查
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== pngSignature[i]) {
      throw new Error('不是有效的 PNG 文件')
    }
  }

  // 遍历 chunks 查找 tEXt 或 iTXt
  let offset = 8
  while (offset < bytes.length) {
    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])

    console.log('[PNG Import] Chunk:', type, 'length:', length, 'at offset:', offset)

    if (type === 'tEXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length)
      const nullIndex = data.indexOf(0)
      const keyword = uint8ArrayToString(data.slice(0, nullIndex))

      console.log('Found tEXt chunk with keyword:', keyword)

      if (keyword === 'chara') {
        const textBytes = data.slice(nullIndex + 1)
        const textData = uint8ArrayToString(textBytes)

        try {
          // SillyTavern 使用 base64 编码的 JSON
          const decoded = atob(textData)
          // 使用 TextDecoder 处理 UTF-8
          const jsonBytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)))
          const jsonStr = new TextDecoder('utf-8').decode(jsonBytes)
          const charData = JSON.parse(jsonStr)

          console.log('Parsed character data:', charData)

          // SillyTavern V2 格式
          if (charData.spec === 'chara_card_v2' && charData.data) {
            const d = charData.data
            return {
              name: d.name || '',
              bio: d.creator_notes || d.description?.slice(0, 200) || '',
              persona: d.description || '',
              greeting: d.first_mes || '',
            }
          }

          // 我们自己的导出格式（包含 name, persona, greeting 等）
          if (charData.name && (charData.persona !== undefined || charData.greeting !== undefined)) {
            return {
              name: charData.name || '',
              avatar: charData.avatar || '',
              portrait: charData.portrait || '',
              bio: charData.bio || '',
              persona: charData.persona || '',
              greeting: charData.greeting || '',
              npcs: charData.npcs || [],
            }
          }

          // SillyTavern V1 / 旧格式
          return {
            name: charData.name || charData.char_name || '',
            bio: charData.creator_notes || charData.description?.slice(0, 200) || '',
            persona: charData.description || charData.personality || '',
            greeting: charData.first_mes || charData.greeting || '',
            npcs: [],
          }
        } catch (e) {
          console.error('解析 chara 数据失败:', e)
          throw new Error('角色卡数据解析失败: ' + e.message)
        }
      }
    }

    offset += 12 + length

    if (type === 'IEND') break
  }

  return null
}
</script>

<template>
  <div class="character-list">
    <!-- 操作按钮 -->
    <div class="action-buttons">
      <button class="create-btn" @click="emit('create')">
        <Plus :size="18" />
        <span>创建角色</span>
      </button>
      <button class="import-btn" @click="triggerImport" :disabled="importing">
        <Upload :size="18" />
        <span>{{ importing ? '导入中...' : '导入' }}</span>
      </button>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,.png"
      style="display: none"
      @change="handleImport"
    />

    <!-- 加载中 -->
    <div v-if="loading || importing" class="loading">
      {{ importing ? '正在导入角色卡...' : '加载中...' }}
    </div>

    <!-- 空状态 -->
    <div v-else-if="characters.length === 0" class="empty">
      <p>还没有创建角色</p>
      <p class="hint">点击上方按钮创建或导入角色</p>
    </div>

    <!-- 角色列表 -->
    <div v-else class="list">
      <div v-for="char in characters" :key="char.id" class="card-wrapper">
        <div @click="startChat(char)" class="card-clickable">
          <CharacterCard :character="char" :showPersona="true" />
        </div>
        <div class="actions">
          <button class="action-btn chat" @click.stop="startChat(char)" title="开始聊天">
            <MessageCircle :size="14" />
          </button>
          <button class="action-btn" @click.stop="emit('edit', char)" title="编辑">
            <Edit2 :size="14" />
          </button>
          <button class="action-btn" @click.stop="handleExport(char)" title="导出">
            <Download :size="14" />
          </button>
          <button class="action-btn danger" @click.stop="handleDelete(char)" title="删除">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 导出格式选择弹窗 -->
    <Teleport to="body">
      <div v-if="showExportModal" class="export-modal-overlay" @click.self="showExportModal = false">
        <div class="export-modal">
          <div class="export-modal-header">导出格式</div>
          <div class="export-modal-content">
            <button class="export-option" @click="exportAsJson">
              <span class="export-icon">📄</span>
              <span class="export-label">JSON 格式</span>
              <span class="export-desc">通用数据格式，可手动编辑</span>
            </button>
            <button class="export-option" @click="exportAsPng">
              <span class="export-icon">🖼️</span>
              <span class="export-label">PNG 角色卡</span>
              <span class="export-desc">图片格式，兼容 SillyTavern</span>
            </button>
          </div>
          <button class="export-cancel" @click="showExportModal = false">取消</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.character-list {
  padding: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.create-btn, .import-btn {
  flex: 1;
  padding: 10px;
  border: 2px dashed #444;
  border-radius: 10px;
  background: transparent;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.create-btn:hover {
  border-color: #9c27b0;
  color: #9c27b0;
}

.import-btn:hover {
  border-color: #1976d2;
  color: #1976d2;
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

.card-wrapper {
  position: relative;
}

.card-clickable {
  cursor: pointer;
  transition: transform 0.2s;
}

.card-clickable:active {
  transform: scale(0.98);
}

.actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.action-btn.chat {
  background: rgba(7, 193, 96, 0.8);
}

.action-btn.chat:hover {
  background: #07c160;
}

.action-btn.danger:hover {
  background: #c62828;
}

/* 导出弹窗 */
.export-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  width: 280px;
  background: #2a2a2a;
  border-radius: 16px;
  overflow: hidden;
}

.export-modal-header {
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #333;
}

.export-modal-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  background: #333;
  cursor: pointer;
  transition: background 0.2s;
}

.export-option:hover {
  background: #444;
}

.export-icon {
  font-size: 24px;
  margin-bottom: 6px;
}

.export-label {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 2px;
}

.export-desc {
  font-size: 12px;
  color: #888;
}

.export-cancel {
  width: 100%;
  padding: 14px;
  border: none;
  border-top: 1px solid #333;
  background: transparent;
  color: #888;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.export-cancel:hover {
  background: #333;
}
</style>
