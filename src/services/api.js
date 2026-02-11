// 使用相对路径，通过 Vite 代理访问后端
const API_BASE = ''

// 获取存储的 token
function getToken() {
  return localStorage.getItem('auth_token')
}

// 设置 token
export function setToken(token) {
  localStorage.setItem('auth_token', token)
}

// 清除 token
export function clearToken() {
  localStorage.removeItem('auth_token')
}

// 检查是否已登录
export function isLoggedIn() {
  return !!getToken()
}

// 通用请求方法
async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })

  // 检查响应内容类型
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('服务器返回了非 JSON 响应，请检查后端服务是否正常运行')
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || '请求失败')
  }

  return data
}

// ==================== 认证 API ====================

export async function login(username, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  setToken(data.data.token)
  return data.data.user
}

export async function getUserInfo() {
  const data = await request('/api/user/info')
  return data.data
}

export function logout() {
  clearToken()
}

// ==================== 聊天 API ====================

export async function getChatHistory() {
  const data = await request('/api/chat/history')
  return data.data
}

export async function sendMessage(message) {
  const data = await request('/api/chat/send', {
    method: 'POST',
    body: JSON.stringify({ message })
  })
  return data.data
}

export async function clearChatHistory() {
  await request('/api/chat/clear', { method: 'DELETE' })
}

// ==================== 设置 API ====================

export async function getSettings() {
  const data = await request('/api/settings')
  return data.data
}

export async function updateSettings(settings) {
  await request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}

export async function updateApiKey(apiKey) {
  await request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ api_key: apiKey })
  })
}

// ==================== 模型 API ====================

export async function getModels() {
  const data = await request('/api/models')
  return data.data
}

// ==================== 角色卡 API ====================

export async function getMyCharacters() {
  const data = await request('/api/characters')
  return data.data
}

export async function getCharacter(id) {
  const data = await request(`/api/characters/${id}`)
  return data.data
}

export async function createCharacter(character) {
  const data = await request('/api/characters', {
    method: 'POST',
    body: JSON.stringify(character)
  })
  return data.data
}

export async function updateCharacter(id, character) {
  const data = await request(`/api/characters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(character)
  })
  return data.data
}

export async function deleteCharacter(id) {
  await request(`/api/characters/${id}`, { method: 'DELETE' })
}

// ==================== 角色广场 API ====================

export async function getPlazaCharacters() {
  const data = await request('/api/plaza/characters')
  return data.data
}

export async function getCharacterForChat(charId) {
  const data = await request(`/api/plaza/characters/${charId}/chat`)
  return data.data
}

// ==================== 角色聊天 API ====================

export async function getCharacterChatHistory(charId) {
  const data = await request(`/api/chat/character/${charId}/history`)
  return data.data
}

export async function sendCharacterMessage(charId, message) {
  const data = await request(`/api/chat/character/${charId}/send`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
  return data.data
}

export async function clearCharacterChatHistory(charId) {
  await request(`/api/chat/character/${charId}/clear`, { method: 'DELETE' })
}

// ==================== 角色导入导出 API ====================

export function exportCharacterJson(id) {
  const token = getToken()
  window.open(`${API_BASE}/api/characters/${id}/export/json?token=${token}`)
}

export async function importCharacterJson(characterData) {
  const data = await request('/api/characters/import/json', {
    method: 'POST',
    body: JSON.stringify(characterData)
  })
  return data.data
}

// ==================== 人设 API ====================

export async function getPersonas() {
  const data = await request('/api/user/personas')
  return data.data
}

export async function createPersona(persona) {
  const data = await request('/api/user/personas', {
    method: 'POST',
    body: JSON.stringify(persona)
  })
  return data.data
}

export async function updatePersona(id, persona) {
  const data = await request(`/api/user/personas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(persona)
  })
  return data.data
}

export async function deletePersona(id) {
  await request(`/api/user/personas/${id}`, { method: 'DELETE' })
}

// ==================== 记忆系统 API ====================

export async function getMemory(charId) {
  const data = await request(`/api/wechat/${charId}/memory`)
  return data.data
}

export async function updateMemory(charId, memory) {
  const data = await request(`/api/wechat/${charId}/memory`, {
    method: 'PUT',
    body: JSON.stringify(memory)
  })
  return data.data
}

export async function triggerSummarize(charId) {
  const data = await request(`/api/wechat/${charId}/memory/summarize`, {
    method: 'POST'
  })
  return data.data
}
