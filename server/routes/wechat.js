import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import multer from 'multer'
import { authMiddleware } from '../auth.js'
import { getCharacterById, findCharacterById } from '../storage.js'

const router = express.Router()

// 简单的文件锁实现
const locks = new Map()

async function withLock(key, fn) {
  while (locks.get(key)) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  locks.set(key, true)
  try {
    return await fn()
  } finally {
    locks.delete(key)
  }
}

// 获取角色微信数据目录
function getWechatDir(username, charId) {
  return path.join('./data', username, 'characters', charId, 'wechat')
}

// 确保微信目录结构存在
async function ensureWechatStructure(username, charId) {
  const wechatDir = getWechatDir(username, charId)
  const assetsDir = path.join(wechatDir, 'assets')
  const chatsDir = path.join(wechatDir, 'chats')

  await fs.ensureDir(assetsDir)
  await fs.ensureDir(chatsDir)

  return { wechatDir, assetsDir, chatsDir }
}

// 生成随机微信号
function generateWxId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'wxid_'
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 初始化角色微信数据
export async function initWechatData(username, charId, characterName = '未命名') {
  const { wechatDir, chatsDir } = await ensureWechatStructure(username, charId)

  const profilePath = path.join(wechatDir, 'profile.json')
  const momentsPath = path.join(wechatDir, 'moments.json')
  const teamChatPath = path.join(chatsDir, 'npc_team.jsonl')

  // 初始化 profile.json
  if (!await fs.pathExists(profilePath)) {
    const profile = {
      wxId: generateWxId(),
      nickname: characterName,
      signature: '',
      avatar: '',
      coverImage: '',
      chatBackground: '',
      createdAt: new Date().toISOString()
    }
    await fs.writeJson(profilePath, profile, { spaces: 2 })
  }

  // 初始化 moments.json
  if (!await fs.pathExists(momentsPath)) {
    await fs.writeJson(momentsPath, [], { spaces: 2 })
  }

  // 初始化 npc_team.jsonl (微信团队预设对话)
  if (!await fs.pathExists(teamChatPath)) {
    const teamMessages = [
      {
        id: Date.now(),
        sender: 'npc',
        senderName: '微信团队',
        text: '欢迎使用微信！如有任何问题，请随时联系我们。',
        timestamp: new Date(Date.now() - 86400000 * 30).toISOString()
      },
      {
        id: Date.now() + 1,
        sender: 'character',
        text: '好的，谢谢',
        timestamp: new Date(Date.now() - 86400000 * 30 + 60000).toISOString()
      },
      {
        id: Date.now() + 2,
        sender: 'npc',
        senderName: '微信团队',
        text: '您的账号已完成实名认证，感谢您的配合。',
        timestamp: new Date(Date.now() - 86400000 * 7).toISOString()
      }
    ]
    const content = teamMessages.map(m => JSON.stringify(m)).join('\n')
    await fs.writeFile(teamChatPath, content + '\n', 'utf-8')
  }

  return { wechatDir, chatsDir }
}

// Multer 配置 - 动态存储路径
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { charId } = req.params
      const username = req.user.username
      const { assetsDir } = await ensureWechatStructure(username, charId)
      cb(null, assetsDir)
    } catch (err) {
      cb(err)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mime = allowedTypes.test(file.mimetype)
    if (ext && mime) {
      cb(null, true)
    } else {
      cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp)'))
    }
  }
})

// ==================== API 路由 ====================

