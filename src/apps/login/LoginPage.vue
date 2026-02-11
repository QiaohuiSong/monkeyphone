<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, LogIn } from 'lucide-vue-next'
import { login } from '../../services/api.js'

const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await login(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">
        <div class="logo-icon">🐵</div>
        <h1>MonkeyPhone</h1>
      </div>

      <div class="form">
        <div class="input-group">
          <User :size="20" class="input-icon" />
          <input
            v-model="username"
            type="text"
            placeholder="用户名"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="input-group">
          <Lock :size="20" class="input-icon" />
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            @keyup.enter="handleLogin"
          />
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <button class="login-btn" @click="handleLogin" :disabled="loading">
          <LogIn :size="20" v-if="!loading" />
          <span>{{ loading ? '登录中...' : '登录' }}</span>
        </button>
      </div>

      <p class="hint">使用 NewAPI 账号登录</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 320px;
  padding: 32px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.logo h1 {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.input-group input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: background 0.2s;
}

.input-group input::placeholder {
  color: #666;
}

.input-group input:focus {
  background: rgba(255, 255, 255, 0.15);
}

.error {
  padding: 10px 14px;
  background: rgba(229, 57, 53, 0.2);
  border-radius: 8px;
  color: #e53935;
  font-size: 13px;
  text-align: center;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #e53935 0%, #d32f2f 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.login-btn:active {
  transform: scale(0.98);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  color: #666;
}
</style>
