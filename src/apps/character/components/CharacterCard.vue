<script setup>
import { computed } from 'vue'

const props = defineProps({
  character: {
    type: Object,
    required: true
  },
  showPersona: {
    type: Boolean,
    default: false
  }
})

const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="#9c27b0" width="100" height="100"/>
    <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">?</text>
  </svg>
`)

const avatarSrc = computed(() => props.character.avatar || defaultAvatar)
</script>

<template>
  <div class="character-card">
    <img :src="avatarSrc" class="avatar" alt="" />
    <div class="info">
      <div class="header">
        <span class="name">{{ character.name }}</span>
        <span v-if="character.isPublic" class="badge public">公开</span>
        <span v-else class="badge private">私有</span>
      </div>
      <div class="bio">{{ character.bio || '暂无简介' }}</div>
    </div>
  </div>
</template>

<style scoped>
.character-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #2a2a2a;
  border-radius: 10px;
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
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.bio {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
}

.badge.public {
  background: #1b5e20;
  color: #81c784;
}

.badge.private {
  background: #333;
  color: #888;
}
</style>
