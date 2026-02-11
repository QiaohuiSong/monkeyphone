<script setup>
import { ref, onMounted, computed } from 'vue'
import { ArrowLeft, Heart, MessageCircle, MoreHorizontal } from 'lucide-vue-next'
import {
  getMoments,
  getWechatProfile
} from '../../services/wechatApi.js'
import { getCharacterForChat } from '../../services/api.js'

const props = defineProps({
  charId: { type: String, required: true }
})

const emit = defineEmits(['back'])

const moments = ref([])
const profile = ref(null)
const character = ref(null)
const loading = ref(true)

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [momentsData, profileData, charData] = await Promise.all([
      getMoments(props.charId),
      getWechatProfile(props.charId),
      getCharacterForChat(props.charId).catch(() => null)
    ])
    moments.value = momentsData
    profile.value = profileData
    character.value = charData
  } catch (e) {
    console.error('加载朋友圈失败:', e)
  } finally {
    loading.value = false
  }
}

function goBack() {
  emit('back')
}

// 获取显示名称
const displayName = computed(() => {
  return profile.value?.nickname || character.value?.name || '角色'
})

// 获取头像
const displayAvatar = computed(() => {
  return profile.value?.avatar || character.value?.avatar || ''
})

// 点赞
function toggleLike(moment) {
  const myId = 'player'
  const index = moment.likes.indexOf(myId)
  if (index >= 0) {
    moment.likes.splice(index, 1)
  } else {
    moment.likes.push(myId)
  }
}

function isLiked(moment) {
  return moment.likes.includes('player')
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString()
}
</script>

<template>
  <div class="moments-view">
    <!-- 顶部导航 -->
    <div class="header">
      <button class="icon-btn" @click="goBack">
        <ArrowLeft :size="22" />
      </button>
      <span class="title">{{ displayName }}的相册</span>
      <div style="width: 36px"></div>
    </div>

    <!-- 封面区域（只读，不可修改） -->
    <div class="cover-section">
      <div
        class="cover-image"
        :style="profile?.coverImage ? { backgroundImage: `url(${profile.coverImage})` } : {}"
      >
      </div>

      <!-- 悬浮头像（只读） -->
      <div class="profile-float">
        <span class="nickname">{{ displayName }}</span>
        <div class="avatar">
          <img v-if="displayAvatar" :src="displayAvatar" />
          <span v-else>{{ displayName?.[0] || '?' }}</span>
        </div>
      </div>
    </div>

    <!-- 动态列表 -->
    <div class="moments-list">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="moments.length === 0" class="empty">
        TA还没有发过动态
      </div>

      <div v-else v-for="moment in moments" :key="moment.id" class="moment-item">
        <!-- 头像 -->
        <div class="moment-avatar">
          <img v-if="displayAvatar" :src="displayAvatar" />
          <span v-else>{{ displayName?.[0] || '?' }}</span>
        </div>

        <!-- 内容 -->
        <div class="moment-content">
          <div class="moment-author">{{ displayName }}</div>

          <div v-if="moment.content" class="moment-text">{{ moment.content }}</div>

          <!-- 图片网格 -->
          <div v-if="moment.images?.length" class="moment-images" :class="`grid-${Math.min(moment.images.length, 3)}`">
            <img
              v-for="(img, idx) in moment.images"
              :key="idx"
              :src="img"
              class="moment-img"
            />
          </div>

          <!-- 位置信息 -->
          <div v-if="moment.location" class="moment-location">
            📍 {{ moment.location }}
          </div>

          <!-- 时间和操作 -->
          <div class="moment-footer">
            <span class="moment-time">{{ formatTime(moment.createdAt) }}</span>

            <div class="moment-actions">
              <button class="action-btn" :class="{ liked: isLiked(moment) }" @click="toggleLike(moment)">
                <Heart :size="16" :fill="isLiked(moment) ? '#e53935' : 'none'" />
                <span v-if="moment.likes.length">{{ moment.likes.length }}</span>
              </button>

              <button class="action-btn">
                <MessageCircle :size="16" />
              </button>
            </div>
          </div>

          <!-- 点赞列表 -->
          <div v-if="moment.likes.length" class="likes-section">
            <Heart :size="14" fill="#e53935" />
            <span>{{ moment.likes.length }}人觉得很赞</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.moments-view {
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
  background: #ededed;
  border-bottom: 1px solid #d9d9d9;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .title {
  font-size: 17px;
  font-weight: 500;
  color: #000;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 封面区域 */
.cover-section {
  position: relative;
}

.cover-image {
  height: 280px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-size: cover;
  background-position: center;
}

.profile-float {
  position: absolute;
  bottom: -30px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-float .nickname {
  font-size: 17px;
  font-weight: 500;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.profile-float .avatar {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  background: #ccc;
  border: 3px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.profile-float .avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-float .avatar span {
  font-size: 28px;
  color: #fff;
}

/* 动态列表 */
.moments-list {
  flex: 1;
  overflow-y: auto;
  padding-top: 50px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.moment-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.moment-avatar {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.moment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-avatar span {
  font-size: 18px;
  color: #fff;
}

.moment-content {
  flex: 1;
  min-width: 0;
}

.moment-author {
  font-size: 15px;
  font-weight: 500;
  color: #576b95;
  margin-bottom: 6px;
}

.moment-text {
  font-size: 15px;
  color: #000;
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-word;
}

.moment-images {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.moment-images.grid-1 {
  grid-template-columns: 1fr;
  max-width: 200px;
}

.moment-images.grid-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 280px;
}

.moment-images.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.moment-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}

.moment-location {
  font-size: 12px;
  color: #576b95;
  margin-bottom: 8px;
}

.moment-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.moment-time {
  font-size: 12px;
  color: #999;
}

.moment-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 12px;
}

.action-btn.liked {
  color: #e53935;
}

.likes-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: #f7f7f7;
  border-radius: 4px;
  font-size: 13px;
  color: #576b95;
}
</style>
