<template>
  <CollapseCard :name="proxyProvider.name">
    <template v-slot:title>
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-1 items-center gap-2.5">
          <span class="text-base-content">{{ proxyProvider.name }}</span>
          <span
            class="text-base-content/40 min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase tabular-nums"
          >
            {{ proxyProvider.vehicleType }} · {{ proxiesCount }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <label class="label cursor-pointer gap-1">
            <span class="label-text text-xs">{{ $t('enabled') }}</span>
            <input
              type="checkbox"
              class="toggle toggle-sm toggle-primary"
              :checked="isEnabled"
              @change="toggleEnabled"
            />
          </label>
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
          <button
            class="btn btn-circle btn-ghost btn-sm text-error z-30"
            @click.stop="deleteProviderClickHandler"
          >
            <TrashIcon class="h-3.5 w-3.5 opacity-60" />
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
      <ProxiesContent :render-proxies="renderProxies" />
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import {
  deleteProxyProviderAPI,
  fetchProxies,
  proxyProviderHealthCheckAPI,
  reconcileDisabledProviderSelections,
  updateProxyProviderAPI,
  proxyProviederList,
} from '@/assembly/proxies'
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxyList } from '@/composables/renderProxies'
import { showConfirmDialog } from '@/helper/confirmDialog'
import { showNotification } from '@/helper/notification'
import { callProviderCgi } from '@/helper/providerCgi'
import { notifyRequestError } from '@/helper/requestError'
import { fromNow, prettyBytesHelper } from '@/helper/utils'
import { providerEnabledMap } from '@/store/settings'
import { ArrowPathIcon, BoltIcon, TrashIcon } from '@heroicons/vue/24/outline'
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

const proxyProvider = computed(() =>
  proxyProviederList.value.find((group) => group.name === props.name)!,
)
const allProxies = computed(() => proxyProvider.value.proxies.map((node) => node.name) ?? [])
const { renderProxies, proxiesCount } = useRenderProxyList(allProxies)

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

// 订阅启用状态,默认 true(启用)
const isEnabled = computed(() => {
  return providerEnabledMap.value[props.name] !== false
})

const toggleEnabled = async () => {
  const current = providerEnabledMap.value[props.name] !== false
  if (current) {
    providerEnabledMap.value = {
      ...providerEnabledMap.value,
      [props.name]: false,
    }
  } else {
    const newMap = { ...providerEnabledMap.value }
    delete newMap[props.name]
    providerEnabledMap.value = newMap
  }

  if (current) {
    await reconcileDisabledProviderSelections()
    return
  }

  await fetchProxies()
}

const deleteProviderClickHandler = async () => {
  const { t } = useI18n()
  const { confirmed } = await showConfirmDialog({
    title: t('deleteProviderTitle', { name: props.name }),
    message: t('deleteProviderMessage', { name: props.name }),
    confirmButtonClass: 'btn-error',
  })
  if (!confirmed) return

  try {
    // 优先从配置中永久移除(OpenClash 经 CGI),避免重启后旧订阅复活
    const cgi = await callProviderCgi('delete', props.name)
    if (!cgi.ok) {
      // CGI 不可用(非 OpenClash)时回退到 API 临时移除
      await deleteProxyProviderAPI(props.name)
    }
    await fetchProxies()
    showNotification({
      content: 'deleteProviderSuccess',
      type: 'alert-success',
    })
  } catch (e) {
    notifyRequestError(e)
  }
}

const healthCheckClickHandler = async () => {
  if (isHealthChecking.value) return

  isHealthChecking.value = true
  try {
    await proxyProviderHealthCheckAPI(props.name)
    await fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  } finally {
    isHealthChecking.value = false
  }
}

const updateProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    await updateProxyProviderAPI(props.name)
    await fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  } finally {
    isUpdating.value = false
  }
}

useBounceOnVisible()
</script>
