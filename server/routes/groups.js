import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import { authMiddleware } from '../auth.js'

const router = express.Router()

// ==================== AI 输出清洗函数 ====================
// 防止模型泄露思考过程，破坏角色扮演沉浸感
function sanitizeAIResponse(text) {
  if (!text || typeof text !== 'string') return text

  let cleaned = text

  // 1. 移除 <think>...</think> 标签及内容（各种变体）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '')
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
  cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
  cleaned = cleaned.replace(/<internal>[\s\S]*?<\/internal>/gi, '')

  // 2. 移除常见的思考过程标记行
  const thinkingPatterns = [
    /^.*STREAMING THOUGHTS.*$/gim,
    /^.*Analyze the User's Message.*$/gim,
    /^.*\[Internal Thought\].*$/gim,
    /^.*\[思考\].*$/gim,
    /^.*\[分析\].*$/gim,
    /^.*\[内心独白\].*$/gim,
    /^.*Let me think.*$/gim,
    /^.*Let's analyze.*$/gim,
    /^.*I should respond.*$/gim,
    /^.*I need to.*$/gim,
    /^.*As an AI.*$/gim,
    /^.*As a language model.*$/gim,
    /^.*My response strategy.*$/gim,
    /^.*Response Strategy.*$/gim,
    /^.*Character Analysis.*$/gim,
    /^.*User Intent.*$/gim,
    /^.*Emotional State.*$/gim,
    /^.*Relationship Status.*$/gim,
    /^.*I'll respond.*$/gim,
    /^.*Now I'll.*$/gim,
    /^.*Here's my response.*$/gim,
    /^.*\*thinks\*.*$/gim,
    /^.*\*thinking\*.*$/gim,
  ]

  for (const pattern of thinkingPatterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // 3. 移除 Markdown 风格的思考块
  cleaned = cleaned.replace(/```thinking[\s\S]*?```/gi, '')
  cleaned = cleaned.replace(/```thought[\s\S]*?```/gi, '')
  cleaned = cleaned.replace(/```analysis[\s\S]*?```/gi, '')
  cleaned = cleaned.replace(/```(?:markdown|md|text|plain)?\s*([\s\S]*?)\s*```/gi, '$1')
  cleaned = cleaned.replace(/```+/g, '')

  // 4. 移除多余的空行（超过2个连续换行变成2个）
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // 5. 去除首尾空白
  cleaned = cleaned.trim()

  // 如果清洗后为空，返回一个默认响应
  if (!cleaned) {
    cleaned = '...'
  }

  return cleaned
}

// 获取群组数据目录
function getGroupsDir(username) {
  return path.join('./data', username, 'groups')
}

// 获取群组文件路径
function getGroupPath(username, groupId) {
  return path.join(getGroupsDir(username), `${groupId}.json`)
}

// 获取群聊记录文件路径
function getGroupChatsPath(username, groupId) {
  return path.join(getGroupsDir(username), groupId, 'chats.jsonl')
}

// 获取群红包目录
function getGroupRedPacketsDir(username, groupId) {
  return path.join(getGroupsDir(username), groupId, 'red-packets')
}

// 生成唯一 ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

// 读取 JSONL 文件
async function readJsonl(filePath) {
  try {
    if (!await fs.pathExists(filePath)) return []
    const content = await fs.readFile(filePath, 'utf-8')
    return content.trim().split('\n').filter(line => line).map(line => JSON.parse(line))
  } catch (e) {
    console.error('读取 JSONL 失败:', e)
    return []
  }
}

// 追加到 JSONL 文件
async function appendJsonl(filePath, data) {
  await fs.ensureDir(path.dirname(filePath))
  await fs.appendFile(filePath, JSON.stringify(data) + '\n', 'utf-8')
}

// 写入 JSONL 文件（覆盖）
async function writeJsonl(filePath, dataArray) {
  await fs.ensureDir(path.dirname(filePath))
  const content = dataArray.map(d => JSON.stringify(d)).join('\n') + (dataArray.length > 0 ? '\n' : '')
  await fs.writeFile(filePath, content, 'utf-8')
}

// ==================== 群组 CRUD ====================

// GET /api/groups - 获取群列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groupsDir = getGroupsDir(req.user.username)
    await fs.ensureDir(groupsDir)

    const files = await fs.readdir(groupsDir)
    const groups = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        const groupPath = path.join(groupsDir, file)
        const group = await fs.readJson(groupPath)
        groups.push(group)
      }
    }

    // 按创建时间倒序
    groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    res.json({ success: true, data: groups })
  } catch (e) {
    console.error('获取群列表失败:', e)
    res.status(500).json({ error: '获取群列表失败' })
  }
})

// POST /api/groups - 创建群
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, members, owner_char_id, persona_id } = req.body

    if (!name || !members || members.length === 0) {
      return res.status(400).json({ error: '群名称和成员不能为空' })
    }

    const groupId = generateId('group')
    const group = {
      id: groupId,
      name,
      members,
      owner_char_id: owner_char_id || null,
      persona_id: persona_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const groupPath = getGroupPath(req.user.username, groupId)
    await fs.ensureDir(path.dirname(groupPath))
    await fs.writeJson(groupPath, group, { spaces: 2 })

    res.json({ success: true, data: group })
  } catch (e) {
    console.error('创建群失败:', e)
    res.status(500).json({ error: '创建群失败' })
  }
})

// GET /api/groups/:groupId - 获取单个群
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const groupPath = getGroupPath(req.user.username, req.params.groupId)

    if (!await fs.pathExists(groupPath)) {
      return res.status(404).json({ error: '群不存在' })
    }

    const group = await fs.readJson(groupPath)
    res.json({ success: true, data: group })
  } catch (e) {
    console.error('获取群失败:', e)
    res.status(500).json({ error: '获取群失败' })
  }
})

// PUT /api/groups/:groupId - 更新群
router.put('/:groupId', authMiddleware, async (req, res) => {
  try {
    const groupPath = getGroupPath(req.user.username, req.params.groupId)

    if (!await fs.pathExists(groupPath)) {
      return res.status(404).json({ error: '群不存在' })
    }

    const group = await fs.readJson(groupPath)
    const { name, members, persona_id } = req.body

    if (name !== undefined) group.name = name
    if (members !== undefined) group.members = members
    if (persona_id !== undefined) group.persona_id = persona_id
    group.updated_at = new Date().toISOString()

    await fs.writeJson(groupPath, group, { spaces: 2 })
    res.json({ success: true, data: group })
  } catch (e) {
    console.error('更新群失败:', e)
    res.status(500).json({ error: '更新群失败' })
  }
})

// DELETE /api/groups/:groupId - 删除群
router.delete('/:groupId', authMiddleware, async (req, res) => {
  try {
    const groupPath = getGroupPath(req.user.username, req.params.groupId)
    const groupDir = path.join(getGroupsDir(req.user.username), req.params.groupId)

    if (await fs.pathExists(groupPath)) {
      await fs.remove(groupPath)
    }
    if (await fs.pathExists(groupDir)) {
      await fs.remove(groupDir)
    }

    res.json({ success: true })
  } catch (e) {
    console.error('删除群失败:', e)
    res.status(500).json({ error: '删除群失败' })
  }
})

// ==================== 群聊消息 ====================

// GET /api/groups/:groupId/chats - 获取群聊记录
router.get('/:groupId/chats', authMiddleware, async (req, res) => {
  try {
    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    const messages = await readJsonl(chatsPath)
    res.json({ success: true, data: messages })
  } catch (e) {
    console.error('获取群聊记录失败:', e)
    res.status(500).json({ error: '获取群聊记录失败' })
  }
})

// POST /api/groups/:groupId/chats/send - 发送消息（仅保存，不触发 AI）
router.post('/:groupId/chats/send', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body
    if (!text) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    const message = {
      id: generateId('msg'),
      sender: 'user',
      sender_name: '我',
      sender_avatar: '',
      text,
      type: 'text',
      timestamp: new Date().toISOString()
    }

    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    await appendJsonl(chatsPath, message)

    res.json({ success: true, data: message })
  } catch (e) {
    console.error('发送消息失败:', e)
    res.status(500).json({ error: '发送消息失败' })
  }
})

// POST /api/groups/:groupId/chats/ai - 触发 AI 回复
router.post('/:groupId/chats/ai', authMiddleware, async (req, res) => {
  try {
    const groupPath = getGroupPath(req.user.username, req.params.groupId)
    if (!await fs.pathExists(groupPath)) {
      return res.status(404).json({ error: '群不存在' })
    }

    const group = await fs.readJson(groupPath)
    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    const existingMessages = await readJsonl(chatsPath)

    // 获取用户信息和设置
    const userDataPath = path.join('./data', req.user.username, 'user.json')
    const settingsPath = path.join('./data', req.user.username, 'settings.json')

    let user = {}
    let settings = {}
    if (await fs.pathExists(userDataPath)) {
      user = await fs.readJson(userDataPath)
    }
    if (await fs.pathExists(settingsPath)) {
      settings = await fs.readJson(settingsPath)
    }

    if (!user.api_key) {
      return res.status(400).json({ error: '请先配置 API Key' })
    }

    const model = settings.ai_model || 'gpt-3.5-turbo'
    const NEWAPI_BASE_URL = 'https://monkeyapi.apimonkey.online'

    // 获取绑定的人设
    let boundPersona = null
    if (group.persona_id) {
      const personasPath = path.join('./data', req.user.username, 'personas.json')
      if (await fs.pathExists(personasPath)) {
        const personas = await fs.readJson(personasPath)
        boundPersona = personas.find(p => p.id === group.persona_id)
      }
    }

    // 构建成员信息
    const membersInfo = group.members.map(m => {
      return `- ${m.name} (${m.type === 'main' ? '角色卡' : m.type === 'preset' ? 'NPC' : '自建'})`
    }).join('\n')

    // 构建历史消息
    const historyText = existingMessages.slice(-30).map(m => {
      const senderLabel = m.sender === 'user' ? (boundPersona?.name || '玩家') : m.sender_name
      return `${senderLabel}: ${m.text}`
    }).join('\n')

    // 随机选择一个或多个成员回复
    const availableMembers = group.members.filter(m => m.type !== 'main' || m.persona)
    if (availableMembers.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // 构建 AI prompt
    const systemPrompt = `你是一个群聊模拟器。群里有以下成员：
${membersInfo}

${boundPersona ? `玩家身份：${boundPersona.name}${boundPersona.description ? '\n玩家描述：' + boundPersona.description : ''}` : '玩家是普通用户。'}

规则：
1. 根据聊天内容，选择 1-3 个合适的成员来回复
2. 每个成员的回复要符合其角色特点
3. 回复要自然、口语化，像真实的群聊
4. 不要所有人都回复，要自然一些
5. 成员可以发红包，使用 redpacket 字段

请返回 JSON 格式：
{
  "replies": [
    {
      "member_id": "成员ID",
      "member_name": "成员名",
      "text": "回复内容",
      "redpacket": null 或 {"amount": "金额", "note": "祝福语"}
    }
  ]
}

红包规则：
- 只在适当场合发红包（节日、庆祝、表达感谢等）
- 金额要合理（如 5.20=我爱你, 6.66=顺利, 8.88=发财, 13.14=一生一世）
- 大部分情况下 redpacket 设为 null

只返回 JSON，不要其他内容。`

    const userPrompt = `群聊历史：
${historyText || '(空)'}

请根据上面的对话，让合适的群成员回复。`

    const aiRes = await fetch(`${NEWAPI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.api_key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      })
    })

    if (!aiRes.ok) {
      const error = await aiRes.json().catch(() => ({}))
      throw new Error(error.error?.message || `AI API 请求失败: ${aiRes.status}`)
    }

    const aiData = await aiRes.json()
    let responseText = aiData.choices[0].message.content

    // 清洗 AI 输出，防止泄露思考过程
    responseText = sanitizeAIResponse(responseText)

    // 解析 AI 响应
    const newMessages = []
    const redPacketsDir = getGroupRedPacketsDir(req.user.username, req.params.groupId)

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.replies && Array.isArray(parsed.replies)) {
          for (const reply of parsed.replies) {
            const member = group.members.find(m => m.id === reply.member_id || m.name === reply.member_name)
            const senderId = reply.member_id || member?.id || 'npc'
            const senderName = reply.member_name || member?.name || '群成员'
            const senderAvatar = member?.avatar || ''

            // 检查是否有红包
            if (reply.redpacket && reply.redpacket.amount) {
              // 创建红包
              const amount = parseFloat(reply.redpacket.amount)
              if (!isNaN(amount) && amount >= 0.01) {
                const packetId = generateId('rp')
                const now = Date.now()
                const packet = {
                  id: packetId,
                  sender_id: senderId,
                  sender_name: senderName,
                  sender_avatar: senderAvatar,
                  total_amount: Math.round(amount * 100) / 100,
                  total_num: group.members.length, // 红包个数等于群成员数
                  wishes: reply.redpacket.note || '恭喜发财，大吉大利',
                  remain_amount: Math.round(amount * 100) / 100,
                  remain_num: group.members.length,
                  records: [],
                  created_at: now,
                  expired_at: now + 24 * 60 * 60 * 1000
                }

                await fs.ensureDir(redPacketsDir)
                await fs.writeJson(path.join(redPacketsDir, `${packetId}.json`), packet, { spaces: 2 })

                // 创建红包消息
                const redPacketMessage = {
                  id: generateId('msg'),
                  sender: senderId,
                  sender_name: senderName,
                  sender_avatar: senderAvatar,
                  text: `[红包] ${packet.wishes}`,
                  type: 'red_packet',
                  red_packet_id: packetId,
                  timestamp: new Date().toISOString()
                }
                await appendJsonl(chatsPath, redPacketMessage)
                newMessages.push(redPacketMessage)

                // 触发其他 NPC 抢红包
                scheduleNpcAutoGrab(
                  req.user.username,
                  req.params.groupId,
                  packetId,
                  group.members || [],
                  senderId
                ).catch(e => console.error('NPC 自动抢红包出错:', e))
              }
            }

            // 如果有文本内容，也添加文本消息
            if (reply.text && reply.text.trim()) {
              const message = {
                id: generateId('msg'),
                sender: senderId,
                sender_name: senderName,
                sender_avatar: senderAvatar,
                text: reply.text,
                type: 'text',
                timestamp: new Date().toISOString()
              }
              await appendJsonl(chatsPath, message)
              newMessages.push(message)
            }
          }
        }
      }
    } catch (parseErr) {
      console.error('解析 AI 响应失败:', parseErr)
    }

    res.json({ success: true, data: newMessages })
  } catch (e) {
    console.error('触发 AI 回复失败:', e)
    res.status(500).json({ error: e.message || '触发 AI 回复失败' })
  }
})

