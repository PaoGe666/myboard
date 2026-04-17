<template>
  <CollapseCard :name="proxyProvider.name">
    <template v-slot:title>
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-1 items-center gap-1">
          <span class="text-base font-semibold tracking-tight">{{ proxyProvider.name }}</span>
          <span class="text-base-content/60 text-xs tabular-nums">
            · {{ proxyProvider.vehicleType }} · {{ proxiesCount }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="form-control">
            <label class="cursor-pointer label gap-1">
              <span class="label-text text-xs">{{ $t('enabled') }}</span>
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                :checked="isEnabled"
                @change="toggleEnabled"
              />
            </label>
          </div>
          <button
            class="btn btn-circle btn-ghost btn-sm z-30"
            @click.stop="healthCheckClickHandler"
          >
            <span
              v-if="isHealthChecking"
              class="loading loading-spinner loading-sm"
            ></span>
            <BoltIcon
              v-else
              class="h-3.5 w-3.5 opacity-60"
            />
          </button>
          <button
            v-if="proxyProvider.vehicleType !== 'Inline'"
            :class="
              twMerge('btn btn-circle btn-ghost btn-sm z-30', isUpdating ? 'animate-spin' : '')
            "
            @click.stop="updateProviderClickHandler"
          >
            <ArrowPathIcon class="h-3.5 w-3.5 opacity-60" />
          </button>
        </div>
      </div>
      <div class="mt-2 space-y-1.5">
        <div
          v-if="subscriptionInfo"
          class="space-y-1"
        >
          <div class="bg-base-content/10 h-1.5 w-full overflow-hidden rounded-full">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="usageBarColor"
              :style="{ width: `${subscriptionInfo.percentage}%` }"
            />
          </div>
          <div class="text-base-content/60 flex justify-between text-xs">
            <span>{{ subscriptionInfo.usageStr }}</span>
            <span>{{ subscriptionInfo.expireStr }}</span>
          </div>
        </div>
        <div class="text-base-content/60 text-xs">
          {{ $t('updated') }} {{ fromNow(proxyProvider.updatedAt) }}
        </div>
      </div>
    </template>
    <template v-slot:preview>
      <ProxyPreview :nodes="renderProxies" />
    </template>
    <template v-slot:content>
      <ProxiesContent
        :name="name"
        :render-proxies="renderProxies"
      />
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { proxyProviderHealthCheckAPI, updateProxyProviderAPI } from '@/api'
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxies } from '@/composables/renderProxies'
import { fromNow, prettyBytesHelper } from '@/helper/utils'
import { fetchProxies, proxyProviederList } from '@/store/proxies'
import { providerEnabledMap } from '@/store/settings'
import { ArrowPathIcon, BoltIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { toFinite } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseCard from '../common/CollapseCard.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = defineProps<{
  name: string
}>()

const proxyProvider = computed(
  () => proxyProviederList.value.find((group) => group.name === props.name)!,
)

// 订阅启用状态，默认 true（启用）
const isEnabled = computed(() => {
  return providerEnabledMap.value[props.name] !== false
})

const toggleEnabled = () => {
  const current = providerEnabledMap.value[props.name] !== false
  if (current) {
    // 禁用
    providerEnabledMap.value = {
      ...providerEnabledMap.value,
      [props.name]: false,
    }
  } else {
    // 启用
    const newMap = { ...providerEnabledMap.value }
    delete newMap[props.name]
    providerEnabledMap.value = newMap
  }
  // 刷新代理列表
  fetchProxies()
}

const allProxies = computed(() => proxyProvider.value.proxies.map((node) => node.name) ?? [])
const { renderProxies, proxiesCount } = useRenderProxies(allProxies)

const subscriptionInfo = computed(() => {
  const info = proxyProvider.value.subscriptionInfo

  if (info) {
    const { Download = 0, Upload = 0, Total = 0, Expire = 0 } = info

    if (Download === 0 && Upload === 0 && Total === 0 && Expire === 0) {
      return null
    }

    const { t } = useI18n()
    const total = prettyBytesHelper(Total, { binary: true })
    const used = prettyBytesHelper(Download + Upload, { binary: true })
    const percentage = toFinite((((Download + Upload) / Total) * 100).toFixed(2))
    const expireStr =
      Expire === 0
        ? `${t('expire')}: ${t('noExpire')}`
        : `${t('expire')}: ${dayjs(Expire * 1000).format('YYYY-MM-DD')}`

    const usedStr = `${used} / ${total}`
    const usageStr = Total === 0 ? usedStr : `${usedStr} ( ${percentage}% )`

    return {
      expireStr,
      usageStr,
      percentage: Math.min(percentage, 100),
    }
  }

  return null
})

const usageBarColor = computed(() => {
  const pct = subscriptionInfo.value?.percentage ?? 0

  if (pct >= 90) return 'bg-error'
  if (pct >= 70) return 'bg-warning'
  return 'bg-primary'
})

const isUpdating = ref(false)
const isHealthChecking = ref(false)

const healthCheckClickHandler = async () => {
  if (isHealthChecking.value) return

  isHealthChecking.value = true
  try {
    await proxyProviderHealthCheckAPI(props.name)
    await fetchProxies()
    isHealthChecking.value = false
  } catch {
    isHealthChecking.value = false
  }
}

const updateProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    await updateProxyProviderAPI(props.name)
    await fetchProxies()
    isUpdating.value = false
  } catch {
    isUpdating.value = false
  }
}

useBounceOnVisible()
</script>
