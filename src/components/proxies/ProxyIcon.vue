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

<script lang="ts">
import DOMPurify from 'dompurify'

const DOM_STARTS_WITH = 'data:image/svg+xml,'

/*
 * 同一个图标在一页里会重复出现几十次(整组节点常常共用一个),而 sanitize 是要解析一遍
 * DOM 的。按原始字符串缓存,展开一个大组时只在第一张卡片上真跑一次。
 */
const sanitizedCache = new Map<string, string>()

const sanitizeIcon = (icon: string) => {
  const raw = icon.slice(DOM_STARTS_WITH.length)
  const cached = sanitizedCache.get(raw)

  if (cached !== undefined) return cached

  const pure = DOMPurify.sanitize(raw)

  sanitizedCache.set(raw, pure)

  return pure
}
</script>

<script setup lang="ts">
import { getFallbackProxyIcon, getPreferredProxyIcon } from '@/helper/proxyIcon'
import { preferBrandSvgIcon } from '@/store/settings'
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
  return sanitizeIcon(resolvedIcon.value)
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
