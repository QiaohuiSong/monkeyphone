/**
 * 红包服务 - 群聊拼手气红包
 *
 * 数据结构:
 * {
 *   id: "rp_123456",
 *   sender_id: "char_001",      // 发红包的人
 *   sender_name: "张三",
 *   sender_avatar: "...",
 *   total_amount: 100.00,       // 总金额
 *   total_num: 5,               // 红包个数
 *   wishes: "恭喜发财",         // 祝福语
 *   remain_amount: 0.00,        // 剩余金额
 *   remain_num: 0,              // 剩余个数
 *   records: [                  // 领取记录
 *     { user_id, user_name, user_avatar, amount, time, is_best }
 *   ],
 *   created_at: timestamp,
 *   expired_at: timestamp
 * }
 */

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

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('服务器返回了非 JSON 响应')
  }

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.error || '请求失败')
    error.already_grabbed = data.already_grabbed
    throw error
  }

  return data
}

/**
 * 获取群组的所有红包
 */
export async function getGroupRedPackets(groupId) {
  const data = await request(`/api/groups/${groupId}/red-packets`)
  return data.data
}

/**
 * 获取单个红包详情
 */
export async function getRedPacket(groupId, packetId) {
  const data = await request(`/api/groups/${groupId}/red-packets/${packetId}`)
  return data.data
}

/**
 * 发红包
 * @param {string} groupId 群组ID
 * @param {object} options 红包选项
 * @param {string} options.sender_id 发送者ID ('user' 或 NPC的ID)
 * @param {string} options.sender_name 发送者名称
 * @param {string} options.sender_avatar 发送者头像
 * @param {number} options.total_amount 总金额
 * @param {number} options.total_num 红包个数
 * @param {string} options.wishes 祝福语
 */
export async function sendRedPacket(groupId, options) {
  const data = await request(`/api/groups/${groupId}/red-packets`, {
    method: 'POST',
    body: JSON.stringify(options)
  })
  return data.data
}

/**
 * 抢红包
 * @param {string} groupId 群组ID
 * @param {string} packetId 红包ID
 * @param {object} grabber 抢红包的人
 * @param {string} grabber.user_id 用户ID
 * @param {string} grabber.user_name 用户名称
 * @param {string} grabber.user_avatar 用户头像
 */
export async function grabRedPacket(groupId, packetId, grabber) {
  const data = await request(`/api/groups/${groupId}/red-packets/${packetId}/grab`, {
    method: 'POST',
    body: JSON.stringify(grabber)
  })
  return data.data
}

/**
 * 检查红包状态
 */
export function getRedPacketStatus(packet) {
  if (!packet) return 'unknown'

  const now = Date.now()
  if (now > packet.expired_at) {
    return 'expired' // 已过期
  }
  if (packet.remain_num <= 0) {
    return 'finished' // 已抢完
  }
  return 'available' // 可领取
}

/**
 * 检查用户是否已领取
 */
export function hasUserGrabbed(packet, userId) {
  if (!packet || !packet.records) return false
  return packet.records.some(r => r.user_id === userId)
}

/**
 * 获取用户领取的金额
 */
export function getUserGrabbedAmount(packet, userId) {
  if (!packet || !packet.records) return null
  const record = packet.records.find(r => r.user_id === userId)
  return record ? record.amount : null
}

/**
 * 获取手气最佳者
 */
export function getBestLuckUser(packet) {
  if (!packet || !packet.records) return null
  return packet.records.find(r => r.is_best) || null
}

/**
 * 格式化金额显示
 */
export function formatAmount(amount) {
  if (amount === null || amount === undefined) return '-.--'
  return amount.toFixed(2)
}

/**
 * 预设祝福语列表
 */
export const defaultWishes = [
  '恭喜发财，大吉大利',
  '新年快乐',
  '万事如意',
  '心想事成',
  '生日快乐',
  '感谢有你',
  '一帆风顺',
  '财源滚滚'
]
