// 使用相对路径，通过 Vite 代理访问后端
const API_BASE = ''

function getToken() {
  return localStorage.getItem('auth_token')
}

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

// ==================== 微信资料 API ====================

export async function getWechatProfile(charId) {
  const data = await request(`/api/wechat/${charId}/profile`)
  return data.data
}

export async function updateWechatProfile(charId, profile) {
  const data = await request(`/api/wechat/${charId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profile)
  })
  return data.data
}

// ==================== 图片上传 API ====================

export async function uploadWechatImage(charId, file, type) {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)
  if (type) {
    formData.append('type', type)
  }

  const response = await fetch(`${API_BASE}/api/wechat/${charId}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || '上传失败')
  }
  return data.data
}

export function getAssetUrl(charId, filename) {
  return `${API_BASE}/api/wechat/${charId}/assets/${filename}`
}

// ==================== 朋友圈 API ====================

export async function getMoments(charId) {
  const data = await request(`/api/wechat/${charId}/moments`)
  return data.data
}

export async function postMoment(charId, moment) {
  const data = await request(`/api/wechat/${charId}/moments`, {
    method: 'POST',
    body: JSON.stringify(moment)
  })
  return data.data
}

export async function deleteMoment(charId, momentId) {
  await request(`/api/wechat/${charId}/moments/${momentId}`, {
    method: 'DELETE'
  })
}

// ==================== 聊天会话 API ====================

export async function getChatSessions(charId) {
  const data = await request(`/api/wechat/${charId}/sessions`)
  return data.data
}

export async function getChatMessages(charId, sessionId, options = {}) {
  const { limit, beforeIndex } = options
  let url = `/api/wechat/${charId}/chats/${sessionId}`
  const params = new URLSearchParams()
  if (limit) params.append('limit', limit)
  if (beforeIndex !== undefined) params.append('beforeIndex', beforeIndex)
  const queryString = params.toString()
  if (queryString) url += `?${queryString}`

  const data = await request(url)
  return data
}

export async function sendChatMessage(charId, text, sessionId = 'player', sender = 'player', senderName, options = {}) {
  const { type, redpacketData, transferData, stickerUrl } = options
  const body = { sessionId, text, sender, senderName }
  if (type) body.type = type
  if (redpacketData) body.redpacketData = redpacketData
  if (transferData) body.transferData = transferData
  if (stickerUrl) body.stickerUrl = stickerUrl

  const data = await request(`/api/wechat/${charId}/send`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  return data.data
}

export async function updateChatMessage(charId, sessionId, messageId, updates) {
  const data = await request(`/api/wechat/${charId}/chats/${sessionId}/message/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
  return data
}

export async function deleteChatMessage(charId, sessionId, messageId) {
  const data = await request(`/api/wechat/${charId}/chats/${sessionId}/message/${messageId}`, {
    method: 'DELETE'
  })
  return data
}

export async function clearChatSession(charId, sessionId) {
  await request(`/api/wechat/${charId}/chats/${sessionId}`, {
    method: 'DELETE'
  })
}

// ==================== AI 聊天 API (复用角色聊天) ====================

export async function sendAIMessage(charId, message) {
  const data = await request(`/api/chat/character/${charId}/send`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
  return data.data
}

// ==================== 人设绑定 API ====================

export async function bindPersona(charId, personaId) {
  const data = await request(`/api/wechat/${charId}/bind_persona`, {
    method: 'POST',
    body: JSON.stringify({ personaId })
  })
  return data.data
}

// ==================== 玩家朋友圈 API ====================

export async function getPlayerMoments() {
  const data = await request('/api/player/moments')
  return data.data
}

export async function savePlayerMoments(moments) {
  const data = await request('/api/player/moments', {
    method: 'PUT',
    body: JSON.stringify({ moments })
  })
  return data.success
}

export async function postPlayerMoment(moment) {
  const data = await request('/api/player/moments', {
    method: 'POST',
    body: JSON.stringify(moment)
  })
  return data.data
}

export async function deletePlayerMoment(momentId) {
  await request(`/api/player/moments/${momentId}`, {
    method: 'DELETE'
  })
}
