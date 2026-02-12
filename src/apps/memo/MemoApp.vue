<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronLeft, Save, RefreshCw, Plus, Trash2, Brain } from 'lucide-vue-next'
import { getMyCharacters, getCharacterForChat } from '../../services/api.js'
import { getMemory, updateMemory, triggerSummarize } from '../../services/api.js'

// 角色列表
const characters = ref([])
const selectedCharId = ref(null)

// 记忆数据
const memory = ref({
  summary: '',
  facts: [],
  lastSummarizedAt: null,
  messageCountSinceLastSummary: 0
})

// 状态
const loading = ref(false)
const saving = ref(false)
const summarizing = ref(false)
const message = ref('')
const messageType = ref('info') // info, success, error

// 新增 fact 的临时数据
const newFactKey = ref('')
const newFactValue = ref('')

// 当前选中的角色
const selectedCharacter = computed(() => {
  return characters.value.find(c => c.id === selectedCharId.value)
})

onMounted(async () => {
  await loadCharacters()
})

watch(selectedCharId, async (newId) => {
  if (newId) {
    await loadMemory()
  }
})

async function loadCharacters() {
  try {
    loading.value = true

    // 加载我的角色
    const myChars = await getMyCharacters()
    const charList = [...myChars]
    const myCharIds = new Set(myChars.map(c => c.id))

    // 加载聊过的广场角色（从 localStorage）
    try {
      const saved = localStorage.getItem('chatted_plaza_chars')
      if (saved) {
        const plazaCharIds = JSON.parse(saved)
        for (const charId of plazaCharIds) {
          // 跳过已是我的角色的
          if (myCharIds.has(charId)) continue

          try {
            const charData = await getCharacterForChat(charId)
            if (charData) {
              charList.push({
                id: charData.id,
                name: charData.name,
                avatar: charData.avatar,
                isPlazaChar: true
              })
            }
          } catch (e) {
            console.warn(`广场角色 ${charId} 加载失败`)
          }
        }
      }
    } catch (e) {
      console.error('加载广场角色失败:', e)
    }

    characters.value = charList
    if (characters.value.length > 0 && !selectedCharId.value) {
      selectedCharId.value = characters.value[0].id
    }
  } catch (e) {
    showMessage('加载角色列表失败: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function loadMemory() {
  if (!selectedCharId.value) return

  try {
    loading.value = true
    memory.value = await getMemory(selectedCharId.value)
  } catch (e) {
    showMessage('加载记忆失败: ' + e.message, 'error')
    memory.value = {
      summary: '',
      facts: [],
      lastSummarizedAt: null,
      messageCountSinceLastSummary: 0
    }
  } finally {
    loading.value = false
  }
}

async function saveMemory() {
  if (!selectedCharId.value) return

  try {
    saving.value = true
    await updateMemory(selectedCharId.value, {
      summary: memory.value.summary,
      facts: memory.value.facts
    })
    showMessage('记忆已保存', 'success')
  } catch (e) {
    showMessage('保存失败: ' + e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleSummarize() {
  if (!selectedCharId.value) return

  try {
    summarizing.value = true
    showMessage('正在生成摘要...', 'info')
    const result = await triggerSummarize(selectedCharId.value)
    memory.value = result
    showMessage('摘要生成成功', 'success')
  } catch (e) {
    showMessage('摘要生成失败: ' + e.message, 'error')
  } finally {
    summarizing.value = false
  }
}

function addFact() {
  if (!newFactKey.value.trim() || !newFactValue.value.trim()) {
    showMessage('请输入完整的关键信息', 'error')
    return
  }

  memory.value.facts.push({
    key: newFactKey.value.trim(),
    value: newFactValue.value.trim()
  })

  newFactKey.value = ''
  newFactValue.value = ''
}

function removeFact(index) {
  memory.value.facts.splice(index, 1)
}

function updateFactKey(index, value) {
  memory.value.facts[index].key = value
}

function updateFactValue(index, value) {
  memory.value.facts[index].value = value
}

function showMessage(text, type = 'info') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

function formatDate(isoString) {
  if (!isoString) return '从未'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN')
}
</script>

<template>
  <div class="memo-app">
    <!-- 顶部导航 -->
    <div class="header">
      <div class="header-left">
        <Brain class="header-icon" />
        <span class="header-title">AI 记忆管理</span>
      </div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" :class="['message-toast', messageType]">
      {{ message }}
    </div>

    <!-- 主内容区 -->
    <div class="content">
      <!-- 角色选择 -->
      <div class="section">
        <label class="section-label">选择角色</label>
        <select v-model="selectedCharId" class="select-input" :disabled="loading">
          <option v-for="char in characters" :key="char.id" :value="char.id">
            {{ char.name }}{{ char.isPlazaChar ? ' (广场)' : '' }}
          </option>
        </select>
      </div>

      <div v-if="selectedCharId" class="memory-content">
        <!-- 统计信息 -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">上次摘要:</span>
            <span class="stat-value">{{ formatDate(memory.lastSummarizedAt) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">待摘要消息:</span>
            <span class="stat-value">{{ memory.messageCountSinceLastSummary || 0 }} 条</span>
          </div>
        </div>

        <!-- 剧情摘要 -->
        <div class="section">
          <label class="section-label">剧情摘要</label>
          <textarea
            v-model="memory.summary"
            class="textarea-input"
            placeholder="AI 将自动生成剧情摘要，你也可以手动编辑..."
            rows="5"
          ></textarea>
        </div>

        <!-- 关键事实 -->
        <div class="section">
          <label class="section-label">关键事实 ({{ memory.facts?.length || 0 }})</label>

          <!-- 事实列表 -->
          <div class="facts-list">
            <div v-for="(fact, index) in memory.facts" :key="index" class="fact-item">
              <input
                :value="fact.key"
                @input="updateFactKey(index, $event.target.value)"
                class="fact-key"
                placeholder="名称"
              />
              <input
                :value="fact.value"
                @input="updateFactValue(index, $event.target.value)"
                class="fact-value"
                placeholder="内容"
              />
              <button @click="removeFact(index)" class="btn-icon btn-danger">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>

          <!-- 添加新事实 -->
          <div class="add-fact">
            <input
              v-model="newFactKey"
              class="fact-key"
              placeholder="新增名称"
              @keyup.enter="addFact"
            />
            <input
              v-model="newFactValue"
              class="fact-value"
              placeholder="新增内容"
              @keyup.enter="addFact"
            />
            <button @click="addFact" class="btn-icon btn-primary">
              <Plus :size="16" />
            </button>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <button
            @click="handleSummarize"
            class="btn btn-secondary"
            :disabled="summarizing"
          >
            <RefreshCw :size="18" :class="{ spinning: summarizing }" />
            {{ summarizing ? '生成中...' : '生成摘要' }}
          </button>
          <button
            @click="saveMemory"
            class="btn btn-primary"
            :disabled="saving"
          >
            <Save :size="18" />
            {{ saving ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <Brain :size="48" class="empty-icon" />
        <p>请先选择一个角色</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.memo-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #07c160;
  color: white;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 24px;
  height: 24px;
}

.header-title {
  font-size: 18px;
  font-weight: 500;
}

.message-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 1000;
  animation: slideDown 0.3s ease;
  max-width: 80%;
  text-align: center;
}

.message-toast.info {
  background: #1890ff;
  color: white;
}

.message-toast.success {
  background: #52c41a;
  color: white;
}

.message-toast.error {
  background: #ff4d4f;
  color: white;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content::-webkit-scrollbar {
  display: none;
}

.section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.select-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  box-sizing: border-box;
}

.memory-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  word-break: break-all;
}

.textarea-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.textarea-input:focus {
  outline: none;
  border-color: #07c160;
}

.facts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.fact-item, .add-fact {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fact-key {
  width: 80px;
  min-width: 80px;
  flex-shrink: 0;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
}

.fact-value {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
}

.fact-key:focus, .fact-value:focus {
  outline: none;
  border-color: #07c160;
}

.btn-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon.btn-primary {
  background: #07c160;
  color: white;
}

.btn-icon.btn-primary:hover {
  background: #06ad56;
}

.btn-icon.btn-danger {
  background: #ff4d4f;
  color: white;
}

.btn-icon.btn-danger:hover {
  background: #ff7875;
}

.add-fact {
  padding-top: 8px;
  border-top: 1px dashed #ddd;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #07c160;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #06ad56;
}

.btn-secondary {
  background: #1890ff;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #40a9ff;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #999;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}
</style>
