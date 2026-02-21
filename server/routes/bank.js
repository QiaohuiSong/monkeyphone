import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import { authMiddleware } from '../auth.js'

const router = express.Router()

// 获取银行数据文件路径（支持人设隔离）
function getBankPath(username, personaId = 'default') {
  return path.join('./data', username, 'bank', `${personaId}.json`)
}

// 获取人设的初始金额
async function getPersonaInitialBalance(username, personaId) {
  if (personaId === 'default') return 0

  try {
    const personasPath = path.join('./data', username, 'personas.json')
    if (await fs.pathExists(personasPath)) {
      const personas = await fs.readJson(personasPath)
      const persona = personas.find(p => p.id === personaId)
      if (persona && persona.initialBalance !== undefined) {
        return parseFloat(persona.initialBalance) || 0
      }
    }
  } catch (e) {
    console.error('读取人设初始金额失败:', e)
  }
  return 0
}

// 确保银行数据文件存在
async function ensureBankFile(username, personaId = 'default') {
  const bankPath = getBankPath(username, personaId)
  const bankDir = path.dirname(bankPath)

  await fs.ensureDir(bankDir)

  if (!await fs.pathExists(bankPath)) {
    // 获取人设的初始金额
    const initialBalance = await getPersonaInitialBalance(username, personaId)

    const initialData = {
      balance: initialBalance,
      currency: 'CNY',
      personaId,
      transactions: []
    }

    // 如果有初始金额，记录一笔初始存款
    if (initialBalance > 0) {
      initialData.transactions.push({
        id: `tx_init_${Date.now()}`,
        type: 'income',
        amount: initialBalance,
        source: 'system',
        source_name: '系统',
        note: '初始存款',
        personaId,
        personaName: personaId === 'default' ? '默认身份' : personaId,
        timestamp: Date.now()
      })
    }

    await fs.writeJson(bankPath, initialData, { spaces: 2 })
  }

  return bankPath
}

// 生成交易 ID
function generateTransactionId() {
  return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

// 精确加法（避免浮点数精度问题）
function preciseAdd(a, b) {
  return Math.round((a + b) * 100) / 100
}

// 精确减法
function preciseSubtract(a, b) {
  return Math.round((a - b) * 100) / 100
}

// GET /api/bank/balance - 获取余额和最近交易记录
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const personaId = req.query.personaId || 'default'
    const bankPath = await ensureBankFile(username, personaId)
    let bankData = await fs.readJson(bankPath)

    // 如果余额为0且没有交易记录，检查是否需要应用初始金额
    if (bankData.balance === 0 && bankData.transactions.length === 0) {
      const initialBalance = await getPersonaInitialBalance(username, personaId)
      if (initialBalance > 0) {
        bankData.balance = initialBalance
        bankData.transactions.push({
          id: `tx_init_${Date.now()}`,
          type: 'income',
          amount: initialBalance,
          source: 'system',
          source_name: '系统',
          note: '初始存款',
          personaId,
          personaName: personaId === 'default' ? '默认身份' : personaId,
          timestamp: Date.now()
        })
        await fs.writeJson(bankPath, bankData, { spaces: 2 })
      }
    }

    // 返回余额和最近 20 条交易记录
    const recentTransactions = bankData.transactions.slice(0, 20)

    res.json({
      success: true,
      data: {
        balance: bankData.balance,
        currency: bankData.currency,
        personaId,
        transactions: recentTransactions
      }
    })
  } catch (error) {
    console.error('获取银行余额失败:', error)
    res.status(500).json({ error: '获取银行余额失败' })
  }
})