// 获取角色微信资料
router.get('/:charId/profile', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const wechatDir = getWechatDir(username, charId)
    const profilePath = path.join(wechatDir, 'profile.json')

    // 获取角色信息 - 先从用户自己的角色找，找不到再从全局找（支持角色广场）
    let character = getCharacterById(username, charId)
    if (!character) {
      character = findCharacterById(charId)
    }
    const characterName = character?.name || '未命名'

    if (!await fs.pathExists(profilePath)) {
      // 自动初始化，使用角色名称
      await initWechatData(username, charId, characterName)
    }

    const profile = await fs.readJson(profilePath)

    // 如果昵称为空或为"未命名"，使用角色名称并持久化
    let needSave = false
    if (!profile.nickname || profile.nickname === '未命名') {
      profile.nickname = characterName
      needSave = true
    }

    // 如果头像为空，使用角色头像
    if (!profile.avatar && character?.avatar) {
      profile.avatar = character.avatar
      needSave = true
    }

    // 持久化更新
    if (needSave) {
      profile.updatedAt = new Date().toISOString()
      await fs.writeJson(profilePath, profile, { spaces: 2 })
    }

    res.json({ success: true, data: profile })
  } catch (error) {
    console.error('获取微信资料失败:', error)
    res.status(500).json({ error: '获取微信资料失败' })
  }
})

// 更新角色微信资料
router.put('/:charId/profile', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const wechatDir = getWechatDir(username, charId)
    const profilePath = path.join(wechatDir, 'profile.json')

    await withLock(`profile:${username}:${charId}`, async () => {
      if (!await fs.pathExists(profilePath)) {
        await initWechatData(username, charId)
      }

      const profile = await fs.readJson(profilePath)
      const { nickname, signature, avatar, coverImage, chatBackground } = req.body

      if (nickname !== undefined) profile.nickname = nickname
      if (signature !== undefined) profile.signature = signature
      if (avatar !== undefined) profile.avatar = avatar
      if (coverImage !== undefined) profile.coverImage = coverImage
      if (chatBackground !== undefined) profile.chatBackground = chatBackground
      profile.updatedAt = new Date().toISOString()

      await fs.writeJson(profilePath, profile, { spaces: 2 })
      res.json({ success: true, data: profile })
    })
  } catch (error) {
    console.error('更新微信资料失败:', error)
    res.status(500).json({ error: '更新微信资料失败' })
  }
})

// 上传图片
router.post('/:charId/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' })
    }

    const { charId } = req.params
    const username = req.user.username
    const { type } = req.body // avatar, cover, background, moment

    // 构建相对路径 (用于前端访问)
    const relativePath = `/api/wechat/${charId}/assets/${req.file.filename}`

    // 如果指定了类型，自动更新 profile
    if (type && ['avatar', 'cover', 'background'].includes(type)) {
      const wechatDir = getWechatDir(username, charId)
      const profilePath = path.join(wechatDir, 'profile.json')

      await withLock(`profile:${username}:${charId}`, async () => {
        const profile = await fs.readJson(profilePath)
        if (type === 'avatar') profile.avatar = relativePath
        else if (type === 'cover') profile.coverImage = relativePath
        else if (type === 'background') profile.chatBackground = relativePath
        profile.updatedAt = new Date().toISOString()
        await fs.writeJson(profilePath, profile, { spaces: 2 })
      })
    }

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        path: relativePath,
        size: req.file.size
      }
    })
  } catch (error) {
    console.error('上传图片失败:', error)
    res.status(500).json({ error: error.message || '上传图片失败' })
  }
})

// 静态文件服务 - 访问 assets 目录
router.get('/:charId/assets/:filename', authMiddleware, async (req, res) => {
  try {
    const { charId, filename } = req.params
    const username = req.user.username
    const filePath = path.join(getWechatDir(username, charId), 'assets', filename)

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    res.sendFile(path.resolve(filePath))
  } catch (error) {
    console.error('获取文件失败:', error)
    res.status(500).json({ error: '获取文件失败' })
  }
})

// 获取朋友圈
router.get('/:charId/moments', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const wechatDir = getWechatDir(username, charId)
    const momentsPath = path.join(wechatDir, 'moments.json')

    if (!await fs.pathExists(momentsPath)) {
      await initWechatData(username, charId)
    }

    const moments = await fs.readJson(momentsPath)
    res.json({ success: true, data: moments })
  } catch (error) {
    console.error('获取朋友圈失败:', error)
    res.status(500).json({ error: '获取朋友圈失败' })
  }
})

