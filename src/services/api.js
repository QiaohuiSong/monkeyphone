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

// 获取我的角色列表（简要模式，用于列表显示）
export async function getMyCharacters(brief = true) {
  const data = await request(`/api/characters${brief ? '?brief=true' : ''}`)
  return data.data
}

// 获取我的角色列表（完整模式，用于编辑等场景）
export async function getMyCharactersFull() {
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

// ==================== 自定义 NPC API ====================

export async function getCustomNpcs() {
  const data = await request('/api/user/custom-npcs')
  return data.data
}

export async function createCustomNpc(npc) {
  const data = await request('/api/user/custom-npcs', {
    method: 'POST',
    body: JSON.stringify(npc)
  })
  return data.data
}

export async function updateCustomNpc(id, npc) {
  const data = await request(`/api/user/custom-npcs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(npc)
  })
  return data.data
}

export async function deleteCustomNpc(id) {
  await request(`/api/user/custom-npcs/${id}`, { method: 'DELETE' })
}

// ==================== 群聊 API ====================

// 获取群列表
export async function getGroups() {
  const data = await request('/api/groups')
  return data.data
}

// 创建群
export async function createGroup(groupData) {
  const data = await request('/api/groups', {
    method: 'POST',
    body: JSON.stringify(groupData)
  })
  return data.data
}

// 获取单个群
export async function getGroup(groupId) {
  const data = await request(`/api/groups/${groupId}`)
  return data.data
}

// 更新群
export async function updateGroup(groupId, groupData) {
  const data = await request(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(groupData)
  })
  return data.data
}

// 删除群
export async function deleteGroup(groupId) {
  await request(`/api/groups/${groupId}`, { method: 'DELETE' })
}

// 获取群聊记录
export async function getGroupChats(groupId) {
  const data = await request(`/api/groups/${groupId}/chats`)
  return data.data
}

// 仅发送群消息（不触发 AI）
export async function sendGroupMessageOnly(groupId, text) {
  const data = await request(`/api/groups/${groupId}/chats/send`, {
    method: 'POST',
    body: JSON.stringify({ text })
  })
  return data.data
}

// 触发群 AI 回复
export async function triggerGroupAI(groupId) {
  const data = await request(`/api/groups/${groupId}/chats/ai`, {
    method: 'POST'
  })
  return data.data
}

// 清空群聊记录
export async function clearGroupChats(groupId) {
  await request(`/api/groups/${groupId}/chats`, { method: 'DELETE' })
}

// 删除单条群消息
export async function deleteGroupChatMessage(groupId, messageId) {
  await request(`/api/groups/${groupId}/chats/${messageId}`, { method: 'DELETE' })
}

// 更新单条群消息（撤回等）
export async function updateGroupChatMessage(groupId, messageId, updates) {
  const data = await request(`/api/groups/${groupId}/chats/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
  return data.data
}

// ==================== 群红包 API ====================

// 获取群红包列表
export async function getGroupRedPackets(groupId) {
  const data = await request(`/api/groups/${groupId}/red-packets`)
  return data.data
}

// 发红包
export async function sendRedPacket(groupId, packetData) {
  const data = await request(`/api/groups/${groupId}/red-packets`, {
    method: 'POST',
    body: JSON.stringify(packetData)
  })
  return data.data
}

// 获取红包详情
export async function getRedPacket(groupId, packetId) {
  const data = await request(`/api/groups/${groupId}/red-packets/${packetId}`)
  return data.data
}

// 抢红包
export async function grabRedPacket(groupId, packetId, grabber) {
  const data = await request(`/api/groups/${groupId}/red-packets/${packetId}/grab`, {
    method: 'POST',
    body: JSON.stringify(grabber)
  })
  return data.data
}
