<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- 火焰 -->
    <path
      d="M12 2c0 4-3 6-3 9a3 3 0 0 0 6 0c0-3-3-5-3-9z"
      fill="currentColor"
      stroke="none"
      opacity="0.6"
    />
    <path
      d="M10 4c0 2-1.5 3-1.5 4.5a1.5 1.5 0 0 0 3 0c0-1.5-1.5-2.5-1.5-4.5z"
      fill="currentColor"
      stroke="none"
      opacity="0.8"
    />
    <!-- 爱心 -->
    <path
      d="M12 21c-4.5-3.5-9-6.5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 4.5-4.5 7.5-9 11z"
      fill="currentColor"
      stroke="currentColor"
    />
  </svg>
</template>

<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 24
  }
})
</script>
