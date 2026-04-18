<template>
  <div class="flex flex-1 items-center gap-1 truncate">
    <template v-if="currentProxyName">
      <Component
        class="h-4 w-4 shrink-0 outline-none"
        :is="isFixed ? LockClosedIcon : ArrowRightCircleIcon"
        @mouseenter="tipForFixed"
      />
      <ProxyName
        :name="currentProxyName"
        :class="
          isNowAGroup && 'hover:bg-base-300 hover:-mx-1 hover:rounded-lg hover:px-1 hover:shadow'
        "
        class="text-base-content/80 text-xs md:text-sm"
        @click="handlerClickNow"
      />
      <template v-if="finalOutbound && displayFinalOutbound">
        <ArrowRightCircleIcon class="h-4 w-4 shrink-0" />
        <ProxyName
          :name="finalOutbound"
          class="text-base-content/80 text-xs md:text-sm"
        />
      </template>
    </template>
    <template v-else-if="proxyGroup.type.toLowerCase() === PROXY_TYPE.LoadBalance">
      <CheckCircleIcon class="h-4 w-4 shrink-0" />
      <span class="text-base-content/80 text-xs md:text-sm">
        {{ $t('loadBalance') }}
      </span>
    </template>
    <template v-else>
      <ExclamationTriangleIcon class="text-warning h-4 w-4 shrink-0" />
      <span class="text-base-content/70 text-xs md:text-sm">
        {{ $t('noAvailableProxy') }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PROXY_TYPE } from '@/constant'
import { useTooltip } from '@/helper/tooltip'
import { scrollToGroup } from '@/helper/utils'
import { getCurrentProxyName, getNowProxyNodeName, proxyGroupList, proxyMap } from '@/store/proxies'
import { displayFinalOutbound } from '@/store/settings'
import {
  ArrowRightCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ProxyName from './ProxyName.vue'

const props = defineProps<{
  name: string
  mobile?: boolean
}>()
const proxyGroup = computed(() => proxyMap.value[props.name])
const { showTip } = useTooltip()
const { t } = useI18n()
const currentProxyName = computed(() => getCurrentProxyName(props.name))

const isFixed = computed(() => {
  return proxyGroup.value.fixed === currentProxyName.value
})

const tipForFixed = (e: Event) => {
  if (!isFixed.value) {
    return
  }

  showTip(e, t('tipForFixed', { type: proxyGroup.value.type }), {
    delay: [500, 0],
  })
}

const isNowAGroup = computed(() => {
  return proxyGroupList.value.includes(currentProxyName.value)
})

const finalOutbound = computed(() => {
  const now = getNowProxyNodeName(props.name)

  if (!currentProxyName.value || now === currentProxyName.value) {
    return ''
  }

  return now
})

const handlerClickNow = (e: Event) => {
  if (isNowAGroup.value) {
    e.stopPropagation()
    scrollToGroup(currentProxyName.value)
  }
}
</script>
