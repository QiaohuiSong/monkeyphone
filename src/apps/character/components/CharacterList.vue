<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Edit2, Trash2, Download, Upload, MessageCircle } from 'lucide-vue-next'
import { getMyCharacters, deleteCharacter, exportCharacterJson, importCharacterJson } from '../../../services/api.js'
import CharacterCard from './CharacterCard.vue'

const router = useRouter()
const emit = defineEmits(['create', 'edit'])

const characters = ref([])
const loading = ref(true)
const fileInputRef = ref(null)

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
    await loadCharacters()
  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

function handleExport(char) {
  exportCharacterJson(char.id)
}

// 跳转到微信聊天
function startChat(char) {
  router.push(`/app/wechat?charId=${char.id}`)
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return

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

          // SillyTavern V1 / 旧格式
          return {
            name: charData.name || charData.char_name || '',
            bio: charData.creator_notes || charData.description?.slice(0, 200) || '',
            persona: charData.description || charData.personality || '',
            greeting: charData.first_mes || charData.greeting || '',
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
      <button class="import-btn" @click="triggerImport">
        <Upload :size="18" />
        <span>导入</span>
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
    <div v-if="loading" class="loading">加载中...</div>

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
</style>
