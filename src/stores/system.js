import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const useSystemStore = defineStore('system', () => {
  const wallpaper = useStorage('system-wallpaper', '')
  const notifications = useStorage('system-notifications', {})
  const batteryLevel = useStorage('system-battery', 100)
  const apiKey = useStorage('system-api-key', '')
  const apiBaseUrl = useStorage('system-api-base-url', 'https://monkeyapi.apimonkey.online/v1')
  const aiModel = useStorage('system-ai-model', 'gpt-3.5-turbo')
  const chatMessages = useStorage('chat-messages', [
    { id: 1, sender: 'user', text: '在吗?' },
    { id: 2, sender: 'ai', text: '我在，主人。' },
    { id: 3, sender: 'user', text: '今天天气怎么样？' },
    { id: 4, sender: 'ai', text: '今天晴朗，适合出门散步呢~' }
  ])

  // 主题系统
  const customCSS = useStorage('system-custom-css', '')
  const themeSettings = useStorage('system-theme-settings', {
    borderRadius: 40,
    shellOpacity: 1,
    statusBarOpacity: 0.3,
    dockOpacity: 0.35,
    widgetOpacity: 0.35,
    accentColor: '#07c160'
  })

  const wallpapers = [
    'https://picsum.photos/seed/wall1/375/812',
    'https://picsum.photos/seed/wall2/375/812',
    'https://picsum.photos/seed/wall3/375/812',
    'https://picsum.photos/seed/wall4/375/812',
    'https://picsum.photos/seed/wall5/375/812'
  ]

  function setWallpaper(url) {
    wallpaper.value = url
  }

  function toggleWallpaper() {
    const currentIndex = wallpapers.indexOf(wallpaper.value)
    const nextIndex = (currentIndex + 1) % wallpapers.length
    wallpaper.value = wallpapers[nextIndex]
  }

  function setBatteryLevel(level) {
    batteryLevel.value = level
  }

  function addNotification(appId, notification) {
    notifications.value = { ...notifications.value, [appId]: notification }
  }

  function clearNotification(appId) {
    const { [appId]: _, ...rest } = notifications.value
    notifications.value = rest
  }

  function setApiKey(key) {
    apiKey.value = key
  }

  function setApiBaseUrl(url) {
    apiBaseUrl.value = url
  }

  function setAiModel(model) {
    aiModel.value = model
  }

  function addChatMessage(message) {
    chatMessages.value = [...chatMessages.value, message]
  }

  // 主题相关方法
  function setCustomCSS(css) {
    customCSS.value = css
  }

  function setThemeSettings(settings) {
    themeSettings.value = { ...themeSettings.value, ...settings }
  }

  function resetTheme() {
    customCSS.value = ''
    themeSettings.value = {
      borderRadius: 40,
      shellOpacity: 1,
      statusBarOpacity: 0.3,
      dockOpacity: 0.35,
      widgetOpacity: 0.35,
      accentColor: '#07c160'
    }
  }

  // 导出主题为 JSON
  function exportTheme() {
    return {
      version: '1.0',
      wallpaper: wallpaper.value,
      customCSS: customCSS.value,
      themeSettings: themeSettings.value
    }
  }

  // 导入主题
  function importTheme(theme) {
    if (theme.wallpaper !== undefined) {
      wallpaper.value = theme.wallpaper
    }
    if (theme.customCSS !== undefined) {
      customCSS.value = theme.customCSS
    }
    if (theme.themeSettings !== undefined) {
      themeSettings.value = { ...themeSettings.value, ...theme.themeSettings }
    }
  }

  return {
    wallpaper,
    notifications,
    batteryLevel,
    apiKey,
    apiBaseUrl,
    aiModel,
    chatMessages,
    wallpapers,
    customCSS,
    themeSettings,
    setWallpaper,
    toggleWallpaper,
    setBatteryLevel,
    addNotification,
    clearNotification,
    setApiKey,
    setApiBaseUrl,
    setAiModel,
    addChatMessage,
    setCustomCSS,
    setThemeSettings,
    resetTheme,
    exportTheme,
    importTheme
  }
})
