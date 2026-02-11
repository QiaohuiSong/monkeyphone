import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useWebSocketStore = defineStore('websocket', () => {
  // WebSocket 连接
  const ws = ref(null)
  const isConnected = ref(false)

  // 事件监听器 { eventType: Set<callback> }
  const listeners = reactive({})

  // 获取用户名
  function getUsername() {
    const token = localStorage.getItem('auth_token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.username
    } catch {
      return null
    }
  }

  // 连接 WebSocket
  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return // 已连接
    }

    const isDev = import.meta.env.DEV
    let wsUrl

    if (isDev) {
      wsUrl = 'ws://localhost:3000'
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}`
    }

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[WebSocket] 已连接')
      isConnected.value = true

      // 发送认证
      const username = getUsername()
      if (username) {
        ws.value.send(JSON.stringify({ type: 'auth', username }))
      }
    }

    ws.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        // 触发对应类型的监听器
        if (message.type && listeners[message.type]) {
          listeners[message.type].forEach(callback => {
            try {
              callback(message.data)
            } catch (e) {
              console.error('[WebSocket] 回调执行错误:', e)
            }
          })
        }

        // 同时触发通配符监听器
        if (listeners['*']) {
          listeners['*'].forEach(callback => {
            try {
              callback(message)
            } catch (e) {
              console.error('[WebSocket] 通配符回调执行错误:', e)
            }
          })
        }
      } catch (e) {
        console.error('[WebSocket] 消息解析失败:', e)
      }
    }

    ws.value.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error)
    }

    ws.value.onclose = () => {
      console.log('[WebSocket] 已断开')
      isConnected.value = false

      // 5秒后重连
      setTimeout(() => {
        if (getUsername()) {
          connect()
        }
      }, 5000)
    }
  }

  // 断开连接
  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
  }

  // 添加事件监听器
  function on(eventType, callback) {
    if (!listeners[eventType]) {
      listeners[eventType] = new Set()
    }
    listeners[eventType].add(callback)
  }

  // 移除事件监听器
  function off(eventType, callback) {
    if (listeners[eventType]) {
      listeners[eventType].delete(callback)
    }
  }

  // 发送消息
  function send(data) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
      return true
    }
    return false
  }

  return {
    isConnected,
    connect,
    disconnect,
    on,
    off,
    send
  }
})
