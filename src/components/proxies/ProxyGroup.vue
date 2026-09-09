<template>
  <CollapseCard
    :name="proxyGroup.name"
    :force-open="forceOpen"
    :data-group-name="proxyGroup.name"
    @contextmenu.prevent.stop="handlerLatencyTest"
  >
    <template v-slot:title>
      <ProxyGroupHeaderForMobile
        v-if="isMiddleScreen"
        :name="name"
        :proxies-count="proxiesCount"
        :is-latency-testing="isLatencyTesting"
        :display-content="true"
        :now="currentProxyName"
        :show-warning="showWarning && hasNoAvailableProxy"
        @latency-test="handlerLatencyTest"
      />
      <ProxyGroupHeader
        v-else
        :name="name"
        :proxies-count="proxiesCount"
        :is-latency-testing="isLatencyTesting"
        :now="currentProxyName"
        :show-warning="showWarning && hasNoAvailableProxy"
        @latency-test="handlerLatencyTest"
      />
    </template>
    <template v-slot:preview>
      <ProxyPreview
        :nodes="renderProxies"
        :now="currentProxyName"
        :groupName="proxyGroup.name"
        @nodeclick="handlerProxySelect(name, $event)"
      />
    </template>
    <template v-slot:content>
      <Component
        :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
        :name="name"
        :now="currentProxyName"
        :render-proxies="renderProxies"
        :readonly="readonly"
      />
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxies } from '@/composables/renderProxies'
import { isMiddleScreen } from '@/helper/utils'
import { getCurrentProxyName, handlerProxySelect, proxyGroupLatencyTest } from '@/assembly/proxies'
import { proxyMap } from '@/assembly/proxies'
import { groupProxiesByProvider } from '@/store/settings'
import { computed, ref } from 'vue'
import CollapseCard from '../common/CollapseCard.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyGroupHeader from './ProxyGroupHeader.vue'
import ProxyGroupHeaderForMobile from './ProxyGroupHeaderForMobile.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = withDefaults(
  defineProps<{
    name: string
    forceOpen?: boolean
    showWarning?: boolean
    modeFilter?: 'auto' | 'manual'
    readonly?: boolean
  }>(),
  {
    forceOpen: false,
    showWarning: true,
    readonly: false,
  },
)
const proxyGroup = computed(() => proxyMap.value[props.name])
const allProxies = computed(() => proxyGroup.value?.all ?? [])
const { proxiesCount, renderProxies } = useRenderProxies(allProxies, props.name, props.modeFilter)
const currentProxyName = computed(() => getCurrentProxyName(props.name))
const hasNoAvailableProxy = computed(() => !currentProxyName.value)
const isLatencyTesting = ref(false)
const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  isLatencyTesting.value = true
  try {
    await proxyGroupLatencyTest(props.name)
    isLatencyTesting.value = false
  } catch {
    isLatencyTesting.value = false
  }
}

useBounceOnVisible()
</script>
