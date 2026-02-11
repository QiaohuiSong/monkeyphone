<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Send, ArrowLeft } from 'lucide-vue-next'
import {
  getChatHistory,
  sendMessage as sendMessageApi,
  getCharacterForChat,
  getCharacterChatHistory,
  sendCharacterMessage
} from '../../services/api.js'

const route = useRoute()

const messages = ref([])
const inputText = ref('')
const isTyping = ref(false)
const chatListRef = ref(null)
const character = ref(null)
const greetingShown = ref(false)

// 是否为角色聊天模式
const charId = computed(() => route.query.charId)
const isCharacterMode = computed(() => !!charId.value)

// 背景样式
const backgroundStyle = computed(() => {
  if (character.value?.portrait) {
    return {
      backgroundImage: `url(${character.value.portrait})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {}
})

const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#9c27b0" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)

onMounted(async () => {
  await loadData()
})

watch(() => route.query.charId, async () => {
  await loadData()
})

async function loadData() {
  try {
    if (charId.value) {
      // 角色聊天模式
      character.value = await getCharacterForChat(charId.value)
      messages.value = await getCharacterChatHistory(charId.value)

      // 如果没有聊天记录且有开场白，显示开场白
      if (messages.value.length === 0 && character.value.greeting && !greetingShown.value) {
        messages.value.push({
          id: Date.now(),
          sender: 'ai',
          text: character.value.greeting
        })
        greetingShown.value = true
      }
    } else {
      // 普通聊天模式
      character.value = null
      messages.value = await getChatHistory()
    }
    scrollToBottom()
  } catch (e) {
    console.error('获取聊天记录失败:', e)
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  })
}

async function sendMessage() {
  if (!inputText.value.trim() || isTyping.value) return

  const userText = inputText.value
  inputText.value = ''

  // 立即显示用户消息（临时ID）
  const tempUserMsg = {
    id: 'temp_' + Date.now(),
    sender: 'user',
    text: userText
  }
  messages.value.push(tempUserMsg)
  scrollToBottom()

  isTyping.value = true

  try {
    let reply
    if (isCharacterMode.value) {
      reply = await sendCharacterMessage(charId.value, userText)
    } else {
      reply = await sendMessageApi(userText)
    }

    // 移除临时消息，重新加载完整历史
    // 这样可以确保消息ID和顺序与后端一致
    if (isCharacterMode.value) {
      messages.value = await getCharacterChatHistory(charId.value)
    } else {
      messages.value = await getChatHistory()
    }
  } catch (error) {
    // 出错时保留临时消息并显示错误
    messages.value.push({
      id: Date.now(),
      sender: 'ai',
      text: error.message,
      error: true
    })
  } finally {
    isTyping.value = false
    scrollToBottom()
  }
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <div class="messenger" :style="backgroundStyle">
    <!-- 背景遮罩（用于立绘模糊效果） -->
    <div v-if="character?.portrait" class="backdrop"></div>

    <!-- 角色头部 -->
    <div v-if="isCharacterMode && character" class="character-header">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <img :src="character.avatar || defaultAvatar" class="char-avatar" />
      <span class="char-name">{{ character.name }}</span>
    </div>

    <div class="chat-list" ref="chatListRef">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="msg.sender"
      >
        <div class="bubble" :class="{ error: msg.error }">{{ msg.text }}</div>
      </div>
      <div v-if="isTyping" class="message ai">
        <div class="bubble typing">
          {{ character ? character.name + ' 正在输入...' : '对方正在输入...' }}
        </div>
      </div>
    </div>
    <div class="input-area">
      <input
        v-model="inputText"
        type="text"
        :placeholder="character ? `对 ${character.name} 说...` : '输入消息...'"
        :disabled="isTyping"
        @keyup.enter="sendMessage"
      />
      <button class="send-btn" :class="{ character: isCharacterMode }" :disabled="isTyping" @click="sendMessage">
        <Send :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.messenger {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  position: relative;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: inherit;
  filter: blur(20px);
  opacity: 0.3;
  z-index: 0;
}

.backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.character-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(34, 34, 34, 0.9);
  border-bottom: 1px solid #333;
  position: relative;
  z-index: 1;
}

.back-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background: #333;
}

.char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
}

.char-name {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.message {
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.ai {
  justify-content: flex-start;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.4;
}

.user .bubble {
  background: #e53935;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.ai .bubble {
  background: #333;
  color: #fff;
  border-bottom-left-radius: 4px;
}

.ai .bubble.error {
  background: #c62828;
  color: #fff;
}

.ai .bubble.typing {
  background: #333;
  color: #888;
  font-style: italic;
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: rgba(34, 34, 34, 0.95);
  border-top: 1px solid #333;
  position: relative;
  z-index: 1;
}

.input-area input {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 20px;
  background: #333;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.input-area input::placeholder {
  color: #666;
}

.input-area input:disabled {
  opacity: 0.6;
}

.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: #e53935;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.send-btn.character {
  background: #9c27b0;
}

.send-btn:active {
  opacity: 0.8;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