// DELETE /api/groups/:groupId/chats - 清空群聊记录
router.delete('/:groupId/chats', authMiddleware, async (req, res) => {
  try {
    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    if (await fs.pathExists(chatsPath)) {
      await fs.remove(chatsPath)
    }
    res.json({ success: true })
  } catch (e) {
    console.error('清空群聊记录失败:', e)
    res.status(500).json({ error: '清空群聊记录失败' })
  }
})

// DELETE /api/groups/:groupId/chats/:messageId - 删除单条消息
router.delete('/:groupId/chats/:messageId', authMiddleware, async (req, res) => {
  try {
    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    let messages = await readJsonl(chatsPath)
    messages = messages.filter(m => m.id !== req.params.messageId)
    await writeJsonl(chatsPath, messages)
    res.json({ success: true })
  } catch (e) {
    console.error('删除消息失败:', e)
    res.status(500).json({ error: '删除消息失败' })
  }
})

// PUT /api/groups/:groupId/chats/:messageId - 更新消息（撤回等）
router.put('/:groupId/chats/:messageId', authMiddleware, async (req, res) => {
  try {
    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    let messages = await readJsonl(chatsPath)

    const msgIndex = messages.findIndex(m => m.id === req.params.messageId)
    if (msgIndex === -1) {
      return res.status(404).json({ error: '消息不存在' })
    }

    const { type, text, originalText } = req.body
    if (type !== undefined) messages[msgIndex].type = type
    if (text !== undefined) messages[msgIndex].text = text
    if (originalText !== undefined) messages[msgIndex].originalText = originalText

    await writeJsonl(chatsPath, messages)
    res.json({ success: true, data: messages[msgIndex] })
  } catch (e) {
    console.error('更新消息失败:', e)
    res.status(500).json({ error: '更新消息失败' })
  }
})

