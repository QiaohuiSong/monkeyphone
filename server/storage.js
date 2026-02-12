import fs from 'fs'
import path from 'path'

const DATA_DIR = './data'

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 获取用户数据目录
export function getUserDir(username) {
  const userDir = path.join(DATA_DIR, username)
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true })
  }
  return userDir
}

// 读取用户数据
export function readUserData(username, filename) {
  const filePath = path.join(getUserDir(username), filename)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  return null
}

// 写入用户数据
export function writeUserData(username, filename, data) {
  const filePath = path.join(getUserDir(username), filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// 获取用户信息
export function getUser(username) {
  return readUserData(username, 'user.json')
}

// 保存用户信息
export function saveUser(username, userData) {
  writeUserData(username, 'user.json', userData)
}

// 获取聊天记录
export function getChats(username) {
  return readUserData(username, 'chats.json') || []
}

// 保存聊天记录
export function saveChats(username, chats) {
  writeUserData(username, 'chats.json', chats)
}

// 添加聊天消息
export function addChat(username, message) {
  const chats = getChats(username)
  chats.push({
    ...message,
    id: Date.now(),
    created_at: new Date().toISOString()
  })
  saveChats(username, chats)
  return chats[chats.length - 1]
}

// 清空聊天记录
export function clearChats(username) {
  saveChats(username, [])
}

// 获取设置
export function getSettings(username) {
  return readUserData(username, 'settings.json') || {
    wallpaper: '',
    ai_model: 'gpt-3.5-turbo'
  }
}

// 保存设置
export function saveSettings(username, settings) {
  const current = getSettings(username)
  writeUserData(username, 'settings.json', { ...current, ...settings })
}

// 获取所有用户列表
export function getAllUsers() {
  if (!fs.existsSync(DATA_DIR)) {
    return []
  }
  return fs.readdirSync(DATA_DIR).filter(name => {
    const userPath = path.join(DATA_DIR, name)
    return fs.statSync(userPath).isDirectory() && name !== '_global'
  })
}

// ==================== 角色卡相关 ====================

const GLOBAL_DIR = path.join(DATA_DIR, '_global')

// 确保全局目录存在
function ensureGlobalDir() {
  if (!fs.existsSync(GLOBAL_DIR)) {
    fs.mkdirSync(GLOBAL_DIR, { recursive: true })
  }
}

// 获取用户的角色列表
export function getCharacters(username) {
  return readUserData(username, 'characters.json') || []
}

// 保存用户的角色列表
export function saveCharacters(username, characters) {
  writeUserData(username, 'characters.json', characters)
}

// 根据 ID 获取角色
export function getCharacterById(username, charId) {
  const characters = getCharacters(username)
  return characters.find(c => c.id === charId) || null
}

// 保存单个角色（创建或更新）
export function saveCharacter(username, character) {
  const characters = getCharacters(username)
  const index = characters.findIndex(c => c.id === character.id)

  if (index >= 0) {
    characters[index] = { ...characters[index], ...character, updatedAt: new Date().toISOString() }
  } else {
    characters.push({
      ...character,
      id: character.id || `char_${Date.now()}`,
      authorId: username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  saveCharacters(username, characters)
  return characters.find(c => c.id === character.id) || characters[characters.length - 1]
}

// 删除角色
export function deleteCharacter(username, charId) {
  const characters = getCharacters(username)
  const filtered = characters.filter(c => c.id !== charId)
  saveCharacters(username, filtered)
  // 同时从公开索引中移除
  removeFromPublicIndex(charId)
}

// ==================== 公开角色索引 ====================

// 获取公开角色列表
export function getPublicCharacters() {
  ensureGlobalDir()
  const filePath = path.join(GLOBAL_DIR, 'public_characters.json')
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  return []
}

// 保存公开角色列表
function savePublicCharacters(characters) {
  ensureGlobalDir()
  const filePath = path.join(GLOBAL_DIR, 'public_characters.json')
  fs.writeFileSync(filePath, JSON.stringify(characters, null, 2), 'utf-8')
}

// 添加到公开索引
export function addToPublicIndex(character) {
  const publicChars = getPublicCharacters()
  const index = publicChars.findIndex(c => c.id === character.id)

  // 处理 npcs：只保留姓名、头像、关系、简介，隐藏详细人设
  const safeNpcs = (character.npcs || []).map(npc => ({
    id: npc.id,
    name: npc.name,
    avatar: npc.avatar,
    relation: npc.relation,
    bio: npc.bio
    // 不包含 npc.persona（详细人设）
  }))

  const publicData = {
    id: character.id,
    authorId: character.authorId,
    name: character.name,
    avatar: character.avatar,
    bio: character.bio,
    npcs: safeNpcs,
    createdAt: character.createdAt
  }

  if (index >= 0) {
    publicChars[index] = publicData
  } else {
    publicChars.push(publicData)
  }

  savePublicCharacters(publicChars)
}

// 从公开索引移除
export function removeFromPublicIndex(charId) {
  const publicChars = getPublicCharacters()
  const filtered = publicChars.filter(c => c.id !== charId)
  savePublicCharacters(filtered)
}

// ==================== 角色聊天记录 ====================

// 获取角色聊天目录
function getCharChatDir(username) {
  const dir = path.join(getUserDir(username), 'char_chats')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// 获取与特定角色的聊天记录
export function getCharacterChats(username, charId) {
  const filePath = path.join(getCharChatDir(username), `${charId}.json`)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  return []
}

// 保存与特定角色的聊天记录
function saveCharacterChats(username, charId, chats) {
  const filePath = path.join(getCharChatDir(username), `${charId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(chats, null, 2), 'utf-8')
}

// 添加角色聊天消息
export function addCharacterChat(username, charId, message) {
  const chats = getCharacterChats(username, charId)
  chats.push({
    ...message,
    id: Date.now(),
    created_at: new Date().toISOString()
  })
  saveCharacterChats(username, charId, chats)
  return chats[chats.length - 1]
}

// 清空角色聊天记录
export function clearCharacterChats(username, charId) {
  saveCharacterChats(username, charId, [])
}

// 根据 ID 从任意来源获取角色（用于聊天）
export function findCharacterById(charId) {
  // 先从公开索引查找作者
  const publicChars = getPublicCharacters()
  const publicChar = publicChars.find(c => c.id === charId)

  if (publicChar) {
    // 从作者的角色列表获取完整数据
    return getCharacterById(publicChar.authorId, charId)
  }

  // 如果不在公开索引，遍历所有用户查找
  const users = getAllUsers()
  for (const username of users) {
    const char = getCharacterById(username, charId)
    if (char) return char
  }

  return null
}

// ==================== 好感度系统 ====================

// 等级配置
const AFFECTION_LEVELS = [
  { min: 0, max: 50, level: 1, title: '陌生人' },
  { min: 51, max: 100, level: 2, title: '点头之交' },
  { min: 101, max: 200, level: 3, title: '普通朋友' },
  { min: 201, max: 350, level: 4, title: '好朋友' },
  { min: 351, max: 500, level: 5, title: '密友' },
  { min: 501, max: 650, level: 6, title: '暧昧中' },
  { min: 651, max: 800, level: 7, title: '恋人' },
  { min: 801, max: 900, level: 8, title: '热恋' },
  { min: 901, max: 1000, level: 9, title: '挚爱' }
]

// 根据分数计算等级
function calculateAffectionLevel(score) {
  // 限制分数范围
  score = Math.max(0, Math.min(1000, score))

  for (const level of AFFECTION_LEVELS) {
    if (score >= level.min && score <= level.max) {
      return { level: level.level, title: level.title }
    }
  }
  return { level: 1, title: '陌生人' }
}

// 获取用户的所有好感度数据（按 sessionId 隔离）
export function getAllAffections(username, sessionId = 'player') {
  return readUserData(username, `affection-${sessionId}.json`) || {}
}

// 保存好感度数据（按 sessionId 隔离）
export function saveAllAffections(username, affections, sessionId = 'player') {
  writeUserData(username, `affection-${sessionId}.json`, affections)
}

// 获取某个角色的好感度
export function getAffection(username, charId, sessionId = 'player') {
  const affections = getAllAffections(username, sessionId)
  if (!affections[charId]) {
    // 初始化默认好感度
    return {
      score: 0,
      level: 1,
      level_title: '陌生人',
      history: []
    }
  }
  return affections[charId]
}

// 更新好感度
export function updateAffection(username, charId, change, reason, sessionId = 'player') {
  const affections = getAllAffections(username, sessionId)

  // 获取或初始化角色好感度
  if (!affections[charId]) {
    affections[charId] = {
      score: 0,
      level: 1,
      level_title: '陌生人',
      history: []
    }
  }

  const charAffection = affections[charId]
  const oldScore = charAffection.score
  const oldLevel = charAffection.level

  // 更新分数（限制在 0-1000 范围）
  charAffection.score = Math.max(0, Math.min(1000, charAffection.score + change))

  // 计算新等级
  const { level, title } = calculateAffectionLevel(charAffection.score)
  charAffection.level = level
  charAffection.level_title = title

  // 添加历史记录
  charAffection.history.unshift({
    date: new Date().toISOString(),
    change: change,
    reason: reason || '互动',
    oldScore: oldScore,
    newScore: charAffection.score
  })

  // 只保留最近 50 条历史
  if (charAffection.history.length > 50) {
    charAffection.history = charAffection.history.slice(0, 50)
  }

  // 保存
  saveAllAffections(username, affections, sessionId)

  // 返回更新结果
  return {
    charId,
    sessionId,
    oldScore,
    newScore: charAffection.score,
    change,
    reason,
    level: charAffection.level,
    level_title: charAffection.level_title,
    levelUp: level > oldLevel,
    levelDown: level < oldLevel
  }
}

// 获取用户所有可用的 sessionId 列表（从好感度文件推断）
export function getAffectionSessionIds(username) {
  const userDir = getUserDir(username)
  if (!fs.existsSync(userDir)) {
    return ['player']
  }

  const files = fs.readdirSync(userDir)
  const sessionIds = files
    .filter(f => f.startsWith('affection-') && f.endsWith('.json'))
    .map(f => f.replace('affection-', '').replace('.json', ''))

  // 确保至少有 player
  if (!sessionIds.includes('player')) {
    sessionIds.unshift('player')
  }

  return sessionIds
}

// 获取等级配置（供前端使用）
export function getAffectionLevels() {
  return AFFECTION_LEVELS
}
