import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../auth.js'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')

// 获取用户健康数据文件路径
function getHealthFilePath(userId) {
  return path.join(DATA_DIR, userId, 'health.json')
}

// 读取健康数据
async function readHealthData(userId) {
  const filePath = getHealthFilePath(userId)
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    // 返回默认结构
    return {
      cycle_config: {
        last_period_date: null,
        cycle_length: 28,
        period_duration: 5
      }
    }
  }
}

// 保存健康数据
async function saveHealthData(userId, data) {
  const filePath = getHealthFilePath(userId)
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

// 计算周期状态
function calculateCycleStatus(cycleConfig) {
  const { last_period_date, cycle_length, period_duration } = cycleConfig

  if (!last_period_date) {
    return {
      phase: 'unknown',
      days_until_next: null,
      current_day: null,
      next_period_date: null
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastPeriod = new Date(last_period_date)
  lastPeriod.setHours(0, 0, 0, 0)

  // 计算距离上次经期的天数
  const daysSinceLastPeriod = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24))

  // 计算下次经期日期
  const nextPeriodDate = new Date(lastPeriod)
  nextPeriodDate.setDate(nextPeriodDate.getDate() + cycle_length)

  // 如果已经过了预计的下次经期，继续计算下一个周期
  let adjustedNextPeriod = new Date(nextPeriodDate)
  while (adjustedNextPeriod <= today) {
    adjustedNextPeriod.setDate(adjustedNextPeriod.getDate() + cycle_length)
  }

  const daysUntilNext = Math.floor((adjustedNextPeriod - today) / (1000 * 60 * 60 * 24))

  // 判断当前阶段
  let phase = 'normal'

  // 检查是否在经期中 (基于最近一次经期或预测的经期)
  // 计算当前周期的第几天
  const currentCycleDay = daysSinceLastPeriod % cycle_length

  if (currentCycleDay >= 0 && currentCycleDay < period_duration) {
    // 经期中
    phase = 'period'
  } else if (daysUntilNext <= 3 && daysUntilNext >= 0) {
    // 经前3天 (PMS期)
    phase = 'pms'
  } else if (currentCycleDay >= 12 && currentCycleDay <= 16) {
    // 排卵期 (大约在周期的第12-16天)
    phase = 'ovulation'
  }

  return {
    phase,
    days_until_next: daysUntilNext,
    current_day: currentCycleDay + 1, // 当前是周期第几天
    next_period_date: adjustedNextPeriod.toISOString().split('T')[0],
    period_end_day: period_duration
  }
}

// POST /api/health/cycle - 更新周期数据
router.post('/cycle', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.username
    const { last_period_date, cycle_length, period_duration } = req.body

    const healthData = await readHealthData(userId)

    // 更新周期配置
    if (last_period_date !== undefined) {
      healthData.cycle_config.last_period_date = last_period_date
    }
    if (cycle_length !== undefined) {
      healthData.cycle_config.cycle_length = Math.max(21, Math.min(45, cycle_length))
    }
    if (period_duration !== undefined) {
      healthData.cycle_config.period_duration = Math.max(2, Math.min(10, period_duration))
    }

    await saveHealthData(userId, healthData)

    // 返回更新后的状态
    const status = calculateCycleStatus(healthData.cycle_config)

    res.json({
      success: true,
      cycle_config: healthData.cycle_config,
      status
    })
  } catch (error) {
    console.error('更新周期数据失败:', error)
    res.status(500).json({ error: '更新失败' })
  }
})

// GET /api/health/status - 获取当前状态
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.username
    const healthData = await readHealthData(userId)
    const status = calculateCycleStatus(healthData.cycle_config)

    res.json({
      cycle_config: healthData.cycle_config,
      status
    })
  } catch (error) {
    console.error('获取健康状态失败:', error)
    res.status(500).json({ error: '获取失败' })
  }
})

// GET /api/health/ai-context - 获取 AI 上下文注入内容 (供 AI 服务调用)
router.get('/ai-context', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.username
    const healthData = await readHealthData(userId)
    const status = calculateCycleStatus(healthData.cycle_config)

    let contextPrompt = null

    if (status.phase === 'pms') {
      contextPrompt = `[URGENT HEALTH NOTICE] User's menstruation is coming in ${status.days_until_next} days. User might feel emotional or physical discomfort. Please be extra gentle, show concern, and remind them to prepare (e.g., drink warm water, rest well, avoid cold food).`
    } else if (status.phase === 'period') {
      contextPrompt = `[HEALTH NOTICE] User is currently on day ${status.current_day} of their period (typically lasts ${status.period_end_day} days). Be supportive, caring, and avoid stressful topics. Consider suggesting warm drinks and rest.`
    } else if (status.phase === 'ovulation') {
      contextPrompt = `[HEALTH INFO] User is in their ovulation phase. They might experience mild discomfort or mood changes.`
    }

    res.json({
      phase: status.phase,
      context_prompt: contextPrompt,
      status
    })
  } catch (error) {
    console.error('获取 AI 上下文失败:', error)
    res.json({ phase: 'unknown', context_prompt: null })
  }
})

export default router
