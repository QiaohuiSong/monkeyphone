<script setup>
import { ref, watch, onMounted } from 'vue'
import { ArrowLeft, Download, Upload, RotateCcw, Palette, Code, Eye } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useSystemStore } from '../../stores/system.js'

const router = useRouter()
const systemStore = useSystemStore()

// CSS 编辑器内容
const cssContent = ref(systemStore.customCSS || '')
const message = ref('')
const messageType = ref('info')

// 防抖定时器
let debounceTimer = null

// 监听 CSS 内容变化，防抖保存
watch(cssContent, (newValue) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    systemStore.setCustomCSS(newValue)
    showMessage('CSS 已自动保存', 'success')
  }, 500)
})

// 显示消息
function showMessage(text, type = 'info') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 2000)
}

// 导出主题
function exportTheme() {
  const theme = systemStore.exportTheme()
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'theme.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showMessage('主题已导出', 'success')
}

// 导入主题
const fileInputRef = ref(null)

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    const theme = JSON.parse(text)

    // 校验主题格式
    if (typeof theme !== 'object') {
      throw new Error('无效的主题格式')
    }

    systemStore.importTheme(theme)
    cssContent.value = systemStore.customCSS || ''
    showMessage('主题导入成功', 'success')
  } catch (e) {
    showMessage('导入失败: ' + e.message, 'error')
  }

  event.target.value = ''
}

// 重置主题
function resetTheme() {
  if (confirm('确定要重置所有主题设置吗？')) {
    systemStore.resetTheme()
    cssContent.value = ''
    showMessage('主题已重置', 'success')
  }
}

// 返回
function goBack() {
  router.push('/')
}

// 默认 placeholder
const placeholder = `/* ========================================
   美化工坊 - CSS 编辑器
   ======================================== */

/* 可用的 CSS 钩子 (Class Hooks):

   .os-shell          - 手机外壳
   .os-screen         - 屏幕区域
   .os-statusbar      - 状态栏
   .os-content        - 内容区域

   .os-launcher       - 桌面启动器
   .os-widget         - 小组件
   .os-time-widget    - 时间组件
   .os-weather-widget - 天气组件

   .os-launcher-item  - 桌面图标容器
   .os-launcher-icon  - 图标图片
   .os-launcher-name  - 图标名称

   .os-dock           - 底部 Dock 栏
   .os-dock-item      - Dock 图标容器
   .os-dock-icon      - Dock 图标

   [data-app-id="xxx"] - 指定应用 ID
*/

/* 示例: 修改手机边框颜色 */
/*
.os-shell {
  border-color: #ff00ff !important;
}
*/

/* 示例: 修改 Dock 栏背景 */
/*
.os-dock {
  background: rgba(255, 0, 255, 0.3) !important;
}
*/

/* 示例: 隐藏状态栏 */
/*
.os-statusbar {
  display: none !important;
}
*/

/* 在下方开始编写你的 CSS... */
`

onMounted(() => {
  if (!cssContent.value) {
    // 不设置 placeholder 到实际内容，只作为提示
  }
})
</script>

<template>
  <div class="theme-studio">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-title">
        <Palette :size="20" />
        <span>美化工坊</span>
      </div>
      <div style="width: 36px"></div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" :class="['message-toast', messageType]">
      {{ message }}
    </div>

    <!-- 主内容区 -->
    <div class="content">
      <!-- CSS 编辑器 -->
      <div class="editor-section">
        <div class="section-header">
          <Code :size="16" />
          <span>CSS 编辑器</span>
          <span class="hint">实时预览</span>
        </div>
        <textarea
          v-model="cssContent"
          class="css-editor"
          :placeholder="placeholder"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <button class="action-btn export" @click="exportTheme">
          <Download :size="18" />
          <span>导出主题</span>
        </button>
        <button class="action-btn import" @click="triggerImport">
          <Upload :size="18" />
          <span>导入主题</span>
        </button>
        <button class="action-btn reset" @click="resetTheme">
          <RotateCcw :size="18" />
          <span>重置默认</span>
        </button>
      </div>

      <!-- CSS 钩子参考 -->
      <div class="hooks-section">
        <div class="section-header">
          <Eye :size="16" />
          <span>CSS 钩子参考</span>
        </div>
        <div class="hooks-list">
          <div class="hook-item">
            <code>.os-shell</code>
            <span>手机外壳</span>
          </div>
          <div class="hook-item">
            <code>.os-statusbar</code>
            <span>状态栏</span>
          </div>
          <div class="hook-item">
            <code>.os-dock</code>
            <span>Dock 栏</span>
          </div>
          <div class="hook-item">
            <code>.os-widget</code>
            <span>小组件</span>
          </div>
          <div class="hook-item">
            <code>.os-launcher-icon</code>
            <span>应用图标</span>
          </div>
          <div class="hook-item">
            <code>[data-app-id="wechat"]</code>
            <span>指定应用</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleImport"
    />
  </div>
</template>

<style scoped>
.theme-studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
  color: #fff;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 500;
  color: #fff;
}

.header-title svg {
  color: #ff00ff;
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

/* 消息提示 */
.message-toast {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 100;
  animation: fadeIn 0.3s ease;
}

.message-toast.info {
  background: #1890ff;
}

.message-toast.success {
  background: #52c41a;
}

.message-toast.error {
  background: #ff4d4f;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 主内容 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: none;
}

.content::-webkit-scrollbar {
  display: none;
}

/* 编辑器区域 */
.editor-section {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
}

.section-header svg {
  color: #00f5ff;
}

.section-header .hint {
  margin-left: auto;
  font-size: 11px;
  color: #52c41a;
  background: rgba(82, 196, 26, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.css-editor {
  flex: 1;
  width: 100%;
  min-height: 180px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #e0e0e0;
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.css-editor:focus {
  border-color: #ff00ff;
  box-shadow: 0 0 10px rgba(255, 0, 255, 0.2);
}

.css-editor::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* 操作按钮 */
.actions-section {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.export {
  background: linear-gradient(135deg, #00f5ff 0%, #0066ff 100%);
  color: #fff;
}

.action-btn.import {
  background: linear-gradient(135deg, #ff00ff 0%, #cc00ff 100%);
  color: #fff;
}

.action-btn.reset {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.action-btn:active {
  transform: translateY(0);
}

/* CSS 钩子参考 */
.hooks-section {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.hooks-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.hook-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.hook-item code {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #ff00ff;
  word-break: break-all;
}

.hook-item span {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