// 发布朋友圈动态
router.post('/:charId/moments', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { content, images, location, visibility } = req.body

    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({ error: '请输入内容或上传图片' })
    }

    const wechatDir = getWechatDir(username, charId)
    const momentsPath = path.join(wechatDir, 'moments.json')

    await withLock(`moments:${username}:${charId}`, async () => {
      if (!await fs.pathExists(momentsPath)) {
        await initWechatData(username, charId)
      }

      const moments = await fs.readJson(momentsPath)
      const newMoment = {
        id: `moment_${Date.now()}`,
        content: content || '',
        images: images || [],
        location: location || '',
        visibility: visibility || 'public',
        likes: [],
        comments: [],
        createdAt: new Date().toISOString()
      }

      moments.unshift(newMoment) // 新动态在前
      await fs.writeJson(momentsPath, moments, { spaces: 2 })
      res.json({ success: true, data: newMoment })
    })
  } catch (error) {
    console.error('发布朋友圈失败:', error)
    res.status(500).json({ error: '发布朋友圈失败' })
  }
})

// 删除朋友圈动态
router.delete('/:charId/moments/:momentId', authMiddleware, async (req, res) => {
  try {
    const { charId, momentId } = req.params
    const username = req.user.username
    const wechatDir = getWechatDir(username, charId)
    const momentsPath = path.join(wechatDir, 'moments.json')

    await withLock(`moments:${username}:${charId}`, async () => {
      const moments = await fs.readJson(momentsPath)
      const filtered = moments.filter(m => m.id !== momentId)
      await fs.writeJson(momentsPath, filtered, { spaces: 2 })
      res.json({ success: true })
    })
  } catch (error) {
    console.error('删除朋友圈失败:', error)
    res.status(500).json({ error: '删除朋友圈失败' })
  }
})

// 获取聊天会话列表 (偷看模式)
// 只返回：player对话、NPC组成员对话、群聊
router.get('/:charId/sessions', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { chatsDir } = await ensureWechatStructure(username, charId)

    // 获取角色的NPC组成员ID列表
    const character = findCharacterById(charId)
    const npcIds = new Set()
    if (character && character.npcs && Array.isArray(character.npcs)) {
      for (const npc of character.npcs) {
        if (npc.id) {
          npcIds.add(npc.id)
        }
      }
    }

    // 获取该角色参与的群聊ID列表
    const groupsDir = path.join('./data', username, 'groups')
    const groupIds = new Set()
    try {
      if (await fs.pathExists(groupsDir)) {
        const groupFiles = await fs.readdir(groupsDir)
        for (const file of groupFiles) {
          if (file.endsWith('.json')) {
            const groupPath = path.join(groupsDir, file)
            const group = await fs.readJson(groupPath)
            // 检查角色是否是群成员
            if (group.members && group.members.some(m => m.id === charId)) {
              groupIds.add(group.id)
            }
          }
        }
      }
    } catch (e) {
      console.error('读取群列表失败:', e)
    }

    const files = await fs.readdir(chatsDir)
    const sessions = []

    // 允许的会话类型
    const allowedSessionIds = new Set(['player', 'npc_team'])

    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue

      const sessionId = f.replace('.jsonl', '')
      const chatPath = path.join(chatsDir, f)

      // 检查是否是允许的会话
      const isAllowed = allowedSessionIds.has(sessionId) ||
                        npcIds.has(sessionId) ||
                        groupIds.has(sessionId)

      if (!isAllowed) {
        continue // 跳过不允许的会话
      }

      // 读取第一条消息获取会话名称
      let sessionName = sessionId
      try {
        const content = await fs.readFile(chatPath, 'utf-8')
        const firstLine = content.split('\n').find(line => line.trim())
        if (firstLine) {
          const firstMsg = JSON.parse(firstLine)
          // 优先使用 senderName 作为会话名称（对于 NPC 会话）
          if (firstMsg.senderName && firstMsg.sender !== 'character') {
            sessionName = firstMsg.senderName
          }
        }
      } catch (e) {
        // 忽略解析错误
      }

      // 预设名称映射
      const nameMap = {
        'player': '与我的对话',
        'npc_team': '微信团队'
      }

      // 如果是NPC，从角色数据获取名称
      if (npcIds.has(sessionId) && character?.npcs) {
        const npc = character.npcs.find(n => n.id === sessionId)
        if (npc) {
          sessionName = npc.name
        }
      }

      // 如果是群聊，标记类型
      let sessionType = 'chat'
      if (groupIds.has(sessionId)) {
        sessionType = 'group'
        sessionName = `[群聊] ${sessionName}`
      }

      sessions.push({
        id: sessionId,
        name: nameMap[sessionId] || sessionName,
        type: sessionType,
        filename: f
      })
    }

    // 添加群聊会话（如果有的话）
    for (const groupId of groupIds) {
      // 检查是否已经添加过（通过chats目录）
      if (!sessions.find(s => s.id === groupId)) {
        try {
          const groupPath = path.join(groupsDir, `${groupId}.json`)
          const group = await fs.readJson(groupPath)
          sessions.push({
            id: groupId,
            name: `[群聊] ${group.name}`,
            type: 'group',
            filename: null
          })
        } catch (e) {
          // 忽略
        }
      }
    }

    res.json({ success: true, data: sessions })
  } catch (error) {
    console.error('获取会话列表失败:', error)
    res.status(500).json({ error: '获取会话列表失败' })
  }
})

