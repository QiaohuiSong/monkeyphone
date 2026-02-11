<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PhoneShell from './os/PhoneShell.vue'

const route = useRoute()
const isLoginPage = computed(() => route.path === '/login')
</script>

<template>
  <PhoneShell v-if="!isLoginPage" />
  <div v-else class="login-container">
    <router-view />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #333;
}

.login-container {
  width: 375px;
  height: 812px;
  border: 8px solid #000;
  border-radius: 40px;
  overflow: hidden;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #000;
}
</style>
