<script setup>
import { ref } from 'vue'
import { Heart, MessageCircle } from 'lucide-vue-next'

const moments = ref([
  {
    id: 1,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    name: '小明',
    content: '今天去爬山了，风景超美！推荐大家有空也去看看~',
    image: 'https://picsum.photos/seed/mountain/400/300',
    likes: 24,
    comments: 5
  },
  {
    id: 2,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    name: '月亮姐姐',
    content: '新学的拿铁拉花，感觉还不错？',
    image: 'https://picsum.photos/seed/coffee/400/300',
    likes: 56,
    comments: 12
  },
  {
    id: 3,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
    name: '程序猿阿强',
    content: '终于把 bug 修完了，下班！',
    image: 'https://picsum.photos/seed/coding/400/300',
    likes: 128,
    comments: 23
  }
])
</script>

<template>
  <div class="moments">
    <div class="moment-item" v-for="moment in moments" :key="moment.id">
      <div class="header">
        <img :src="moment.avatar" class="avatar" />
        <span class="name">{{ moment.name }}</span>
      </div>
      <p class="content">{{ moment.content }}</p>
      <img :src="moment.image" class="moment-image" />
      <div class="actions">
        <span class="action">
          <Heart :size="16" /> {{ moment.likes }}
        </span>
        <span class="action">
          <MessageCircle :size="16" /> {{ moment.comments }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.moments {
  height: 100%;
  overflow-y: auto;
  background: #1a1a1a;
  padding: 12px;
}

.moment-item {
  background: #222;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #333;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.content {
  font-size: 14px;
  color: #ddd;
  line-height: 1.5;
  margin: 0 0 12px 0;
}

.moment-image {
  width: 100%;
  border-radius: 8px;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 20px;
}

.action {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #888;
}
</style>
