import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import { authMiddleware } from '../auth.js'

const router = express.Router()

// 获取用户游戏数据文件路径
function getGamesFilePath(userId) {
  const userDir = path.join('./data', userId)
  fs.ensureDirSync(userDir)
  return path.join(userDir, 'games.json')
}

// 读取游戏数据
function getGamesData(userId) {
  const filePath = getGamesFilePath(userId)
  if (!fs.existsSync(filePath)) {
    return { tetris: { highScore: 0 } }
  }
  try {
    return fs.readJsonSync(filePath)
  } catch (e) {
    return { tetris: { highScore: 0 } }
  }
}

// 保存游戏数据
function saveGamesData(userId, data) {
  const filePath = getGamesFilePath(userId)
  fs.writeJsonSync(filePath, data, { spaces: 2 })
}

// GET /api/games/tetris/score - 获取最高分
router.get('/tetris/score', authMiddleware, (req, res) => {
  try {
    const userId = req.user.username
    const data = getGamesData(userId)
    res.json({
      highScore: data.tetris?.highScore || 0
    })
  } catch (e) {
    console.error('获取Tetris分数失败:', e)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/games/tetris/score - 提交分数
router.post('/tetris/score', authMiddleware, (req, res) => {
  try {
    const userId = req.user.username
    const { score } = req.body

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: '无效的分数' })
    }

    const data = getGamesData(userId)
    if (!data.tetris) {
      data.tetris = { highScore: 0 }
    }

    const currentHighScore = data.tetris.highScore || 0
    const newRecord = score > currentHighScore

    if (newRecord) {
      data.tetris.highScore = score
      data.tetris.lastUpdated = new Date().toISOString()
      saveGamesData(userId, data)
    }

    res.json({
      newRecord,
      highScore: newRecord ? score : currentHighScore,
      submittedScore: score
    })
  } catch (e) {
    console.error('提交Tetris分数失败:', e)
    res.status(500).json({ error: e.message })
  }
})

export default router