// ==================== 群红包 ====================

/**
 * 二倍均值法计算红包金额
 * 每次抢到的金额 = random(0.01, (剩余金额 / 剩余人数) * 2)
 * 保证数学上不会出现金额超发或负数
 */
function calculateGrabAmount(remainAmount, remainNum) {
  // 最后一个人直接拿走所有剩余金额
  if (remainNum === 1) {
    return Math.round(remainAmount * 100) / 100
  }

  // 二倍均值法
  const avgAmount = remainAmount / remainNum
  const maxAmount = Math.min(avgAmount * 2, remainAmount - (remainNum - 1) * 0.01)
  const minAmount = 0.01

  // 确保 maxAmount >= minAmount
  if (maxAmount <= minAmount) {
    return minAmount
  }

  // 随机金额
  let grabAmount = Math.random() * (maxAmount - minAmount) + minAmount
  grabAmount = Math.round(grabAmount * 100) / 100

  // 边界保护
  grabAmount = Math.max(0.01, grabAmount)
  grabAmount = Math.min(grabAmount, remainAmount - (remainNum - 1) * 0.01)

  return Math.round(grabAmount * 100) / 100
}

/**
 * 计算并标记手气最佳
 */
function markBestLuck(records) {
  if (records.length === 0) return

  let bestIdx = 0
  let bestAmount = records[0].amount

  for (let i = 1; i < records.length; i++) {
    if (records[i].amount > bestAmount) {
      bestAmount = records[i].amount
      bestIdx = i
    }
  }

  // 重置所有 is_best
  records.forEach(r => r.is_best = false)
  records[bestIdx].is_best = true
}

