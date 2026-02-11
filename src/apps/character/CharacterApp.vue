<script setup>
import { ref } from 'vue'
import CharacterList from './components/CharacterList.vue'
import CharacterPlaza from './components/CharacterPlaza.vue'
import CharacterForm from './components/CharacterForm.vue'

const activeTab = ref('my')
const showForm = ref(false)
const editingCharacter = ref(null)
const characterListRef = ref(null)

function openCreateForm() {
  editingCharacter.value = null
  showForm.value = true
}

function openEditForm(character) {
  editingCharacter.value = character
  showForm.value = true
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
</style>
