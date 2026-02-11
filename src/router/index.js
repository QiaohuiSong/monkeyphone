import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '../services/api.js'
import Launcher from '../os/Launcher.vue'
import LoginPage from '../apps/login/LoginPage.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { guest: true }
  },
  {
    path: '/',
    name: 'launcher',
    component: Launcher,
    meta: { requiresAuth: true }
  },
  {
    path: '/app/:id',
    name: 'app',
    component: () => import('../os/AppContainer.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const loggedIn = isLoggedIn()

  if (to.meta.requiresAuth && !loggedIn) {
    // 需要登录但未登录，跳转到登录页
    next('/login')
  } else if (to.meta.guest && loggedIn) {
    // 已登录但访问登录页，跳转到首页
    next('/')
  } else {
    next()
  }
})

export default router