// 读取聊天记录（支持分页 - 高效索引方式）
router.get('/:charId/chats/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { charId, sessionId } = req.params
    const { limit, beforeIndex } = req.query
    const username = req.user.username

    console.log(`[Chat API] charId=${charId}, sessionId=${sessionId}, limit=${limit}, beforeIndex=${beforeIndex}`)

    let messages = []
    let total = 0

    // 所有会话统一从 wechat/chats/{sessionId}.jsonl 读取
    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    if (await fs.pathExists(chatPath)) {
      const content = await fs.readFile(chatPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      total = lines.length

      for (let i = 0; i < lines.length; i++) {
        try {
          const msg = JSON.parse(lines[i])
          msg._index = i
          messages.push(msg)
        } catch {
          // 跳过解析失败的行
        }
      }
    }

    if (total === 0) {
      return res.json({ success: true, data: [], hasMore: false, total: 0, nextIndex: 0 })
    }

    // 解析 limit，如果未指定则返回全部（兼容旧版调用）
    const limitNum = limit ? parseInt(limit, 10) : 0
    let startIndex, endIndex, hasMore, nextIdx

    console.log(`[Chat API] total=${total}, limitNum=${limitNum}`)

    if (limitNum > 0) {
      // 分页模式
      if (beforeIndex !== undefined && beforeIndex !== '') {
        // 加载更早的消息：获取 beforeIndex 之前的 limit 条
        endIndex = parseInt(beforeIndex, 10)
        startIndex = Math.max(0, endIndex - limitNum)
        hasMore = startIndex > 0
        nextIdx = startIndex
      } else {
        // 初始加载：获取最后 limit 条
        endIndex = total
        startIndex = Math.max(0, total - limitNum)
        hasMore = startIndex > 0
        nextIdx = startIndex
      }

      // 裁剪消息数组
      messages = messages.slice(startIndex, endIndex)
    } else {
      // 无分页，返回全部
      hasMore = false
      nextIdx = 0
    }

    console.log(`[Chat API] returning ${messages.length} messages, hasMore=${hasMore}`)

    res.json({ success: true, data: messages, hasMore, total, nextIndex: nextIdx })
  } catch (error) {
    console.error('读取聊天记录失败:', error)
    res.status(500).json({ error: '读取聊天记录失败' })
  }
})

// 发送消息
router.post('/:charId/send', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { sessionId = 'player', text, sender = 'player', senderName, type, redpacketData, transferData, stickerUrl } = req.body

    if (!text) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    const message = {
      id: Date.now(),
      sender,
      senderName: senderName || (sender === 'player' ? '我' : undefined),
      text,
      timestamp: new Date().toISOString()
    }

    // 支持特殊消息类型
    if (type) {
      message.type = type
    }
    if (redpacketData) {
      message.redpacketData = redpacketData
    }
    if (transferData) {
      message.transferData = transferData
    }
    if (stickerUrl) {
      message.stickerUrl = stickerUrl
    }

    await withLock(`chat:${username}:${charId}:${sessionId}`, async () => {
      await fs.appendFile(chatPath, JSON.stringify(message) + '\n', 'utf-8')
    })

    res.json({ success: true, data: message })
  } catch (error) {
    console.error('发送消息失败:', error)
    res.status(500).json({ error: '发送消息失败' })
  }
})