/**
 * NPC 自动抢红包（异步执行，不阻塞响应）
 */
async function scheduleNpcAutoGrab(username, groupId, packetId, groupMembers, senderId) {
  console.log('[红包] 开始 NPC 自动抢红包, groupMembers:', groupMembers.map(m => ({ id: m.id, name: m.name, type: m.type })))
  console.log('[红包] senderId:', senderId)

  // 过滤出可以抢红包的 NPC（排除发红包的人）
  // type: 'main' 是角色卡主角色, 'preset' 是预设NPC, 'custom' 是自建NPC
  const npcs = groupMembers.filter(m => m.id !== senderId)

  console.log('[红包] 可抢红包的成员:', npcs.map(m => ({ id: m.id, name: m.name, type: m.type })))

  if (npcs.length === 0) {
    console.log('[红包] 没有可抢红包的成员')
    return
  }

  const packetPath = path.join(getGroupRedPacketsDir(username, groupId), `${packetId}.json`)
  const chatsPath = getGroupChatsPath(username, groupId)

  // 感谢语列表
  const thankMessages = [
    '谢谢老板！',
    '老板大气！',
    '发财发财~',
    '谢谢红包！',
    '运气不错嘿嘿',
    '收到！',
    '感谢感谢~',
    '老板威武！',
    '好耶！'
  ]

  // 随机打乱 NPC 顺序
  const shuffledNpcs = [...npcs].sort(() => Math.random() - 0.5)

  for (let i = 0; i < shuffledNpcs.length; i++) {
    const npc = shuffledNpcs[i]

    // 随机延迟 1-3 秒（测试用，正式环境可改为 3-10 秒）
    const delay = 1000 + Math.random() * 2000
    console.log(`[红包] ${npc.name} 将在 ${Math.round(delay/1000)} 秒后抢红包`)
    await new Promise(resolve => setTimeout(resolve, delay))

    try {
      // 重新读取最新红包数据（可能已被其他人抢）
      if (!await fs.pathExists(packetPath)) {
        console.log('[红包] 红包文件不存在，停止')
        return
      }
      const packet = await fs.readJson(packetPath)

      console.log(`[红包] ${npc.name} 尝试抢红包, 剩余 ${packet.remain_num} 个, ${packet.remain_amount} 元`)

      // 检查红包是否还有剩余
      if (packet.remain_num <= 0) {
        console.log('[红包] 红包已抢完，停止')
        return // 红包已抢完，停止
      }

      // 检查 NPC 是否已抢过
      if (packet.records.find(r => r.user_id === npc.id)) {
        console.log(`[红包] ${npc.name} 已抢过，跳过`)
        continue // 跳过已抢过的 NPC
      }

      // 使用二倍均值法计算金额
      const grabAmount = calculateGrabAmount(packet.remain_amount, packet.remain_num)
      console.log(`[红包] ${npc.name} 抢到 ${grabAmount} 元`)

      // 记录
      const record = {
        user_id: npc.id,
        user_name: npc.name,
        user_avatar: npc.avatar || '',
        amount: grabAmount,
        time: Date.now(),
        is_best: false
      }

      packet.records.push(record)
      packet.remain_amount = Math.round((packet.remain_amount - grabAmount) * 100) / 100
      packet.remain_num -= 1

      // 边界保护：确保不会出现负数
      if (packet.remain_amount < 0) packet.remain_amount = 0
      if (packet.remain_num < 0) packet.remain_num = 0

      // 如果红包抢完了，计算手气最佳
      if (packet.remain_num === 0) {
        markBestLuck(packet.records)
      }

      // 保存红包数据
      await fs.writeJson(packetPath, packet, { spaces: 2 })
      console.log(`[红包] ${npc.name} 抢红包成功，已保存`)

      // 50% 概率发送感谢消息
      if (Math.random() < 0.5) {
        const thankMsg = thankMessages[Math.floor(Math.random() * thankMessages.length)]
        const chatMessage = {
          id: generateId('msg'),
          sender: npc.id,
          sender_name: npc.name,
          sender_avatar: npc.avatar || '',
          text: thankMsg,
          type: 'text',
          timestamp: new Date().toISOString()
        }
        await appendJsonl(chatsPath, chatMessage)
        console.log(`[红包] ${npc.name} 发送感谢消息: ${thankMsg}`)
      }

      // 如果红包抢完了，停止
      if (packet.remain_num === 0) {
        console.log('[红包] 红包已全部抢完')
        return
      }

    } catch (e) {
      console.error(`[红包] NPC ${npc.name} 抢红包失败:`, e)
    }
  }
}

