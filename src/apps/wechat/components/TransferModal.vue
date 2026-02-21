<script setup>
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, default: false },
  toName: { type: String, default: '好友' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'confirm'])

const amount = ref('')
const note = ref('')

watch(() => props.visible, (visible) => {
  if (visible) {
    amount.value = ''
    note.value = ''
  }
})

function handleConfirm() {
  emit('confirm', {
    amount: amount.value,
    content: note.value
  })
}
</script>

<template>
  <div v-if="visible" class="transfer-modal-overlay" @click.self="emit('close')">
    <div class="transfer-modal">
      <div class="transfer-modal-header">
        <span class="title">转账</span>
        <button class="close-btn" :disabled="loading" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="transfer-modal-body">
        <div class="transfer-to">
          <span class="to-label">转账给</span>
          <span class="to-name">{{ toName }}</span>
        </div>

        <div class="amount-input-section">
          <span class="currency-symbol">¥</span>
          <input
            v-model="amount"
            type="number"
            min="0"
            step="0.01"
            class="transfer-amount-input"
            placeholder="0.00"
          />
        </div>

        <input
          v-model="note"
          class="transfer-note-input"
          type="text"
          maxlength="50"
          placeholder="添加转账说明"
        />
      </div>

      <div class="transfer-modal-footer">
        <button class="send-transfer-btn" :disabled="loading" @click="handleConfirm">
          {{ loading ? '发送中...' : '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transfer-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.transfer-modal {
  width: 90%;
  max-width: 320px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.transfer-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

.title {
  font-size: 17px;
  font-weight: 500;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.transfer-modal-body {
  padding: 24px 20px 16px;
}

.transfer-to {
  text-align: center;
  margin-bottom: 24px;
}

.to-label {
  font-size: 14px;
  color: #999;
  margin-right: 8px;
}

.to-name {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.amount-input-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  border-bottom: 1px solid #eee;
}

.currency-symbol {
  font-size: 32px;
  color: #333;
  font-weight: 500;
  margin-right: 4px;
}

.transfer-amount-input {
  border: none;
  outline: none;
  font-size: 48px;
  font-weight: 600;
  color: #333;
  text-align: center;
  width: 180px;
  appearance: textfield;
  -moz-appearance: textfield;
  overflow: hidden;
}

.transfer-amount-input::placeholder {
  color: #ccc;
}

.transfer-amount-input::-webkit-outer-spin-button,
.transfer-amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.transfer-note-input {
  width: 100%;
  margin-top: 16px;
  padding: 10px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.transfer-note-input:focus {
  border-color: #f5c78e;
}

.transfer-modal-footer {
  padding: 16px 20px 24px;
}

.send-transfer-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #f9d5a0 0%, #f5c78e 100%);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
}

.send-transfer-btn:disabled,
.close-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
