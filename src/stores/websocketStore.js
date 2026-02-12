import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const useWebSocketStore = defineStore('websocket', () => {
  // WebSocket 连接
  const ws = ref(null)
  const isConnected = ref(false)
  const isPageVisible = ref(true)

  // 事件监听器 { eventType: Set<callback> }
  const listeners = reactive({})

  // 重连配置
  const RECONNECT_DELAY = 5000        // 普通重连延迟
  const BACKGROUND_TIMEOUT = 5 * 60 * 1000  // 后台5分钟后才断开
  let backgroundTimer = null
  let reconnectTimer = null

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

      // 清除之前的重连计时器
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      // 只有在页面可见时才自动重连
      if (isPageVisible.value && getUsername()) {
        reconnectTimer = setTimeout(() => {
          connect()
        }, RECONNECT_DELAY)
      }
    }
  }

  // 断开连接
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
  }

  // 页面可见性变化处理
  function handleVisibilityChange() {
    const wasVisible = isPageVisible.value
    isPageVisible.value = !document.hidden

    if (isPageVisible.value) {
      // 页面变为可见
      console.log('[WebSocket] 页面可见，检查连接状态')

      // 清除后台断开计时器
      if (backgroundTimer) {
        clearTimeout(backgroundTimer)
        backgroundTimer = null
      }

      // 如果连接已断开，立即重连
      if (!isConnected.value && getUsername()) {
        connect()
      }
    } else {
      // 页面变为不可见（切换到后台）
      console.log('[WebSocket] 页面切换到后台，将在5分钟后断开连接')

      // 设置后台超时断开计时器
      if (backgroundTimer) {
        clearTimeout(backgroundTimer)
      }
      backgroundTimer = setTimeout(() => {
        console.log('[WebSocket] 后台超时，断开连接')
        disconnect()
      }, BACKGROUND_TIMEOUT)
    }
  }

  // 初始化页面可见性监听
  function initVisibilityListener() {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // 移除页面可见性监听
  function removeVisibilityListener() {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (backgroundTimer) {
      clearTimeout(backgroundTimer)
      backgroundTimer = null
    }
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
    isPageVisible,
    connect,
    disconnect,
    on,
    off,
    send,
    initVisibilityListener,
    removeVisibilityListener
  }
})
