// 好感度 API 服务

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

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || '请求失败')
  }

  return data
}

// 获取所有角色的好感度（支持 sessionId 隔离）
export async function getAllAffections(sessionId = 'player') {
  const data = await request(`/api/affection?sessionId=${encodeURIComponent(sessionId)}`)
  return data.data
}

// 获取某个角色的好感度
export async function getAffection(charId, sessionId = 'player') {
  const data = await request(`/api/affection/${charId}?sessionId=${encodeURIComponent(sessionId)}`)
  return data.data
}

// 获取好感度等级配置
export async function getAffectionLevels() {
  const data = await request('/api/affection-levels')
  return data.data
}

// 获取所有可用的 sessionId 列表
export async function getAffectionSessions() {
  const data = await request('/api/affection-sessions')
  return data.data
}
