import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import { authMiddleware } from '../auth.js'

const router = express.Router()

// 获取用户人设文件路径
function getPersonasPath(username) {
  return path.join('./data', username, 'personas.json')
}

// 确保人设文件存在
async function ensurePersonasFile(username) {
  const personasPath = getPersonasPath(username)
  const userDir = path.dirname(personasPath)

  await fs.ensureDir(userDir)

  if (!await fs.pathExists(personasPath)) {
    await fs.writeJson(personasPath, [], { spaces: 2 })
  }

  return personasPath
}

// 获取人设列表
router.get('/personas', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const personasPath = await ensurePersonasFile(username)
    const personas = await fs.readJson(personasPath)

    res.json({ success: true, data: personas })
  } catch (error) {
    console.error('获取人设列表失败:', error)
    res.status(500).json({ error: '获取人设列表失败' })
  }
})

// 创建人设
router.post('/personas', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { name, avatar, description, initialBalance } = req.body

    if (!name) {
      return res.status(400).json({ error: '人设名称不能为空' })
    }

    const personasPath = await ensurePersonasFile(username)
    const personas = await fs.readJson(personasPath)

    const newPersona = {
      id: `persona_${Date.now()}`,
      name,
      avatar: avatar || '',
      description: description || '',
      initialBalance: initialBalance !== undefined ? parseFloat(initialBalance) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    personas.push(newPersona)
    await fs.writeJson(personasPath, personas, { spaces: 2 })

    res.json({ success: true, data: newPersona })
  } catch (error) {
    console.error('创建人设失败:', error)
    res.status(500).json({ error: '创建人设失败' })
  }
})

// 修改人设
router.put('/personas/:id', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { id } = req.params
    const { name, avatar, description, initialBalance } = req.body

    const personasPath = await ensurePersonasFile(username)
    const personas = await fs.readJson(personasPath)

    const index = personas.findIndex(p => p.id === id)
    if (index === -1) {
      return res.status(404).json({ error: '人设不存在' })
    }

    const persona = personas[index]

    if (name !== undefined) persona.name = name
    if (avatar !== undefined) persona.avatar = avatar
    if (description !== undefined) persona.description = description
    if (initialBalance !== undefined) persona.initialBalance = parseFloat(initialBalance)
    persona.updatedAt = new Date().toISOString()

    personas[index] = persona
    await fs.writeJson(personasPath, personas, { spaces: 2 })

    res.json({ success: true, data: persona })
  } catch (error) {
    console.error('修改人设失败:', error)
    res.status(500).json({ error: '修改人设失败' })
  }
})

// 删除人设
router.delete('/personas/:id', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { id } = req.params

    const personasPath = await ensurePersonasFile(username)
    const personas = await fs.readJson(personasPath)

    const index = personas.findIndex(p => p.id === id)
    if (index === -1) {
      return res.status(404).json({ error: '人设不存在' })
    }

    personas.splice(index, 1)
    await fs.writeJson(personasPath, personas, { spaces: 2 })

    res.json({ success: true })
  } catch (error) {
    console.error('删除人设失败:', error)
    res.status(500).json({ error: '删除人设失败' })
  }
})

// ==================== 自定义 NPC ====================

// 获取自定义 NPC 文件路径
function getCustomNpcsPath(username) {
  return path.join('./data', username, 'custom_npcs.json')
}

// 确保自定义 NPC 文件存在
async function ensureCustomNpcsFile(username) {
  const npcsPath = getCustomNpcsPath(username)
  const userDir = path.dirname(npcsPath)

  await fs.ensureDir(userDir)

  if (!await fs.pathExists(npcsPath)) {
    await fs.writeJson(npcsPath, [], { spaces: 2 })
  }

  return npcsPath
}

// 获取自定义 NPC 列表
router.get('/custom-npcs', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const npcsPath = await ensureCustomNpcsFile(username)
    const npcs = await fs.readJson(npcsPath)

    res.json({ success: true, data: npcs })
  } catch (error) {
    console.error('获取自定义 NPC 列表失败:', error)
    res.status(500).json({ error: '获取自定义 NPC 列表失败' })
  }
})

// 创建自定义 NPC
router.post('/custom-npcs', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { name, avatar, personality } = req.body

    if (!name) {
      return res.status(400).json({ error: 'NPC 名称不能为空' })
    }

    const npcsPath = await ensureCustomNpcsFile(username)
    const npcs = await fs.readJson(npcsPath)

    const newNpc = {
      id: `custom_npc_${Date.now()}`,
      name,
      avatar: avatar || '',
      personality: personality || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    npcs.push(newNpc)
    await fs.writeJson(npcsPath, npcs, { spaces: 2 })

    res.json({ success: true, data: newNpc })
  } catch (error) {
    console.error('创建自定义 NPC 失败:', error)
    res.status(500).json({ error: '创建自定义 NPC 失败' })
  }
})

// 修改自定义 NPC
router.put('/custom-npcs/:id', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { id } = req.params
    const { name, avatar, personality } = req.body

    const npcsPath = await ensureCustomNpcsFile(username)
    const npcs = await fs.readJson(npcsPath)

    const index = npcs.findIndex(n => n.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'NPC 不存在' })
    }

    const npc = npcs[index]

    if (name !== undefined) npc.name = name
    if (avatar !== undefined) npc.avatar = avatar
    if (personality !== undefined) npc.personality = personality
    npc.updatedAt = new Date().toISOString()

    npcs[index] = npc
    await fs.writeJson(npcsPath, npcs, { spaces: 2 })

    res.json({ success: true, data: npc })
  } catch (error) {
    console.error('修改自定义 NPC 失败:', error)
    res.status(500).json({ error: '修改自定义 NPC 失败' })
  }
})

// 删除自定义 NPC
router.delete('/custom-npcs/:id', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { id } = req.params

    const npcsPath = await ensureCustomNpcsFile(username)
    const npcs = await fs.readJson(npcsPath)

    const index = npcs.findIndex(n => n.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'NPC 不存在' })
    }

    npcs.splice(index, 1)
    await fs.writeJson(npcsPath, npcs, { spaces: 2 })

    res.json({ success: true })
  } catch (error) {
    console.error('删除自定义 NPC 失败:', error)
    res.status(500).json({ error: '删除自定义 NPC 失败' })
  }
})

export default router