// 更新消息（用于红包领取等状态更新）
router.put('/:charId/chats/:sessionId/message/:messageId', authMiddleware, async (req, res) => {
  try {
    const { charId, sessionId, messageId } = req.params
    const username = req.user.username
    const updates = req.body // { redpacketData: { status: 'claimed', claimedBy: ... } }

    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    if (!await fs.pathExists(chatPath)) {
      return res.status(404).json({ error: '聊天记录不存在' })
    }

    await withLock(`chat:${username}:${charId}:${sessionId}`, async () => {
      const content = await fs.readFile(chatPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      let found = false
      const updatedLines = lines.map(line => {
        try {
          const msg = JSON.parse(line)
          if (msg.id === parseInt(messageId) || msg.id === messageId) {
            found = true
            // 合并更新
            Object.assign(msg, updates)
            return JSON.stringify(msg)
          }
          return line
        } catch {
          return line
        }
      })

      if (!found) {
        throw new Error('消息不存在')
      }

      await fs.writeFile(chatPath, updatedLines.join('\n') + '\n', 'utf-8')
      res.json({ success: true })
    })
  } catch (error) {
    console.error('更新消息失败:', error)
    res.status(500).json({ error: error.message || '更新消息失败' })
  }
})

// 删除单条消息
router.delete('/:charId/chats/:sessionId/message/:messageId', authMiddleware, async (req, res) => {
  try {
    const { charId, sessionId, messageId } = req.params
    const username = req.user.username

    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    if (!await fs.pathExists(chatPath)) {
      return res.status(404).json({ error: '聊天记录不存在' })
    }

    await withLock(`chat:${username}:${charId}:${sessionId}`, async () => {
      const content = await fs.readFile(chatPath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      // 过滤掉要删除的消息
      const updatedLines = lines.filter(line => {
        try {
          const msg = JSON.parse(line)
          return msg.id !== parseInt(messageId) && msg.id !== messageId
        } catch {
          return true
        }
      })

      await fs.writeFile(chatPath, updatedLines.join('\n') + (updatedLines.length > 0 ? '\n' : ''), 'utf-8')
    })

    res.json({ success: true })
  } catch (error) {
    console.error('删除消息失败:', error)
    res.status(500).json({ error: error.message || '删除消息失败' })
  }
})

// 批量保存消息（单次请求，聚合保存）
router.post('/:charId/batch-save', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { sessionId = 'player', messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息列表不能为空' })
    }

    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    // 为每条消息添加唯一 ID 和时间戳
    const baseTime = Date.now()
    const savedMessages = messages.map((msg, index) => ({
      id: baseTime * 1000 + index, // 确保唯一性
      sender: msg.sender || 'character',
      senderName: msg.senderName,
      text: msg.text,
      timestamp: new Date(baseTime + index).toISOString(),
      ...(msg.type && { type: msg.type }),
      ...(msg.redpacketData && { redpacketData: msg.redpacketData }),
      ...(msg.transferData && { transferData: msg.transferData }),
      ...(msg.stickerUrl && { stickerUrl: msg.stickerUrl })
    }))

    await withLock(`chat:${username}:${charId}:${sessionId}`, async () => {
      const content = savedMessages.map(m => JSON.stringify(m)).join('\n') + '\n'
      await fs.appendFile(chatPath, content, 'utf-8')
    })

    res.json({ success: true, data: savedMessages })
  } catch (error) {
    console.error('批量保存消息失败:', error)
    res.status(500).json({ error: '批量保存消息失败' })
  }
})

