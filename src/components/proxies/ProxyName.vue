<template>
  <div class="flex shrink-0 items-center">
    <ProxyIcon
      v-if="displayIcon"
      :icon="rawIcon"
      :name="name"
      :margin="iconMargin"
      :size="iconSize"
    />
    <HighlightText
      v-if="filter"
      :text="name"
      :filter="filter"
    />
    <template v-else>{{ name }}</template>
    <template v-if="dialerProxy"> ({{ dialerProxy }}) </template>
  </div>
</template>

<script setup lang="ts">
import { getPreferredProxyIcon } from '@/helper/proxyIcon'
import HighlightText from '@/components/common/HighlightText.vue'
import { proxyMap } from '@/store/proxies'
import { preferBrandSvgIcon } from '@/store/settings'
import { computed } from 'vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    iconSize?: number
    iconMargin?: number
    filter?: string
  }>(),
  {
    iconSize: 16,
    iconMargin: 4,
    filter: '',
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
