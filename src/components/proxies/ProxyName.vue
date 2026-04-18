<template>
  <div class="flex shrink-0 items-center">
    <ProxyIcon
      v-if="displayIcon"
      :icon="rawIcon"
      :name="name"
      :margin="iconMargin"
      :size="iconSize"
    />
    {{ name }}
    <template v-if="dialerProxy"> ({{ dialerProxy }}) </template>
  </div>
</template>

<script setup lang="ts">
import { getPreferredProxyIcon } from '@/helper/proxyIcon'
import { proxyMap } from '@/store/proxies'
import { preferBrandSvgIcon } from '@/store/settings'
import { computed } from 'vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    iconSize?: number
    iconMargin?: number
  }>(),
  {
    iconSize: 16,
    iconMargin: 4,
  },
)

const node = computed(() => proxyMap.value[props.name])
const rawIcon = computed(() => node.value?.icon || '')
const displayIcon = computed(() =>
  getPreferredProxyIcon(props.name, rawIcon.value, preferBrandSvgIcon.value),
)
const dialerProxy = computed(() => {
  return node.value?.['dialer-proxy']
})
</script>