// 清空聊天记录
router.delete('/:charId/chats/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { charId, sessionId } = req.params
    const username = req.user.username

    if (sessionId === 'player' || sessionId.startsWith('player__')) {
      await withLock(`reset:${username}:${charId}`, async () => {
        await resetCharacterState(username, charId)
      })
      return res.json({ success: true, resetAll: true })
    }

    const { chatsDir } = await ensureWechatStructure(username, charId)
    const chatPath = path.join(chatsDir, `${sessionId}.jsonl`)

    await withLock(`chat:${username}:${charId}:${sessionId}`, async () => {
      await fs.writeFile(chatPath, '', 'utf-8')
    })

    res.json({ success: true })
  } catch (error) {
    console.error('清空聊天记录失败:', error)
    res.status(500).json({ error: '清空聊天记录失败' })
  }
})

// 绑定人设到角色
router.post('/:charId/bind_persona', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { personaId } = req.body // personaId 可以为 null 表示解绑

    const wechatDir = getWechatDir(username, charId)
    const profilePath = path.join(wechatDir, 'profile.json')

    await withLock(`profile:${username}:${charId}`, async () => {
      if (!await fs.pathExists(profilePath)) {
        await initWechatData(username, charId)
      }

      const profile = await fs.readJson(profilePath)
      profile.boundPersonaId = personaId || null
      profile.updatedAt = new Date().toISOString()

      await fs.writeJson(profilePath, profile, { spaces: 2 })
      res.json({ success: true, data: profile })
    })
  } catch (error) {
    console.error('绑定人设失败:', error)
    res.status(500).json({ error: '绑定人设失败' })
  }
})

// ==================== 记忆系统 API ====================

// 获取角色记忆目录
function getMemoryDir(username, charId) {
  return path.join('./data', username, 'characters', charId)
}

function normalizeSessionId(sessionId = 'player') {
  if (typeof sessionId !== 'string') return 'player'
  const value = sessionId.trim()
  return value || 'player'
}

function getMemoryStorageDir(username, charId) {
  return path.join(getMemoryDir(username, charId), 'memory')
}