// GET /api/groups/:groupId/red-packets - 获取群红包列表
router.get('/:groupId/red-packets', authMiddleware, async (req, res) => {
  try {
    const redPacketsDir = getGroupRedPacketsDir(req.user.username, req.params.groupId)
    await fs.ensureDir(redPacketsDir)

    const files = await fs.readdir(redPacketsDir)
    const packets = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        const packetPath = path.join(redPacketsDir, file)
        const packet = await fs.readJson(packetPath)
        packets.push(packet)
      }
    }

    // 按创建时间倒序
    packets.sort((a, b) => b.created_at - a.created_at)

    res.json({ success: true, data: packets })
  } catch (e) {
    console.error('获取红包列表失败:', e)
    res.status(500).json({ error: '获取红包列表失败' })
  }
})

// POST /api/groups/:groupId/red-packets - 发红包
router.post('/:groupId/red-packets', authMiddleware, async (req, res) => {
  try {
    const { sender_id, sender_name, sender_avatar, total_amount, total_num, wishes } = req.body

    const amount = parseFloat(total_amount)
    const num = parseInt(total_num)

    // 验证参数
    if (isNaN(amount) || amount < 0.01) {
      return res.status(400).json({ error: '红包金额无效' })
    }
    if (isNaN(num) || num < 1) {
      return res.status(400).json({ error: '红包个数无效' })
    }
    // 确保每个红包至少 0.01 元
    if (amount / num < 0.01) {
      return res.status(400).json({ error: '单个红包金额不能少于0.01元' })
    }

    const packetId = generateId('rp')
    const now = Date.now()
    const packet = {
      id: packetId,
      sender_id: sender_id || 'user',
      sender_name: sender_name || '我',
      sender_avatar: sender_avatar || '',
      total_amount: Math.round(amount * 100) / 100,
      total_num: num,
      wishes: wishes || '恭喜发财，大吉大利',
      remain_amount: Math.round(amount * 100) / 100,
      remain_num: num,
      records: [],
      created_at: now,
      expired_at: now + 24 * 60 * 60 * 1000 // 24小时后过期
    }

    const redPacketsDir = getGroupRedPacketsDir(req.user.username, req.params.groupId)
    await fs.ensureDir(redPacketsDir)
    await fs.writeJson(path.join(redPacketsDir, `${packetId}.json`), packet, { spaces: 2 })

    // 创建红包消息
    const message = {
      id: generateId('msg'),
      sender: sender_id || 'user',
      sender_name: sender_name || '我',
      sender_avatar: sender_avatar || '',
      text: `[红包] ${wishes || '恭喜发财，大吉大利'}`,
      type: 'red_packet',
      red_packet_id: packetId,
      timestamp: new Date().toISOString()
    }

    const chatsPath = getGroupChatsPath(req.user.username, req.params.groupId)
    await appendJsonl(chatsPath, message)

    // 获取群成员信息，触发 NPC 自动抢红包
    const groupPath = getGroupPath(req.user.username, req.params.groupId)
    if (await fs.pathExists(groupPath)) {
      const group = await fs.readJson(groupPath)
      // 异步执行，不阻塞响应
      scheduleNpcAutoGrab(
        req.user.username,
        req.params.groupId,
        packetId,
        group.members || [],
        sender_id || 'user'
      ).catch(e => console.error('NPC 自动抢红包出错:', e))
    }

    res.json({ success: true, data: { packet, message } })
  } catch (e) {
    console.error('发红包失败:', e)
    res.status(500).json({ error: '发红包失败' })
  }
})

