<script setup>
import { ref } from 'vue'
import CharacterList from './components/CharacterList.vue'
import CharacterPlaza from './components/CharacterPlaza.vue'
import CharacterForm from './components/CharacterForm.vue'
import { getCharacter } from '../../services/api.js'

const activeTab = ref('my')
const showForm = ref(false)
const editingCharacter = ref(null)
const characterListRef = ref(null)
const loadingCharacter = ref(false)

function openCreateForm() {
  editingCharacter.value = null
  showForm.value = true
}

async function openEditForm(character) {
  // 先获取完整的角色数据，因为列表返回的是简要数据
  loadingCharacter.value = true
  try {
    const fullCharacter = await getCharacter(character.id)
    editingCharacter.value = fullCharacter
    showForm.value = true
  } catch (e) {
    alert('加载角色数据失败: ' + e.message)
  } finally {
    loadingCharacter.value = false
  }
}

function closeForm() {
  showForm.value = false
  editingCharacter.value = null
}

function onSaved() {
  closeForm()
  // 刷新角色列表
  characterListRef.value?.loadCharacters?.()
}
</script>

<template>
  <div class="character-app">
    <!-- 标签页切换 -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'my' }]"
        @click="activeTab = 'my'"
      >
        我的角色
      </button>
      <button
        :class="['tab', { active: activeTab === 'plaza' }]"
        @click="activeTab = 'plaza'"
      >
        角色广场
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content">
      <CharacterList
        v-if="activeTab === 'my'"
        ref="characterListRef"
        @create="openCreateForm"
        @edit="openEditForm"
      />
      <CharacterPlaza v-else />
    </div>

    <!-- 创建/编辑表单弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <CharacterForm
          :character="editingCharacter"
          @saved="onSaved"
          @cancel="closeForm"
        />
      </div>
    </div>

    <!-- 加载中遮罩 -->
    <div v-if="loadingCharacter" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>
</template>

<style scoped>
.character-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.tabs {
  display: flex;
  background: #222;
  border-bottom: 1px solid #333;
}

.tab {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  color: #fff;
  border-bottom: 2px solid #9c27b0;
}

.content {
  flex: 1;
  overflow-y: auto;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  box-sizing: border-box;
}

.modal {
  width: 90%;
  max-width: 340px;
  height: auto;
  max-height: calc(100% - 32px);
  background: #222;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  color: #fff;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333;
  border-top-color: #9c27b0;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