function getMemoryFileName(sessionId = 'player') {
  const normalized = normalizeSessionId(sessionId)
  const safeName = normalized.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${safeName}.json`
}

function getMemoryPath(username, charId, sessionId = 'player') {
  return path.join(getMemoryStorageDir(username, charId), getMemoryFileName(sessionId))
}

function getLegacyMemoryPath(username, charId) {
  return path.join(getMemoryDir(username, charId), 'memory.json')
}

async function resetCharacterState(username, charId) {
  const userDir = path.join('./data', username)
  const wechatDir = getWechatDir(username, charId)
  const memoryPath = getLegacyMemoryPath(username, charId)
  const memoryStorageDir = getMemoryStorageDir(username, charId)
  const legacyCharChatPath = path.join(userDir, 'char_chats', `${charId}.json`)
  const playerMomentsPath = path.join(userDir, 'player_moments.json')

  const character = getCharacterById(username, charId) || findCharacterById(charId)
  const characterName = character?.name || '未命名'

  await fs.remove(wechatDir)
  await initWechatData(username, charId, characterName)
  await fs.remove(memoryPath)
  await fs.remove(memoryStorageDir)
  await fs.remove(legacyCharChatPath)

  if (await fs.pathExists(userDir)) {
    const files = await fs.readdir(userDir)
    const affectionFiles = files.filter(file => /^affection-.*\.json$/.test(file))

    for (const file of affectionFiles) {
      const filePath = path.join(userDir, file)
      try {
        const affectionData = await fs.readJson(filePath)
        if (affectionData && typeof affectionData === 'object' && affectionData[charId]) {
          delete affectionData[charId]
          await fs.writeJson(filePath, affectionData, { spaces: 2 })
        }
      } catch (e) {
        console.error(`重置好感度文件失败: ${filePath}`, e)
      }
    }
  }

  if (await fs.pathExists(playerMomentsPath)) {
    try {
      const moments = await fs.readJson(playerMomentsPath)
      if (Array.isArray(moments)) {
        const cleaned = moments.map(moment => {
          const next = { ...moment }
          if (Array.isArray(next.likes)) {
            next.likes = next.likes.filter(like => !(like && typeof like === 'object' && like.charId === charId))
          }
          if (Array.isArray(next.comments)) {
            next.comments = next.comments.filter(comment => !(comment && typeof comment === 'object' && comment.charId === charId))
          }
          if (Array.isArray(next.syncedToChars)) {
            next.syncedToChars = next.syncedToChars.filter(id => id !== charId)
          }
          return next
        })
        await fs.writeJson(playerMomentsPath, cleaned, { spaces: 2 })
      }
    } catch (e) {
      console.error('重置玩家朋友圈互动失败:', e)
    }
  }
}

// 获取角色记忆
router.get('/:charId/memory', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const sessionId = normalizeSessionId(req.query.sessionId || 'player')
    const memoryDir = getMemoryStorageDir(username, charId)
    const memoryPath = getMemoryPath(username, charId, sessionId)
    const legacyMemoryPath = getLegacyMemoryPath(username, charId)

    await fs.ensureDir(memoryDir)

    if (!await fs.pathExists(memoryPath)) {
      if (await fs.pathExists(legacyMemoryPath)) {
        const legacyMemory = await fs.readJson(legacyMemoryPath)
        await fs.writeJson(memoryPath, legacyMemory, { spaces: 2 })
        return res.json({ success: true, data: legacyMemory })
      }

      // 初始化空记忆
      const initialMemory = {
        summary: '',
        facts: [],
        lastSummarizedAt: null,
        messageCountSinceLastSummary: 0
      }
      await fs.writeJson(memoryPath, initialMemory, { spaces: 2 })
      return res.json({ success: true, data: initialMemory })
    }

    const memory = await fs.readJson(memoryPath)
    res.json({ success: true, data: memory })
  } catch (error) {
    console.error('获取记忆失败:', error)
    res.status(500).json({ error: '获取记忆失败' })
  }
})

// 更新角色记忆（手动编辑）
router.put('/:charId/memory', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const { summary, facts, sessionId: bodySessionId } = req.body
    const sessionId = normalizeSessionId(bodySessionId || req.query.sessionId || 'player')
    const memoryDir = getMemoryStorageDir(username, charId)
    const memoryPath = getMemoryPath(username, charId, sessionId)
    const legacyMemoryPath = getLegacyMemoryPath(username, charId)

    await fs.ensureDir(memoryDir)

    await withLock(`memory:${username}:${charId}:${sessionId}`, async () => {
      let memory = {
        summary: '',
        facts: [],
        lastSummarizedAt: null,
        messageCountSinceLastSummary: 0
      }

      if (await fs.pathExists(memoryPath)) {
        memory = await fs.readJson(memoryPath)
      } else if (await fs.pathExists(legacyMemoryPath)) {
        memory = await fs.readJson(legacyMemoryPath)
      }

      if (summary !== undefined) memory.summary = summary
      if (facts !== undefined) memory.facts = facts
      memory.updatedAt = new Date().toISOString()

      await fs.writeJson(memoryPath, memory, { spaces: 2 })
      res.json({ success: true, data: memory })
    })
  } catch (error) {
    console.error('更新记忆失败:', error)
    res.status(500).json({ error: '更新记忆失败' })
  }
})

// 手动触发摘要
router.post('/:charId/memory/summarize', authMiddleware, async (req, res) => {
  try {
    const { charId } = req.params
    const username = req.user.username
    const sessionId = normalizeSessionId(req.body?.sessionId || req.query.sessionId || 'player')

    // 导入摘要函数（从 index.js 导出）
    const { summarizeHistory } = await import('../index.js')
    const result = await summarizeHistory(username, charId, sessionId)

    if (result.success) {
      res.json({ success: true, data: result.memory })
    } else {
      res.status(500).json({ error: result.error || '摘要生成失败' })
    }
  } catch (error) {
    console.error('触发摘要失败:', error)
    res.status(500).json({ error: '触发摘要失败: ' + error.message })
  }
})

export default router