// GET /api/groups/:groupId/red-packets/:packetId - 获取红包详情
router.get('/:groupId/red-packets/:packetId', authMiddleware, async (req, res) => {
  try {
    const packetPath = path.join(
      getGroupRedPacketsDir(req.user.username, req.params.groupId),
      `${req.params.packetId}.json`
    )

    if (!await fs.pathExists(packetPath)) {
      return res.status(404).json({ error: '红包不存在' })
    }

    const packet = await fs.readJson(packetPath)
    res.json({ success: true, data: packet })
  } catch (e) {
    console.error('获取红包详情失败:', e)
    res.status(500).json({ error: '获取红包详情失败' })
  }
})

// POST /api/groups/:groupId/red-packets/:packetId/grab - 抢红包
router.post('/:groupId/red-packets/:packetId/grab', authMiddleware, async (req, res) => {
  try {
    const { user_id, user_name, user_avatar } = req.body

    const packetPath = path.join(
      getGroupRedPacketsDir(req.user.username, req.params.groupId),
      `${req.params.packetId}.json`
    )

    if (!await fs.pathExists(packetPath)) {
      return res.status(404).json({ error: '红包不存在' })
    }

    const packet = await fs.readJson(packetPath)

    // 检查是否过期
    if (Date.now() > packet.expired_at) {
      return res.status(400).json({ error: '红包已过期' })
    }

    // 检查是否已抢完
    if (packet.remain_num <= 0) {
      return res.status(400).json({ error: '红包已被抢完' })
    }

    // 检查是否已抢过
    const alreadyGrabbed = packet.records.find(r => r.user_id === user_id)
    if (alreadyGrabbed) {
      return res.status(400).json({
        error: '你已经抢过了',
        already_grabbed: true,
        grabbed_amount: alreadyGrabbed.amount
      })
    }

    // 使用二倍均值法计算抢到的金额
    const grabAmount = calculateGrabAmount(packet.remain_amount, packet.remain_num)

    // 记录
    const record = {
      user_id: user_id || 'user',
      user_name: user_name || '我',
      user_avatar: user_avatar || '',
      amount: grabAmount,
      time: Date.now(),
      is_best: false
    }

    packet.records.push(record)
    packet.remain_amount = Math.round((packet.remain_amount - grabAmount) * 100) / 100
    packet.remain_num -= 1

    // 边界保护：确保不会出现负数
    if (packet.remain_amount < 0) packet.remain_amount = 0
    if (packet.remain_num < 0) packet.remain_num = 0

    // 如果红包抢完了，计算手气最佳
    if (packet.remain_num === 0) {
      markBestLuck(packet.records)
    }

    await fs.writeJson(packetPath, packet, { spaces: 2 })

    // 检查当前用户是否是手气最佳
    const isBest = packet.remain_num === 0 && record.is_best

    res.json({
      success: true,
      data: {
        amount: grabAmount,
        packet,
        is_best: isBest
      }
    })
  } catch (e) {
    console.error('抢红包失败:', e)
    res.status(500).json({ error: '抢红包失败' })
  }
})

export default router
