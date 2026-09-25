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
        :can-manual="canManuallyChooseProviderNode"
        :manual-mode="manualNodeMode"
        :now="currentProxyName"
        :show-warning="showWarning && hasNoAvailableProxy"
        @manual-toggle="handlerManualModeToggle"
        @latency-test="handlerLatencyTest"
      />
      <ProxyGroupHeader
        v-else
        :name="name"
        :proxies-count="proxiesCount"
        :is-latency-testing="isLatencyTesting"
        :can-manual="canManuallyChooseProviderNode"
        :manual-mode="manualNodeMode"
        :now="currentProxyName"
        :show-warning="showWarning && hasNoAvailableProxy"
        @manual-toggle="handlerManualModeToggle"
        @latency-test="handlerLatencyTest"
      />
    </template>
    <template v-slot:preview>
      <ProxyPreview
        :nodes="visibleProxies"
        :now="visibleNow"
        :groupName="selectionGroupName"
        @nodeclick="handlerNodeSelect"
      />
    </template>
    <template v-slot:content>
      <div class="flex flex-col gap-3">
        <Component
          :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
          :name="selectionGroupName"
          :now="visibleNow"
          :render-proxies="visibleProxies"
          :readonly="readonly"
          :stable-order="manualNodeMode"
        />
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxies } from '@/composables/renderProxies'
import { customNodeNames } from '@/composables/proxies'
import { MYBOARD_MANUAL_GROUP_PREFIX, PROXY_TYPE } from '@/constant'
import { isMiddleScreen } from '@/helper/utils'
import {
  getCurrentProxyName,
  handlerProxySelect,
  proxyGroupLatencyTest,
  proxyProviederList,
  proxyMap,
} from '@/assembly/proxies'
import { groupProxiesByProvider, providerEnabledMap } from '@/store/settings'
import { useSessionStorage } from '@vueuse/core'
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
const manualGroupName = computed(() => `${MYBOARD_MANUAL_GROUP_PREFIX}${props.name}`)
const manualNodeMode = computed(() => proxyGroup.value?.now === manualGroupName.value)
const previousProxyName = useSessionStorage(`myboard-manual-previous:${props.name}`, '')
const selectionGroupName = computed(() =>
  manualNodeMode.value ? manualGroupName.value : props.name,
)
const currentProxyName = computed(() =>
  proxyGroup.value?.now === manualGroupName.value
    ? getCurrentProxyName(manualGroupName.value)
    : getCurrentProxyName(props.name),
)
const canManuallyChooseProviderNode = computed(
  () =>
    !props.readonly &&
    !props.modeFilter &&
    proxyGroup.value?.type.toLowerCase() === PROXY_TYPE.Selector &&
    (proxyProviederList.value.length > 0 || customNodeNames.value.length > 0) &&
    Boolean(proxyMap.value[manualGroupName.value]),
)
const regularProxies = computed(() =>
  allProxies.value.filter((name) => name !== manualGroupName.value),
)
const providerNodes = computed(() => {
  const names = new Set<string>()
  for (const provider of proxyProviederList.value) {
    if (providerEnabledMap.value[provider.name] === false) continue
    for (const node of provider.proxies) {
      names.add(node.name)
    }
  }
  for (const name of customNodeNames.value) names.add(name)
  return [...names]
})
const { proxiesCount: regularProxiesCount, renderProxies: regularRenderProxies } = useRenderProxies(
  regularProxies,
  props.name,
  props.modeFilter,
)
const { proxiesCount: manualProxiesCount, renderProxies: manualRenderProxies } = useRenderProxies(
  providerNodes,
  props.name,
  undefined,
  false,
  true,
)
const proxiesCount = computed(() =>
  manualNodeMode.value ? manualProxiesCount.value : regularProxiesCount.value,
)
const visibleProxies = computed(() =>
  manualNodeMode.value ? manualRenderProxies.value : regularRenderProxies.value,
)
const visibleNow = computed(() =>
  manualNodeMode.value ? proxyMap.value[manualGroupName.value]?.now : currentProxyName.value,
)
const handlerNodeSelect = (node: string) => handlerProxySelect(selectionGroupName.value, node)
const handlerManualModeToggle = async () => {
  if (!canManuallyChooseProviderNode.value) return

  if (!manualNodeMode.value) {
    const selected = proxyGroup.value?.now ?? ''
    previousProxyName.value = selected.startsWith(MYBOARD_MANUAL_GROUP_PREFIX)
      ? (regularProxies.value[0] ?? '')
      : selected
    await handlerProxySelect(props.name, manualGroupName.value)
    return
  }

  const restore = allProxies.value.includes(previousProxyName.value)
    ? previousProxyName.value
    : (regularProxies.value[0] ?? '')
  if (restore) await handlerProxySelect(props.name, restore)
}
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
