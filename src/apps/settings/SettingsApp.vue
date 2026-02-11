<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Image, Bot, RefreshCw, LogOut, Trash2, Key } from 'lucide-vue-next'
import { getSettings, updateSettings, getModels, clearChatHistory, logout, updateApiKey, getUserInfo } from '../../services/api.js'
import { useSystemStore } from '../../stores/system.js'

const router = useRouter()
const systemStore = useSystemStore()

const localModel = ref('gpt-3.5-turbo')
const localApiKey = ref('')
const availableModels = ref([])
const loadingModels = ref(false)
const modelsError = ref('')

onMounted(async () => {
  try {
    const settings = await getSettings()
    localModel.value = settings.ai_model || 'gpt-3.5-turbo'
    localApiKey.value = settings.api_key || ''
    if (settings.wallpaper) {
      systemStore.setWallpaper(settings.wallpaper)
    }
  } catch (e) {
    console.error('获取设置失败:', e)
  }
})

function changeWallpaper() {
  systemStore.toggleWallpaper()
  updateSettings({ wallpaper: systemStore.wallpaper })
}

async function fetchModels() {
  if (!localApiKey.value) {
    modelsError.value = '请先填写 API Key'
    return
  }

  loadingModels.value = true
  modelsError.value = ''

  try {
    // 先保存 API Key
    await updateApiKey(localApiKey.value)
    // 再获取模型列表
    availableModels.value = await getModels()
  } catch (error) {
    modelsError.value = error.message
    availableModels.value = []
  } finally {
    loadingModels.value = false
  }
}

async function saveModel() {
  try {
    await updateSettings({ ai_model: localModel.value })
  } catch (e) {
    console.error('保存模型失败:', e)
  }
}

async function saveApiKey() {
  try {
    await updateApiKey(localApiKey.value)
  } catch (e) {
    console.error('保存 API Key 失败:', e)
  }
}

async function saveConfig() {
  try {
    // 一次请求保存所有配置
    await updateSettings({
      ai_model: localModel.value,
      api_key: localApiKey.value || undefined
    })
    alert('配置已保存')
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
}

function clearConfig() {
  localApiKey.value = ''
  localModel.value = 'gpt-3.5-turbo'
  availableModels.value = []
}

async function handleClearChat() {
  if (confirm('确定要清空所有聊天记录吗？')) {
    try {
      await clearChatHistory()
      alert('聊天记录已清空')
    } catch (e) {
      alert('清空失败: ' + e.message)
    }
  }
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="settings">
    <div class="settings-list">
      <div class="setting-item" @click="changeWallpaper">
        <div class="setting-icon">
          <Image :size="20" />
        </div>
        <span class="setting-label">切换壁纸</span>
        <span class="arrow">›</span>
      </div>
    </div>

    <div class="section-title">API 配置</div>
    <div class="settings-list">
      <div class="setting-item column">
        <div class="setting-row">
          <div class="setting-icon green">
            <Key :size="20" />
          </div>
          <span class="setting-label">API Key</span>
        </div>
        <input
          v-model="localApiKey"
          type="password"
          class="setting-input"
          placeholder="sk-..."
        />
      </div>

      <div class="setting-item column">
        <div class="setting-row">
          <div class="setting-icon purple">
            <Bot :size="20" />
          </div>
          <span class="setting-label">模型</span>
          <button class="fetch-btn" @click="fetchModels" :disabled="loadingModels">
            <RefreshCw :size="16" :class="{ spinning: loadingModels }" />
          </button>
        </div>
        <select
          v-if="availableModels.length > 0"
          v-model="localModel"
          class="setting-select"
        >
          <option v-for="model in availableModels" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
        <input
          v-else
          v-model="localModel"
          type="text"
          class="setting-input"
          placeholder="gpt-3.5-turbo"
        />
        <div v-if="modelsError" class="error-text">{{ modelsError }}</div>
      </div>
    </div>

    <div class="button-group">
      <button class="btn save" @click="saveConfig">保存配置</button>
      <button class="btn clear" @click="clearConfig">清除配置</button>
    </div>

    <div class="section-title">数据管理</div>
    <div class="settings-list">
      <div class="setting-item" @click="handleClearChat">
        <div class="setting-icon orange">
          <Trash2 :size="20" />
        </div>
        <span class="setting-label">清空聊天记录</span>
        <span class="arrow">›</span>
      </div>
    </div>

    <div class="section-title">账号</div>
    <div class="settings-list">
      <div class="setting-item" @click="handleLogout">
        <div class="setting-icon red">
          <LogOut :size="20" />
        </div>
        <span class="setting-label">退出登录</span>
        <span class="arrow">›</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  height: 100%;
  background: #1a1a1a;
  padding: 16px;
  overflow-y: auto;
}

.settings-list {
  background: #222;
  border-radius: 12px;
  overflow: hidden;
}

.section-title {
  font-size: 13px;
  color: #888;
  margin: 20px 0 8px 4px;
  text-transform: uppercase;
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.setting-item.column {
  flex-direction: column;
  align-items: stretch;
  cursor: default;
}

.setting-item:not(.column):active {
  background: #333;
}

.setting-item + .setting-item {
  border-top: 1px solid #333;
}

.setting-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.setting-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #e53935;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-right: 12px;
  flex-shrink: 0;
}

.setting-icon.blue {
  background: #1976d2;
}

.setting-icon.green {
  background: #43a047;
}

.setting-icon.purple {
  background: #7b1fa2;
}

.setting-icon.orange {
  background: #f57c00;
}

.setting-icon.red {
  background: #c62828;
}

.setting-label {
  flex: 1;
  font-size: 15px;
  color: #fff;
}

.arrow {
  font-size: 20px;
  color: #666;
}

.setting-input {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #333;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.setting-input::placeholder {
  color: #666;
}

.setting-input:focus {
  background: #3a3a3a;
}

.setting-value {
  padding: 10px 12px;
  border-radius: 8px;
  background: #2a2a2a;
  color: #888;
  font-size: 13px;
  word-break: break-all;
}

.fetch-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #333;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.fetch-btn:active {
  background: #444;
}

.fetch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.setting-select {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #333;
  color: #fff;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.setting-select:focus {
  background-color: #3a3a3a;
}

.error-text {
  margin-top: 8px;
  font-size: 12px;
  color: #e53935;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:active {
  opacity: 0.8;
}

.btn.save {
  background: #43a047;
  color: #fff;
}

.btn.clear {
  background: #333;
  color: #fff;
}
</style>
