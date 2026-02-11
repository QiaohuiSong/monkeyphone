import { useSystemStore } from '../stores/system.js'

const API_BASE_URL = 'https://monkeyapi.apimonkey.online/v1'

// 获取健康状态上下文
async function getHealthContext() {
  try {
    const username = localStorage.getItem('username') || 'default'
    const response = await fetch('/api/health/ai-context', {
      headers: {
        'X-User-Id': username
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.context_prompt || null
  } catch (e) {
    console.error('获取健康上下文失败:', e)
    return null
  }
}

export async function sendToAI(messages) {
  const systemStore = useSystemStore()

  if (!systemStore.apiKey) {
    throw new Error('请先在设置中配置 API Key')
  }

  // 获取健康状态上下文
  const healthContext = await getHealthContext()

  // 如果有健康上下文，注入到 system prompt
  let processedMessages = [...messages]
  if (healthContext) {
    // 查找是否有 system 消息
    const systemIndex = processedMessages.findIndex(m => m.role === 'system')
    if (systemIndex !== -1) {
      // 追加到现有 system prompt
      processedMessages[systemIndex] = {
        ...processedMessages[systemIndex],
        content: processedMessages[systemIndex].content + '\n\n' + healthContext
      }
    } else {
      // 添加新的 system 消息
      processedMessages.unshift({
        role: 'system',
        content: healthContext
      })
    }
  }

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${systemStore.apiKey}`
    },
    body: JSON.stringify({
      model: systemStore.aiModel,
      messages: processedMessages,
      stream: false
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `API 请求失败: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