// POST /api/bank/transaction - 记录一笔交易
router.post('/transaction', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { type, amount, source, source_name, note, personaId = 'default', personaName } = req.body

    // 参数校验
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: '交易类型无效，必须是 income 或 expense' })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: '金额必须是大于 0 的数字' })
    }

    // 保留两位小数
    const finalAmount = Math.round(numAmount * 100) / 100

    const bankPath = await ensureBankFile(username, personaId)
    const bankData = await fs.readJson(bankPath)

    // 如果是支出，检查余额是否充足
    if (type === 'expense') {
      if (bankData.balance < finalAmount) {
        return res.status(400).json({
          error: '余额不足',
          current_balance: bankData.balance,
          required: finalAmount
        })
      }
      bankData.balance = preciseSubtract(bankData.balance, finalAmount)
    } else {
      // 收入
      bankData.balance = preciseAdd(bankData.balance, finalAmount)
    }

    // 创建新交易记录
    const newTransaction = {
      id: generateTransactionId(),
      type,
      amount: finalAmount,
      source: source || 'system',
      source_name: source_name || (source === 'system' ? '系统' : source),
      note: note || '',
      personaId,
      personaName: personaName || (personaId === 'default' ? '默认身份' : personaId),
      timestamp: Date.now()
    }

    // 将新记录添加到数组开头
    bankData.transactions.unshift(newTransaction)

    // 保存数据
    await fs.writeJson(bankPath, bankData, { spaces: 2 })

    res.json({
      success: true,
      data: {
        transaction: newTransaction,
        balance: bankData.balance
      }
    })
  } catch (error) {
    console.error('记录交易失败:', error)
    res.status(500).json({ error: '记录交易失败' })
  }
})

// GET /api/bank/transactions - 获取完整交易历史（分页）
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username
    const { page = 1, limit = 20, personaId = 'default' } = req.query

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))

    const bankPath = await ensureBankFile(username, personaId)
    const bankData = await fs.readJson(bankPath)

    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const transactions = bankData.transactions.slice(start, end)
    const total = bankData.transactions.length

    res.json({
      success: true,
      data: {
        transactions,
        personaId,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    console.error('获取交易历史失败:', error)
    res.status(500).json({ error: '获取交易历史失败' })
  }
})

// ==================== 导出辅助函数（供其他模块调用）====================

// 扣减余额（用于转账等场景）
export async function deductBalance(username, amount, note = '', personaId = 'default') {
  try {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: '金额无效' }
    }

    const finalAmount = Math.round(numAmount * 100) / 100
    const bankPath = await ensureBankFile(username, personaId)
    const bankData = await fs.readJson(bankPath)

    if (bankData.balance < finalAmount) {
      return {
        success: false,
        error: '余额不足',
        balance: bankData.balance,
        required: finalAmount
      }
    }

    bankData.balance = preciseSubtract(bankData.balance, finalAmount)

    const newTransaction = {
      id: generateTransactionId(),
      type: 'expense',
      amount: finalAmount,
      source: 'transfer',
      source_name: '转账',
      note,
      personaId,
      personaName: personaId === 'default' ? '默认身份' : personaId,
      timestamp: Date.now()
    }

    bankData.transactions.unshift(newTransaction)
    await fs.writeJson(bankPath, bankData, { spaces: 2 })

    return {
      success: true,
      balance: bankData.balance,
      transaction: newTransaction
    }
  } catch (error) {
    console.error('扣减余额失败:', error)
    return { success: false, error: '扣减余额失败' }
  }
}

// 增加余额（用于退款等场景）
export async function addBalance(username, amount, note = '', personaId = 'default') {
  try {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: '金额无效' }
    }

    const finalAmount = Math.round(numAmount * 100) / 100
    const bankPath = await ensureBankFile(username, personaId)
    const bankData = await fs.readJson(bankPath)

    bankData.balance = preciseAdd(bankData.balance, finalAmount)

    const newTransaction = {
      id: generateTransactionId(),
      type: 'income',
      amount: finalAmount,
      source: 'transfer',
      source_name: '转账',
      note,
      personaId,
      personaName: personaId === 'default' ? '默认身份' : personaId,
      timestamp: Date.now()
    }

    bankData.transactions.unshift(newTransaction)
    await fs.writeJson(bankPath, bankData, { spaces: 2 })

    return {
      success: true,
      balance: bankData.balance,
      transaction: newTransaction
    }
  } catch (error) {
    console.error('增加余额失败:', error)
    return { success: false, error: '增加余额失败' }
  }
}

// 获取余额
export async function getBalance(username, personaId = 'default') {
  try {
    const bankPath = await ensureBankFile(username, personaId)
    const bankData = await fs.readJson(bankPath)
    return { success: true, balance: bankData.balance }
  } catch (error) {
    console.error('获取余额失败:', error)
    return { success: false, error: '获取余额失败', balance: 0 }
  }
}

export default router
