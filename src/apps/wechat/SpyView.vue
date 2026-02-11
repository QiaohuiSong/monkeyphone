<script setup>
import { ref, onMounted } from 'vue'
import { ArrowLeft, Eye } from 'lucide-vue-next'
import { getChatSessions, getWechatProfile } from '../../services/wechatApi.js'

const props = defineProps({
  charId: { type: String, required: true }
})

const emit = defineEmits(['back', 'openChat'])

const sessions = ref([])
const profile = ref(null)
const loading = ref(true)

// 会话图标映射（根据关键词匹配）
function getSessionIcon(sessionId, sessionName) {
  const id = sessionId.toLowerCase()
  const name = sessionName.toLowerCase()

  if (id === 'player') return '💬'
  if (id === 'npc_team' || name.includes('团队')) return '🔧'
  if (id.includes('ex') || name.includes('前') || name.includes('ex')) return '💔'
  if (id.includes('mom') || name.includes('妈') || name.includes('母')) return '👩'
  if (id.includes('dad') || name.includes('爸') || name.includes('父')) return '👨'
  if (id.includes('friend') || name.includes('朋友') || name.includes('闺蜜') || name.includes('兄弟')) return '👫'
  if (id.includes('crush') || name.includes('暗恋') || name.includes('喜欢')) return '💕'
  if (id.includes('boss') || name.includes('老板') || name.includes('领导')) return '👔'
  if (id.includes('coworker') || name.includes('同事')) return '💼'
  if (id.includes('classmate') || name.includes('同学')) return '🎓'
  if (name.includes('姐') || name.includes('哥')) return '👪'

  return '💬'
}

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [sessionsData, profileData] = await Promise.all([
      getChatSessions(props.charId),
      getWechatProfile(props.charId)
    ])
    sessions.value = sessionsData
    profile.value = profileData
  } catch (e) {
    console.error('加载会话列表失败:', e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  emit('back')
}

function openSession(session) {
  // 传递会话元数据，包含对方名称
  emit('openChat', props.charId, session.id, true, { name: session.name })
}
</script>

<template>
  <div class="spy-view">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">
        <Eye :size="18" />
        偷看模式
      </span>
      <div style="width: 36px"></div>
    </div>

    <!-- 提示信息 -->
    <div class="tip-banner">
      <Eye :size="16" />
      <span>查看 {{ profile?.nickname || '角色' }} 手机里的聊天记录</span>
    </div>

    <!-- 会话列表 -->
    <div class="session-list">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="sessions.length === 0" class="empty">
        暂无聊天记录
      </div>

      <div
        v-else
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        @click="openSession(session)"
      >
        <div class="session-icon">
          {{ getSessionIcon(session.id, session.name) }}
        </div>
        <div class="session-info">
          <div class="session-name">{{ session.name }}</div>
          <div class="session-hint">点击查看聊天记录</div>
        </div>
        <Eye :size="18" class="spy-icon" />
      </div>
    </div>

    <!-- 底部说明 -->
    <div class="footer-note">
      偷看模式下只能查看，不能发送消息
    </div>
  </div>
</template>

<style scoped>
.spy-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ededed;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
}

.header .title {
  display: flex;
  align-items: center;
  gap: 6px;
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
  background: rgba(255,255,255,0.1);
}

.tip-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #fff3cd;
  color: #856404;
  font-size: 14px;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.1s;
}

.session-item:active {
  transform: scale(0.98);
  background: #f5f5f5;
}

.session-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.session-info {
  flex: 1;
}

.session-name {
  font-size: 16px;
  font-weight: 500;
  color: #000;
}

.session-hint {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.spy-icon {
  color: #999;
}

.footer-note {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: #999;
  background: #f5f5f5;
}
</style>
