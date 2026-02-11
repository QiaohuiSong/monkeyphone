<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { installedApps } from '../apps/registry.js'
import { ChevronLeft } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const currentApp = computed(() => {
  return installedApps.value.find(app => app.id === route.params.id)
})

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="app-container">
    <div class="app-header" v-if="currentApp">
      <button class="back-btn" @click="goBack">
        <ChevronLeft :size="24" />
      </button>
      <span class="app-title">{{ currentApp.name }}</span>
    </div>
    <div class="app-content">
      <component :is="currentApp?.component" v-if="currentApp" />
      <div v-else class="not-found">应用未找到</div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.app-header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: #fff;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.app-title {
  font-size: 16px;
  font-weight: 600;
}

.app-content {
  flex: 1;
  overflow: auto;
}

.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}
</style>
