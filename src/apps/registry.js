import { shallowRef } from 'vue'
import { Settings, Users, MessageSquare, Brain, Gamepad2, Palette, Flower2 } from 'lucide-vue-next'
import SettingsApp from './settings/SettingsApp.vue'
import CharacterApp from './character/CharacterApp.vue'
import WeChatApp from './wechat/WeChatApp.vue'
import MemoApp from './memo/MemoApp.vue'
import TetrisApp from './games/TetrisApp.vue'
import ThemeStudio from './themestudio/ThemeStudio.vue'
import CycleApp from './health/CycleApp.vue'
import LoveSparkApp from './love-spark/LoveSparkApp.vue'
import HeartFireIcon from './love-spark/HeartFireIcon.vue'

export const installedApps = shallowRef([
  // Dock 栏 (前4个): 角色卡, 美化, 记忆, 设置
  {
    id: 'character',
    name: 'Characters',
    icon: Users,
    color: '#9c27b0',
    component: CharacterApp
  },
  {
    id: 'themestudio',
    name: 'Theme',
    icon: Palette,
    color: '#e91e63',
    component: ThemeStudio
  },
  {
    id: 'memo',
    name: 'AI Memory',
    icon: Brain,
    color: '#1890ff',
    component: MemoApp
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    color: '#757575',
    component: SettingsApp
  },
  // 桌面网格 (第5个开始)
  {
    id: 'wechat',
    name: 'WeChat',
    icon: MessageSquare,
    color: '#07c160',
    component: WeChatApp
  },
  {
    id: 'tetris',
    name: 'Tetris',
    icon: Gamepad2,
    color: '#ff00ff',
    component: TetrisApp
  },
  {
    id: 'cycle',
    name: 'Cycle',
    icon: Flower2,
    color: '#f48fb1',
    component: CycleApp
  },
  {
    id: 'love-spark',
    name: '爱的火花',
    icon: HeartFireIcon,
    color: '#ff1493',
    component: LoveSparkApp
  }
])

export function registerApp(appConfig) {
  installedApps.value = [...installedApps.value, appConfig]
}
