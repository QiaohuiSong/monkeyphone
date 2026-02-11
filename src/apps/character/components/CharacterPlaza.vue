<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessageCircle, X } from 'lucide-vue-next'
import { getPlazaCharacters } from '../../../services/api.js'

const router = useRouter()
const characters = ref([])
const loading = ref(true)
const selectedChar = ref(null)

const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#9c27b0" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)

onMounted(async () => {
  await loadCharacters()
})

async function loadCharacters() {
  loading.value = true
  try {
    characters.value = await getPlazaCharacters()
  } catch (e) {
    console.error('加载角色广场失败:', e)
  } finally {
    loading.value = false
  }
}

function showDetail(char) {
  selectedChar.value = char
}

function closeDetail() {
  selectedChar.value = null
}

function chatWithCharacter(charId) {
  router.push({
    path: '/app/wechat',
    query: { charId }
  })
}
</script>

<template>
  <div class="character-plaza">
    <!-- 加载中 -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- 空状态 -->
    <div v-else-if="characters.length === 0" class="empty">
      <p>角色广场暂无角色</p>
      <p class="hint">创建角色并设为公开后会显示在这里</p>
    </div>

    <!-- 角色列表 -->
    <div v-else class="list">
      <div
        v-for="char in characters"
        :key="char.id"
        class="plaza-card"
        @click="showDetail(char)"
      >
        <img :src="char.avatar || defaultAvatar" class="avatar" alt="" />
        <div class="info">
          <div class="name">{{ char.name }}</div>
          <div class="bio">{{ char.bio || '暂无简介' }}</div>
          <div class="author">by {{ char.authorId }}</div>
        </div>
        <button class="chat-btn" @click.stop="chatWithCharacter(char.id)">
          <MessageCircle :size="16" />
        </button>
      </div>
    </div>

    <!-- 角色详情弹窗 -->
    <div v-if="selectedChar" class="modal-overlay" @click.self="closeDetail">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">角色简介</span>
          <button class="close-btn" @click="closeDetail">
            <X :size="20" />
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-header">
            <img :src="selectedChar.avatar || defaultAvatar" class="detail-avatar" alt="" />
            <div class="detail-info">
              <div class="detail-name">{{ selectedChar.name }}</div>
              <div class="detail-author">by {{ selectedChar.authorId }}</div>
            </div>
          </div>
          <div class="detail-section">
            <div class="section-title">简介</div>
            <div class="section-content">{{ selectedChar.bio || '暂无简介' }}</div>
          </div>

          <!-- NPC 关系网 / 登场人物 -->
          <div v-if="selectedChar.npcs && selectedChar.npcs.length > 0" class="npc-section">
            <div class="section-title">世界观 / 登场人物</div>
            <div class="npc-list">
              <div
                v-for="npc in selectedChar.npcs"
                :key="npc.id"
                class="npc-preview-card"
              >
                <img
                  v-if="npc.avatar"
                  :src="npc.avatar"
                  class="npc-avatar"
                  alt=""
                />
                <div v-else class="npc-avatar npc-avatar-placeholder">
                  {{ npc.name?.[0] || '?' }}
                </div>
                <div class="npc-info">
                  <div class="npc-header">
                    <span class="npc-name">{{ npc.name }}</span>
                    <span v-if="npc.relation" class="npc-relation">{{ npc.relation }}</span>
                  </div>
                  <div class="npc-bio">{{ npc.bio || '神秘人物' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="chat-btn full" @click="chatWithCharacter(selectedChar.id)">
            <MessageCircle :size="18" />
            <span>与 TA 聊天</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-plaza {
  padding: 12px;
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

.plaza-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #2a2a2a;
  border-radius: 10px;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
}

.plaza-card:active {
  background: #333;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 2px;
}

.bio {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 90%;
  max-width: 320px;
  background: #222;
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.modal-title {
  font-size: 15px;
  font-weight: 500;
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

.modal-body {
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.modal-body::-webkit-scrollbar {
  display: none;
}

.detail-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.detail-avatar {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.detail-info {
  flex: 1;
}

.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.detail-author {
  font-size: 12px;
  color: #888;
}

.detail-section {
  margin-top: 12px;
}

.section-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.section-content {
  font-size: 13px;
  color: #ccc;
  line-height: 1.5;
  background: #2a2a2a;
  padding: 10px 12px;
  border-radius: 8px;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #333;
}

.chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #9c27b0;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.chat-btn.full {
  width: 100%;
  height: auto;
  padding: 10px 16px;
}

.chat-btn:hover {
  background: #7b1fa2;
}

/* ==================== NPC 关系网样式 ==================== */

.npc-section {
  margin-top: 16px;
}

.npc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.npc-preview-card {
  display: flex;
  gap: 10px;
  background: #2a2a2a;
  border-radius: 10px;
  padding: 10px;
  border: 1px solid #3a3a3a;
}

.npc-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.npc-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.npc-info {
  flex: 1;
  min-width: 0;
}

.npc-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.npc-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.npc-relation {
  font-size: 11px;
  color: #9c27b0;
}

.npc-bio {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  line-height: 1.4;
  word-break: break-word;
}
</style>
