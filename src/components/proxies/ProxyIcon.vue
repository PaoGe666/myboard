<template>
  <div
    v-if="isDom"
    :class="['inline-block', fill || 'fill-primary']"
    :style="style"
    v-html="pureDom"
  />
  <img
    v-else-if="resolvedIcon"
    class="inline-block"
    :style="style"
    :src="resolvedIcon"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
import { getFallbackProxyIcon, getPreferredProxyIcon } from '@/helper/proxyIcon'
import { preferBrandSvgIcon } from '@/store/settings'
import DOMPurify from 'dompurify'
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    icon: string
    name?: string
    fill?: string
    size?: number
    margin?: number
  }>(),
  {
    size: 16,
    margin: 4,
  },
)

const style = computed(() => {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    marginRight: `${props.margin}px`,
  }
})
const DOM_STARTS_WITH = 'data:image/svg+xml,'
const resolvedIcon = ref(props.icon)

watch(
  () => [props.icon, props.name, preferBrandSvgIcon.value],
  () => {
    resolvedIcon.value = getPreferredProxyIcon(
      props.name || '',
      props.icon,
      preferBrandSvgIcon.value,
    )
  },
  { immediate: true },
)

const isDom = computed(() => {
  return resolvedIcon.value.startsWith(DOM_STARTS_WITH)
})

const pureDom = computed(() => {
  if (!isDom.value) return
  return DOMPurify.sanitize(resolvedIcon.value.replace(DOM_STARTS_WITH, ''))
})

const handleImageError = () => {
  if (!preferBrandSvgIcon.value) {
    resolvedIcon.value = ''
    return
  }

  const fallbackIcon = getFallbackProxyIcon(props.name || '')
  const originalIcon = props.icon || ''

  if (fallbackIcon && fallbackIcon !== resolvedIcon.value) {
    resolvedIcon.value = fallbackIcon
    return
  }

  if (originalIcon && originalIcon !== resolvedIcon.value) {
    resolvedIcon.value = originalIcon
    return
  }

  resolvedIcon.value = ''
}
</script>
