<script setup lang="ts">
import { useCalculateMaxProxies } from '@/composables/proxiesScroll'
import { handlerProxySelect } from '@/assembly/proxies'
import { computed } from 'vue'
import ProxyNodeCard from './ProxyNodeCard.vue'
import ProxyNodeGrid from './ProxyNodeGrid.vue'

const props = defineProps<{
  name: string
  now?: string
  renderProxies: string[]
  readonly?: boolean
}>()

const { maxProxies } = useCalculateMaxProxies(
  props.renderProxies.length,
  props.renderProxies.indexOf(props.now ?? ''),
)
const orderedProxies = computed(() => {
  if (!props.now) {
    return props.renderProxies
  }

  const activeProxy = props.renderProxies.find((proxy) => proxy === props.now)

  if (!activeProxy) {
    return props.renderProxies
  }

  return [activeProxy, ...props.renderProxies.filter((proxy) => proxy !== activeProxy)]
})

const proxies = computed(() => orderedProxies.value.slice(0, maxProxies.value))
</script>

<template>
  <ProxyNodeGrid>
    <ProxyNodeCard
      v-for="node in proxies"
      :key="node"
      :name="node"
      :group-name="name"
      :active="node === now"
      @click.stop="!readonly && handlerProxySelect(name, node)"
    />
  </ProxyNodeGrid>
</template>
